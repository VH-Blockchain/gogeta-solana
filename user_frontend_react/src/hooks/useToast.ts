import { create } from 'zustand';

export interface ToastMessage {
  id: number;
  text: string;
  /** Optional trailing action, e.g. the push notification's "View" button. */
  action?: { label: string; onPress: () => void };
  durationMs: number;
}

interface ToastState {
  toasts: ToastMessage[];
  show: (
    text: string,
    opts?: { action?: ToastMessage['action']; durationMs?: number },
  ) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

/**
 * Flutter's ScaffoldMessenger.showSnackBar, as a store so any module — not
 * just a component with a BuildContext — can surface a message (the push
 * handler needs exactly that).
 */
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  show: (text, opts = {}) =>
    set((s) => ({
      toasts: [
        ...s.toasts,
        { id: nextId++, text, action: opts.action, durationMs: opts.durationMs ?? 4000 },
      ],
    })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative helper for non-component call sites. */
export const toast = (text: string, opts?: Parameters<ToastState['show']>[1]): void =>
  useToastStore.getState().show(text, opts);
