import { Navigate, useNavigate } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { AuthForm } from './AuthForm';
import { WelcomePanel } from './WelcomePanel';

export default function WelcomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (user === undefined) return <LoadingSpinner label="Loading" fullPage />;
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
