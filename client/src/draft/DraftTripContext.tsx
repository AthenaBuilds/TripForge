import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '../auth/AuthContext';
import { loadDraft, removeDraft, saveDraft, type Draft } from './draftStorage';

const SAVE_DELAY_MS = 500;

export type DraftDetails = Pick<Draft, 'destination' | 'startDate' | 'endDate'>;

type DraftState = {
  draft: Draft | null;
  /** Replace any existing draft with a fresh one (no items). */
  startDraft: (details: DraftDetails) => void;
  updateDraft: (update: (draft: Draft) => Draft) => void;
  clearDraft: () => void;
};

const DraftContext = createContext<DraftState | null>(null);

export function DraftTripProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [state, setState] = useState<{ userId: string | null; draft: Draft | null }>(() => ({
    userId,
    draft: userId ? loadDraft(userId) : null,
  }));

  // A different user logged in (or the session was restored): load their draft during render,
  // so no frame ever shows another user's draft.
  if (state.userId !== userId) {
    setState({ userId, draft: userId ? loadDraft(userId) : null });
  }
  const draft = state.userId === userId ? state.draft : null;

  // Auto-save, debounced.
  useEffect(() => {
    if (!userId || !draft) return;
    const timer = setTimeout(() => saveDraft(userId, draft), SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draft, userId]);

  const startDraft = useCallback((details: DraftDetails) => {
    setState((s) => ({
      ...s,
      draft: { version: 1, ...details, items: [], updatedAt: new Date().toISOString() },
    }));
  }, []);

  const updateDraft = useCallback((update: (d: Draft) => Draft) => {
    setState((s) =>
      s.draft ? { ...s, draft: { ...update(s.draft), updatedAt: new Date().toISOString() } } : s,
    );
  }, []);

  const clearDraft = useCallback(() => {
    setState((s) => ({ ...s, draft: null }));
    if (userId) removeDraft(userId);
  }, [userId]);

  const value = useMemo(
    () => ({ draft, startDraft, updateDraft, clearDraft }),
    [draft, startDraft, updateDraft, clearDraft],
  );
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useDraft(): DraftState {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error('useDraft must be used inside DraftTripProvider');
  return ctx;
}
