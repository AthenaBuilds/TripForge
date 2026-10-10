import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { AppLayout } from './components/AppLayout';
import { LoadingSpinner } from './components/LoadingSpinner';

// Route-level code splitting (frontend-spec §11).
const WelcomePage = lazy(() => import('./pages/welcome/WelcomePage'));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const ComingNext = lazy(() => import('./pages/ComingNext'));

export function App() {
  return (
    <Suspense fallback={<LoadingSpinner fullPage />}>
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/shared/:slug" element={<ComingNext />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/trips" element={<DashboardPage />} />
            <Route path="/trips/new/itinerary" element={<ComingNext />} />
            <Route path="/trips/:tripId" element={<ComingNext />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
