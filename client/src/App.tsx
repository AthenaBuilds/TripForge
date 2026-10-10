import { lazy, Suspense } from 'react';
import { Navigate, Outlet, type RouteObject } from 'react-router';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { AppLayout } from './components/AppLayout';
import { LoadingSpinner } from './components/LoadingSpinner';

// Route-level code splitting (frontend-spec §11).
const WelcomePage = lazy(() => import('./pages/welcome/WelcomePage'));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const NewItineraryPage = lazy(() => import('./pages/builder/NewItineraryPage'));
const TripPage = lazy(() => import('./pages/trip/TripPage'));
const SharedTripPage = lazy(() => import('./pages/shared/SharedTripPage'));

function Root() {
  return (
    <Suspense fallback={<LoadingSpinner fullPage />}>
      <Outlet />
    </Suspense>
  );
}

/** Route table for createBrowserRouter (a data router, so pages can use useBlocker). */
export const routes: RouteObject[] = [
  {
    element: <Root />,
    children: [
      { path: '/', element: <WelcomePage /> },
      { path: '/shared/:slug', element: <SharedTripPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { path: '/trips', element: <DashboardPage /> },
              { path: '/trips/new/itinerary', element: <NewItineraryPage /> },
              { path: '/trips/:tripId', element: <TripPage /> },
            ],
          },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];
