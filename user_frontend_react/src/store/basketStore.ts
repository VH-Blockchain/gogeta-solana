import { create } from 'zustand';
import type { Prediction, PredictionOption } from '@/data/models';

/**
 * One basket entry: the full prediction + chosen option, captured at
 * selection time — NOT re-looked-up later from some other list. An ID-only
 * basket resolved back to a Prediction/Option at submit time by searching
 * the shared open list silently dropped any pick made on a card outside that
 * fixed first-page snapshot — exactly the class of bug the Open grid's real
 * pagination makes reachable.
 */
export interface PickLine {
  prediction: Prediction;
  option: PredictionOption;
}

interface BasketState {
  picks: Record<string, PickLine>;
  toggle: (prediction: Prediction, option: PredictionOption) => void;
  clear: () => void;
}

/**
 * Holds the user's in-progress multi-pick basket on the Predict page: a
 * chosen option per prediction, submitted together. Port of
 * WebPredictBasketProvider.
 */
export const useBasketStore = create<BasketState>((set) => ({
  picks: {},

  /** Tap an option to select it; tapping the same option again clears it. */
  toggle: (prediction, option) =>
    set((s) => {
      const existing = s.picks[prediction.id];
      const next = { ...s.picks };
      if (existing && existing.option.id === option.id) {
        delete next[prediction.id];
      } else {
        next[prediction.id] = { prediction, option };
      }
      return { picks: next };
    }),

  clear: () => set((s) => (Object.keys(s.picks).length === 0 ? s : { picks: {} })),
}));

/**
 * Selector helpers. These deliberately return PRIMITIVES only: a selector that
 * built a new array/object on every call would give useSyncExternalStore a
 * fresh snapshot identity on every render and re-render forever. Call sites that
 * need the lines array select `picks` (a stable reference) and derive it with
 * useMemo.
 */
export const basketCount = (s: BasketState): number => Object.keys(s.picks).length;
export const basketOptionFor =
  (predictionId: string) =>
  (s: BasketState): string | null =>
    s.picks[predictionId]?.option.id ?? null;

/** Derives the ordered pick lines from the stable `picks` record. */
export const linesOf = (picks: Record<string, PickLine>): PickLine[] => Object.values(picks);
