import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { WebTokens, cardShadow, panelFill } from '@/theme/webTokens';
import './Modal.css';

/**
 * Full-screen backdrop blur + dim behind a dialog's actual content, instead
 * of a flat barrier color. Port of `BlurredBarrier` + `showDialog`'s barrier:
 * clicking the backdrop dismisses (Flutter's `barrierDismissible: true`), and
 * Escape does too.
 */
export function Modal({
  open,
  onClose,
  children,
  align = 'center',
  dimOpacity = 0.45,
  /** Blocks backdrop/Escape dismissal while a submit is in flight (PopScope). */
  dismissible = true,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  align?: 'center' | 'right';
  dimOpacity?: number;
  dismissible?: boolean;
  labelledBy?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, dismissible, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className={`modal modal--${align}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && dismissible) onClose();
      }}
      style={{ ['--modal-dim' as string]: String(dimOpacity) }}
    >
      <div className="modal__scrim" style={{ background: `rgba(0,0,0,${dimOpacity})` }} />
      <div className={`modal__body modal__body--${align}`}>{children}</div>
    </div>,
    document.body,
  );
}

/**
 * The standard dialog card the portal uses for every confirm/filter/congrats
 * modal: the panel gradient, glass stroke, card radius, layered shadow, and a
 * height cap so a long body scrolls inside instead of overflowing the screen.
 */
export function DialogCard({
  children,
  maxWidth = 460,
  padding = '24px 24px 20px',
}: {
  children: ReactNode;
  maxWidth?: number;
  padding?: string;
}) {
  return (
    <div
      style={{
        width: '100%',
        maxWidth,
        maxHeight: 'calc(100vh - 48px)',
        display: 'flex',
        flexDirection: 'column',
        // The height cap above is only half the job: without an overflow rule,
        // a body taller than the cap simply renders past it and `.modal`'s own
        // `overflow: hidden` clips it at the viewport edge — putting the action
        // row out of reach with no way to scroll to it. Every dialog that uses
        // this card is a fixed design that grows on smaller viewports or at
        // 100% browser zoom, so this has to be here rather than per-dialog.
        overflowY: 'auto',
        // Stops a flick past the end of the dialog from scrolling the page
        // behind it, which would move the content the modal is layered over.
        overscrollBehavior: 'contain',
        padding,
        background: panelFill,
        border: `1px solid ${WebTokens.glassStroke}`,
        borderRadius: WebTokens.radiusCard,
        boxShadow: cardShadow,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Flutter's AlertDialog — the simpler surface used by the sign-out and
 * change-password prompts (surfaceAlt fill, 20px radius, actions row).
 */
export function AlertDialogCard({
  title,
  children,
  actions,
  width = 360,
}: {
  title: string;
  children?: ReactNode;
  actions: ReactNode;
  width?: number;
}) {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: width,
        maxHeight: 'calc(100vh - 48px)',
        overflowY: 'auto',
        padding: 24,
        background: WebTokens.surfaceAlt,
        border: `1px solid ${WebTokens.borderStrong}`,
        borderRadius: 20,
        boxShadow: cardShadow,
      }}
    >
      <h2 className="t-title-large" style={{ fontSize: 20 }}>
        {title}
      </h2>
      {children && <div style={{ marginTop: 14 }}>{children}</div>}
      <div
        style={{
          marginTop: 22,
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {actions}
      </div>
    </div>
  );
}
