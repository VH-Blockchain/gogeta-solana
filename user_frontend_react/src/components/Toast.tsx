import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { WebTokens, cardShadow } from '@/theme/webTokens';
import { useToastStore, type ToastMessage } from '@/hooks/useToast';
import './Toast.css';

/**
 * Flutter's SnackBar surface. Mounted once at the app root — the equivalent
 * of MaterialApp's scaffoldMessengerKey, so any store or component can
 * surface a message.
 */
export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return createPortal(
    <div className="toast-host" role="status" aria-live="polite">
      {toasts.map((t) => (
        <ToastRow key={t.id} toast={t} />
      ))}
    </div>,
    document.body,
  );
}

function ToastRow({ toast }: { toast: ToastMessage }) {
  const dismiss = useToastStore((s) => s.dismiss);

  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(toast.id), toast.durationMs);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.durationMs, dismiss]);

  return (
    <div className="toast" style={{ boxShadow: cardShadow }}>
      <span className="toast__text">{toast.text}</span>
      {toast.action && (
        <button
          type="button"
          className="toast__action"
          onClick={() => {
            toast.action?.onPress();
            dismiss(toast.id);
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        className="toast__close"
        aria-label="Dismiss"
        onClick={() => dismiss(toast.id)}
        style={{ color: WebTokens.textMuted }}
      >
        ×
      </button>
    </div>
  );
}
