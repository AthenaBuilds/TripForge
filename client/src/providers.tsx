import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ApiRequestError } from './api/client';
import { AuthProvider } from './auth/AuthContext';
import { DraftTripProvider } from './draft/DraftTripContext';

export function createQueryClient({ retries = true } = {}) {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Retry network blips and 5xx, but not client errors like 401/404.
        retry: (count, err) =>
          retries &&
          count < 2 &&
          !(err instanceof ApiRequestError && err.status >= 400 && err.status < 500),
      },
    },
  });
}

export function AppProviders({ client, children }: { client: QueryClient; children: ReactNode }) {
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <DraftTripProvider>{children}</DraftTripProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
