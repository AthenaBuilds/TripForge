#!/usr/bin/env bash
# One-time GCP setup for the TripForge API on Cloud Run (backend-spec.md §14–15).
# Idempotent: safe to re-run, e.g. to rotate the Neon URLs. Run as a project owner.
# After the first deploy, also run the public-access grant printed at the end.
set -euo pipefail

P=${GCP_PROJECT_ID:-project-e5876b6a-ef84-4b68-a0d}
REGION=asia-southeast1
REPO_GH=AthenaBuilds/TripForge
BILLING=${GCP_BILLING_ACCOUNT:-0101C4-6EA5BF-023C85}
RUN_SA=tripforge-run@$P.iam.gserviceaccount.com
DEP_SA=tripforge-deployer@$P.iam.gserviceaccount.com
PNUM=$(gcloud projects describe "$P" --format='value(projectNumber)')

echo "== APIs"
gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com \
  iamcredentials.googleapis.com sts.googleapis.com billingbudgets.googleapis.com --project="$P"

echo "== Service accounts"
for sa in tripforge-run tripforge-deployer; do
  gcloud iam service-accounts describe "$sa@$P.iam.gserviceaccount.com" --project="$P" >/dev/null 2>&1 ||
    gcloud iam service-accounts create "$sa" --project="$P" --display-name="$sa"
done

echo "== Artifact Registry (keep newest 2 images)"
gcloud artifacts repositories describe tripforge --location="$REGION" --project="$P" >/dev/null 2>&1 ||
  gcloud artifacts repositories create tripforge --location="$REGION" --project="$P" --repository-format=docker
policy=$(mktemp)
cat >"$policy" <<'EOF'
[
  {"name": "keep-2", "action": {"type": "Keep"}, "mostRecentVersions": {"keepCount": 2}},
  {"name": "delete-rest", "action": {"type": "Delete"}, "condition": {"tagState": "any"}}
]
EOF
gcloud artifacts repositories set-cleanup-policies tripforge --location="$REGION" --project="$P" \
  --policy="$policy" --no-dry-run --quiet >/dev/null
rm -f "$policy"

echo "== Deployer roles"
gcloud projects add-iam-policy-binding "$P" --member="serviceAccount:$DEP_SA" \
  --role=roles/run.developer --condition=None --quiet >/dev/null
gcloud artifacts repositories add-iam-policy-binding tripforge --location="$REGION" --project="$P" \
  --member="serviceAccount:$DEP_SA" --role=roles/artifactregistry.writer --quiet >/dev/null
gcloud iam service-accounts add-iam-policy-binding "$RUN_SA" --project="$P" \
  --member="serviceAccount:$DEP_SA" --role=roles/iam.serviceAccountUser --quiet >/dev/null

echo "== Workload Identity Federation"
gcloud iam workload-identity-pools describe github --location=global --project="$P" >/dev/null 2>&1 ||
  gcloud iam workload-identity-pools create github --location=global --project="$P" \
    --display-name="GitHub Actions"
gcloud iam workload-identity-pools providers describe tripforge --workload-identity-pool=github \
  --location=global --project="$P" >/dev/null 2>&1 ||
  gcloud iam workload-identity-pools providers create-oidc tripforge --workload-identity-pool=github \
    --location=global --project="$P" --issuer-uri=https://token.actions.githubusercontent.com \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
    --attribute-condition="assertion.repository == '$REPO_GH' && assertion.ref == 'refs/heads/main'"
gcloud iam service-accounts add-iam-policy-binding "$DEP_SA" --project="$P" \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$PNUM/locations/global/workloadIdentityPools/github/attribute.repository/$REPO_GH" \
  --quiet >/dev/null

echo "== Secrets (input hidden; leave blank to keep the current value)"
put_secret() {
  local name=$1 val=$2
  gcloud secrets describe "$name" --project="$P" >/dev/null 2>&1 ||
    gcloud secrets create "$name" --project="$P" --replication-policy=user-managed --locations="$REGION"
  printf '%s' "$val" | gcloud secrets versions add "$name" --project="$P" --data-file=- >/dev/null
  gcloud secrets add-iam-policy-binding "$name" --project="$P" \
    --member="serviceAccount:$RUN_SA" --role=roles/secretmanager.secretAccessor --quiet >/dev/null
  echo "  $name set"
}
# Accept Neon's "psql '…'" copy button output too: keep only the bare postgresql:// URL.
clean_url() { printf '%s' "$1" | sed -E "s/^[[:space:]]*psql[[:space:]]+//; s/^'//; s/'[[:space:]]*\$//; s/^[[:space:]]+//; s/[[:space:]]+\$//"; }
read -rsp "Neon POOLED url (DATABASE_URL, host has -pooler): " v; echo
if [ -n "$v" ]; then v=$(clean_url "$v"); [[ $v == postgresql://* ]] || { echo "not a postgresql:// URL"; exit 1; }; put_secret DATABASE_URL "$v"; fi
read -rsp "Neon DIRECT url (DIRECT_URL, no -pooler): " v; echo
if [ -n "$v" ]; then v=$(clean_url "$v"); [[ $v == postgresql://* ]] || { echo "not a postgresql:// URL"; exit 1; }; put_secret DIRECT_URL "$v"; fi
read -rp "Generate a new JWT_SECRET (signs every user out)? [y/N] " a
if [ "$a" = y ]; then put_secret JWT_SECRET "$(openssl rand -base64 48)"; fi

# Budgets must use the billing account's currency (INR here); 450 INR is about 5 USD.
echo "== Budget"
CUR=$(gcloud billing accounts describe "$BILLING" --format='value(currencyCode)')
AMOUNT=$([ "$CUR" = INR ] && echo 450INR || echo "5$CUR")
gcloud billing budgets list --billing-account="$BILLING" --format='value(displayName)' | grep -qx tripforge ||
  gcloud billing budgets create --billing-account="$BILLING" --display-name=tripforge \
    --budget-amount="$AMOUNT" --filter-projects="projects/$PNUM" \
    --threshold-rule=percent=0.5 --threshold-rule=percent=0.9 --threshold-rule=percent=1.0

cat <<EOF

== Next steps
GitHub repo variables (Settings > Secrets and variables > Actions > Variables), one per name, no padding:
  GCP_PROJECT_ID   $P
  GCP_REGION       $REGION
  GCP_WIF_PROVIDER projects/$PNUM/locations/global/workloadIdentityPools/github/providers/tripforge
  GCP_DEPLOYER_SA  $DEP_SA
  CORS_ORIGIN      https://tripforge-alpha.vercel.app
  TRUST_PROXY_HOPS 2
Also create a GitHub environment named 'production'.
After the first successful deploy, make the service public (once):
  gcloud run services add-iam-policy-binding tripforge-api --region=$REGION --project=$P --member=allUsers --role=roles/run.invoker
After rotating secrets, redeploy (Actions > Deploy API > Run workflow), then destroy old versions:
  gcloud secrets versions list DATABASE_URL --project=$P   # then: gcloud secrets versions destroy <n> --secret=...
EOF
