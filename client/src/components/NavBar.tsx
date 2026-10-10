import { Link, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { useDraft } from '../draft/DraftTripContext';

export function NavBar() {
  const { user, logout } = useAuth();
  const { clearDraft } = useDraft();
  const navigate = useNavigate();

  async function handleLogout() {
    clearDraft(); // drafts are cleared on logout (frontend-spec §6)
    await logout();
    navigate('/', { replace: true });
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <nav className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
        <Link
          to="/trips"
          className="font-heading text-xl font-bold text-sky-800 focus-visible:outline-2 focus-visible:outline-sky-600"
        >
          TripForge
        </Link>
        {user && (
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-600 sm:inline">
              Signed in as <span className="font-semibold text-slate-800">{user.name}</span>
            </span>
            <button type="button" className="btn-secondary" onClick={handleLogout}>
              Log out
            </button>
          </div>
        )}
      </nav>
    </header>
  );
}
