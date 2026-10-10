import { Outlet } from 'react-router';
import { NavBar } from './NavBar';

export function AppLayout() {
  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
