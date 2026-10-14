import { Navigate, useNavigate } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { AuthForm } from './AuthForm';
import { WelcomePanel } from './WelcomePanel';

export default function WelcomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Render straight away while the session check runs: after idle the API cold-starts, and a
  // logged-out visitor should not wait on it. A restored session redirects when it arrives.
  if (user) return <Navigate to="/trips" replace />;

  return (
    <main className="mx-auto grid min-h-screen max-w-5xl items-center gap-10 px-4 py-10 lg:grid-cols-2">
      <WelcomePanel />
      <div className="mx-auto w-full max-w-md">
        <AuthForm onSuccess={() => navigate('/trips', { replace: true })} />
      </div>
    </main>
  );
}
