import { create } from 'zustand';
import { isApiException } from '@/core/network/apiException';
import { UserRepository } from '@/data/api/userRepository';
import {
  QuizRepository,
  type QuizCategoriesResult,
  type QuizCurrentResult,
  type QuizHistoryPage,
} from '@/data/api/quizRepository';
import type { QuizCategoryKey, QuizHistoryItem } from '@/data/models';
import { useUserStore } from './userStore';

interface QuizState {
  /** Landing-page payload: rules, next-slot timing and the four categories. */
  lobby: QuizCategoriesResult | null;
  lobbyLoading: boolean;
  lobbyError: string | null;

  /** The session this user is playing right now, if any. */
  active: QuizCurrentResult['active'];
  activeChecked: boolean;

  history: QuizHistoryItem[];
  historyTotal: number;
  historyLoading: boolean;
  historyError: string | null;

  /** Newest `serverNow` from any quiz call — feeds useServerClock. */
  serverNowMs: number | null;

  /** Guards the join button against a double click racing itself. */
  joiningCategory: QuizCategoryKey | null;

  loadLobby: () => Promise<void>;
  loadActive: () => Promise<void>;
  loadHistory: () => Promise<void>;
  join: (categoryKey: QuizCategoryKey) => Promise<{ quizId: string } | null>;
  /** Pulls the profile so a settled reward shows in the balance. */
  refreshBalance: () => Promise<void>;
  reset: () => void;
}

const initial = {
  lobby: null,
  lobbyLoading: false,
  lobbyError: null,
  active: null,
  activeChecked: false,
  history: [],
  historyTotal: 0,
  historyLoading: false,
  historyError: null,
  serverNowMs: null,
  joiningCategory: null,
};

/** Quiz lobby, live session and history, backed by the live API. */
export const useQuizStore = create<QuizState>((set, get) => ({
  ...initial,

  loadLobby: async () => {
    set({ lobbyLoading: true, lobbyError: null });
    try {
      const lobby = await QuizRepository.categories();
      set({ lobby, serverNowMs: lobby.serverNowMs });
    } catch (e) {
      set({ lobbyError: isApiException(e) ? e.message : 'Could not load the quiz.' });
    } finally {
      set({ lobbyLoading: false });
    }
  },

  loadActive: async () => {
    try {
      const r = await QuizRepository.current();
      set({ active: r.active, activeChecked: true, serverNowMs: r.serverNowMs });
    } catch {
      // A failed check must not strand the lobby behind a spinner — treat it as
      // "nothing in progress" and let the next poll correct it.
      set({ activeChecked: true });
    }
  },

  loadHistory: async () => {
    set({ historyLoading: true, historyError: null });
    try {
      const page: QuizHistoryPage = await QuizRepository.history({ take: 20 });
      set({ history: page.items, historyTotal: page.total });
    } catch (e) {
      set({ historyError: isApiException(e) ? e.message : 'Could not load your history.' });
    } finally {
      set({ historyLoading: false });
    }
  },

  /**
   * Joins the upcoming session for a category.
   *
   * Resolves the session id first (`/quiz/next` creates it on demand) and only
   * then charges, so the id the user joins is always the one the backend
   * considers joinable. Errors are surfaced by throwing — the dialog shows the
   * server's own message, which distinguishes INSUFFICIENT_POINTS from
   * ALREADY_JOINED and QUIZ_ALREADY_STARTED.
   */
  join: async (categoryKey) => {
    if (get().joiningCategory) return null;
    set({ joiningCategory: categoryKey });
    try {
      const next = await QuizRepository.next(categoryKey);
      if (next.joined) {
        // Already in — treat it as success rather than charging again.
        await get().loadActive();
        return { quizId: next.quiz.id };
      }
      const r = await QuizRepository.join(next.quiz.id);
      useUserStore.getState().setCoins(r.balance);
      await Promise.all([get().loadLobby(), get().loadActive()]);
      return { quizId: r.quiz.id || next.quiz.id };
    } finally {
      set({ joiningCategory: null });
    }
  },

  refreshBalance: async () => {
    try {
      useUserStore.getState().setUser(await UserRepository.profile());
    } catch {
      /* a stale balance is better than a broken result screen */
    }
  },

  reset: () => set({ ...initial }),
}));
