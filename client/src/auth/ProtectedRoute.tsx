import { Navigate, Outlet } from 'react-router';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useAuth } from './AuthContext';

/** Renders child routes for a logged-in user; otherwise redirects to the Welcome page. */
export function ProtectedRoute() {
  const { user } = useAuth();
  if (user === undefined) return <LoadingSpinner label="Restoring your session" fullPage />;
  if (user === null) return <Navigate to="/" replace />;
  return <Outlet />;
}
