import { create } from 'zustand';
import { isApiException } from '@/core/network/apiException';
import {
  PointsRepository,
  type PointPurchase,
  type PurchaseConfig,
} from '@/data/api/pointsRepository';
import { useUserStore } from './userStore';

interface PointsState {
  config: PurchaseConfig | null;
  configLoading: boolean;
  configError: string | null;
  /** True once a config fetch has completed, successfully or not. */
  configLoaded: boolean;

  /**
   * Whether the Buy Points dialog is open.
   *
   * Kept in the store rather than in a component because the button lives in the
   * topbar (visible on every page) while the Points page has one too — a local
   * flag in each would mean two dialog instances and two wallet subscriptions.
   */
  buyOpen: boolean;

  purchases: PointPurchase[];
  purchasesTotal: number;
  purchasedPoints: number;
  usdcSpent: string;
  historyLoading: boolean;
  historyError: string | null;

  openBuy: () => void;
  closeBuy: () => void;
  /** Fetches the purchase config; skips the call if it already has one. */
  loadConfig: (opts?: { force?: boolean }) => Promise<void>;
  loadHistory: () => Promise<void>;
  /** Refreshes the balance shown in the shell after a credit. */
  refreshBalance: () => Promise<void>;
  reset: () => void;
}

const initial = {
  config: null,
  configLoading: false,
  configError: null,
  configLoaded: false,
  buyOpen: false,
  purchases: [],
  purchasesTotal: 0,
  purchasedPoints: 0,
  usdcSpent: '0',
  historyLoading: false,
  historyError: null,
};

/** Points-purchase config and history. The purchase flow itself is driven by
 *  the Buy Points dialog, which owns its own step state. */
export const usePointsStore = create<PointsState>((set, get) => ({
  ...initial,

  openBuy: () => {
    // The dialog needs the rate and the receiving address, and the topbar button
    // is reachable before any page has fetched them.
    void get().loadConfig();
    set({ buyOpen: true });
  },
  closeBuy: () => set({ buyOpen: false }),

  loadConfig: async ({ force = false } = {}) => {
    if (get().configLoaded && !force) return;
    set({ configLoading: true, configError: null });
    try {
      set({ config: await PointsRepository.purchaseConfig() });
    } catch (e) {
      set({
        configError: isApiException(e) ? e.message : 'Could not load the purchase options.',
      });
    } finally {
      set({ configLoading: false, configLoaded: true });
    }
  },

  loadHistory: async () => {
    set({ historyLoading: true, historyError: null });
    try {
      const page = await PointsRepository.history({ take: 20 });
      set({
        purchases: page.items,
        purchasesTotal: page.total,
        purchasedPoints: page.totals.pointsPurchased,
        usdcSpent: page.totals.usdcSpent,
      });
    } catch (e) {
      set({
        historyError: isApiException(e) ? e.message : 'Could not load your purchases.',
      });
    } finally {
      set({ historyLoading: false });
    }
  },

  refreshBalance: async () => {
    try {
      const b = await PointsRepository.balance();
      useUserStore.getState().setCoins(b.balance);
      set({ purchasedPoints: b.purchasedPoints, usdcSpent: b.usdcSpent });
    } catch {
      /* a stale balance is better than a broken screen */
    }
  },

  reset: () => set({ ...initial }),
}));
