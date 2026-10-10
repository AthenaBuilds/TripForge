import { z } from 'zod';
import { dateSchema, itineraryItemInputSchema } from '@tripforge/shared';

// frontend-spec §6: one draft per user, at tripforge:draft:<userId>, versioned.

export const draftItemSchema = itineraryItemInputSchema.extend({
  /** Local id for edit/remove before the trip is saved. Stripped on Save Trip. */
  clientId: z.string().min(1),
});

const draftSchema = z.object({
  version: z.literal(1),
  destination: z.string(),
  startDate: dateSchema,
  endDate: dateSchema,
  items: z.array(draftItemSchema),
  updatedAt: z.string(),
});

export type DraftItem = z.infer<typeof draftItemSchema>;
export type Draft = z.infer<typeof draftSchema>;

export const draftKey = (userId: string) => `tripforge:draft:${userId}`;

/** Returns the stored draft, or null if there is none, it doesn't parse, or storage is unavailable. */
export function loadDraft(userId: string): Draft | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(draftKey(userId));
  } catch {
    return null;
  }
  if (raw === null) return null;

  try {
    const parsed = draftSchema.safeParse(JSON.parse(raw));
    if (parsed.success) return parsed.data;
  } catch {
    // fall through: unparseable JSON
  }
  removeDraft(userId); // corrupt or unknown version: discard it
  return null;
}

/** Best effort: without storage (e.g. private mode), the draft just lives in memory. */
export function saveDraft(userId: string, draft: Draft): void {
  try {
    localStorage.setItem(draftKey(userId), JSON.stringify(draft));
  } catch {
    // ignore
  }
}

export function removeDraft(userId: string): void {
  try {
    localStorage.removeItem(draftKey(userId));
  } catch {
    // ignore
  }
}
