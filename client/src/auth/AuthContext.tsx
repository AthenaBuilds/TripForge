import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { LoginInput, SignupInput, User } from '@tripforge/shared';
import { ApiRequestError, setUnauthenticatedHandler } from '../api/client';
import { authApi, queryKeys } from '../api/endpoints';

type AuthState = {
  /** undefined while the session is being restored, null when logged out. */
  user: User | null | undefined;
  login: (input: LoginInput) => Promise<User>;
  signup: (input: SignupInput) => Promise<User>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

/** GET /auth/me, where 401 means "logged out" rather than an error. */
async function fetchSession(): Promise<User | null> {
  try {
    return await authApi.me();
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 401) return null;
    throw err;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data: user } = useQuery({
    queryKey: queryKeys.me,
    queryFn: fetchSession,
    retry: false,
    staleTime: Infinity,
  });

  const endSession = useCallback(() => {
    // Drop every cached trip so the next user on this device never sees them.
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== queryKeys.me[0] });
    queryClient.setQueryData(queryKeys.me, null);
  }, [queryClient]);

  // Any 401 from a session-backed call means the cookie expired: clear the session.
  // ProtectedRoute then redirects to "/".
  useEffect(() => {
    setUnauthenticatedHandler(endSession);
    return () => setUnauthenticatedHandler(null);
  }, [endSession]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      login: async (input) => {
        const u = await authApi.login(input);
        queryClient.setQueryData(queryKeys.me, u);
        return u;
      },
      signup: async (input) => {
        const u = await authApi.signup(input);
        queryClient.setQueryData(queryKeys.me, u);
        return u;
      },
      logout: async () => {
        try {
          await authApi.logout();
        } finally {
          endSession();
        }
      },
    }),
    [user, queryClient, endSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** The logged-in user. Only for components rendered inside ProtectedRoute. */
export function useCurrentUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error('useCurrentUser used outside ProtectedRoute');
  return user;
}
