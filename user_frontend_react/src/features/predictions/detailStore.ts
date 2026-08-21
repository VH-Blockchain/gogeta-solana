import { create } from 'zustand';
import type { Prediction } from '@/data/models';

interface DetailState {
  prediction: Prediction | null;
  open: (p: Prediction) => void;
  close: () => void;
}

/**
 * Which prediction's detail panel is open. A single store rather than local
 * state per grid, because the panel is mounted once at the shell level — the
 * React equivalent of Flutter's `showGeneralDialog`, which likewise pushed
 * one route above whatever page triggered it.
 */
export const useDetailStore = create<DetailState>((set) => ({
  prediction: null,
  open: (p) => set({ prediction: p }),
  close: () => set({ prediction: null }),
}));

/** Imperative helper so grids can pass this straight to ArenaCard. */
export const showPredictionDetail = (p: Prediction): void => useDetailStore.getState().open(p);
