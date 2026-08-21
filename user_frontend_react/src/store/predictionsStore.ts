import { create } from 'zustand';
import { isApiException } from '@/core/network/apiException';
import { MetaPixel } from '@/core/analytics/metaPixel';
import {
  PredictionsRepository,
  emptyHistorySummary,
  type HistorySummary,
} from '@/data/api/predictionsRepository';
import type { Prediction } from '@/data/models';

interface PredictionsState {
  open: Prediction[];
  active: Prediction[];
  history: Prediction[];
  historySummary: HistorySummary;

  /**
   * True count of ALL open predictions matching the query, not just the
   * capped `take: 20` page in `open` — the Open tab's count badge must show
   * this instead of `open.length`, which would otherwise under-report as soon
   * as there are more than 20 open predictions.
   */
  openTotal: number;

  /**
   * True open-prediction count per category key — the sidebar's category
   * badges must use this instead of counting occurrences within `open` (a
   * 20-item, unfiltered-by-category sample that can easily miss a category
   * entirely even when it has hundreds of open predictions).
   */
  categoryCounts: Record<string, number>;

  loading: boolean;
  error: string | null;
  loadedOpen: boolean;

  activeLoading: boolean;
  activeError: string | null;

  /**
   * Bumped on every successful submit — screens that own their own local feed
   * list (not derived straight from open/active) watch this to know a
   * submission just happened, so they can refresh in place instead of
   * requiring a manual reload first.
   */
  submitVersion: number;

  /**
   * Bumped the instant a submit's POST succeeds — before `submitVersion`'s
   * full background refresh even starts. A screen with its own local list
   * (e.g. the Open grid) reacts to this to optimistically hide the
   * just-answered item immediately, instead of it lingering in view until the
   * slower full-list refresh round-trip lands.
   */
  justSubmittedVersion: number;
  justSubmittedId: string | null;
  justSubmittedOptionId: string | null;

  loadOpen: (opts?: { force?: boolean }) => Promise<void>;
  loadActive: () => Promise<void>;
  loadHistory: () => Promise<void>;
  submit: (predictionId: string, optionId: string, entryFee?: number) => Promise<number | null>;
  reset: () => void;
}

/** Prediction lists + submission, backed by the live API. Port of PredictionsProvider. */
export const usePredictionsStore = create<PredictionsState>((set, get) => ({
  open: [],
  active: [],
  history: [],
  historySummary: emptyHistorySummary,
  openTotal: 0,
  categoryCounts: {},
  loading: false,
  error: null,
  loadedOpen: false,
  activeLoading: false,
  activeError: null,
  submitVersion: 0,
  justSubmittedVersion: 0,
  justSubmittedId: null,
  justSubmittedOptionId: null,

  /**
   * The portal's shared open-predictions feed (first page). The Predict page
   * owns its own searched/filtered/paginated feed locally so its filters
   * don't mutate what the rest of the portal shows.
   */
  loadOpen: async ({ force = false } = {}) => {
    if (get().loadedOpen && !force) return;
    set({ loading: true, error: null });
    try {
      const page = await PredictionsRepository.list({ take: 20 });
      set({
        open: page.items,
        openTotal: page.total,
        categoryCounts: page.categoryCounts,
        loadedOpen: true,
      });
    } catch (e) {
      set({ error: isApiException(e) ? e.message : 'Could not load predictions.' });
    } finally {
      set({ loading: false });
    }
  },

  loadActive: async () => {
    set({ activeLoading: true, activeError: null });
    try {
      set({ active: await PredictionsRepository.active() });
    } catch (e) {
      set({ activeError: isApiException(e) ? e.message : 'Could not load your predictions.' });
    } finally {
      set({ activeLoading: false });
    }
  },

  loadHistory: async () => {
    try {
      const r = await PredictionsRepository.history();
      set({ history: r.items, historySummary: r.summary });
    } catch {
      /* keep previous */
    }
  },

  /**
   * Submit a pick. Returns the new balance, or null on failure (sets `error`).
   *
   * Resolves as soon as the submit call itself does — callers await this to
   * close the confirmation sheet / show a success toast. The open/active
   * refresh runs in the background, concurrently, and updates the UI once it
   * lands, instead of blocking the tap that triggered it (PO-47).
   */
  submit: async (predictionId, optionId, entryFee = 0) => {
    try {
      const r = await PredictionsRepository.submit(predictionId, optionId);
      set((s) => ({
        justSubmittedId: predictionId,
        justSubmittedOptionId: optionId,
        justSubmittedVersion: s.justSubmittedVersion + 1,
      }));
      void refreshAfterSubmit(get, set);
      MetaPixel.logPredictionSubmitted();
      if (entryFee > 0) MetaPixel.logSpentCredits();
      return r.balance;
    } catch (e) {
      set({ error: isApiException(e) ? e.message : 'Could not submit. Please try again.' });
      return null;
    }
  },

  /** Drops every list on sign-out so the next account starts clean. */
  reset: () =>
    set({
      open: [],
      active: [],
      history: [],
      historySummary: emptyHistorySummary,
      openTotal: 0,
      categoryCounts: {},
      loadedOpen: false,
      error: null,
      activeError: null,
      justSubmittedId: null,
      justSubmittedOptionId: null,
    }),
}));

async function refreshAfterSubmit(
  get: () => PredictionsState,
  set: (partial: Partial<PredictionsState> | ((s: PredictionsState) => Partial<PredictionsState>)) => void,
): Promise<void> {
  await Promise.all([
    get().loadOpen({ force: true }),
    get().loadActive(),
    get().loadHistory(),
  ]);
  set((s) => ({ submitVersion: s.submitVersion + 1 }));
}
