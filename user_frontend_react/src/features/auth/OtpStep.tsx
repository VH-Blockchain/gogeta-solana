import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { WebTokens, withAlpha } from '@/theme/webTokens';
import { GlowButton } from '@/components/GlowButton';
import { OtpBoxField } from '@/components/OtpBoxField';
import { toast } from '@/hooks/useToast';

/** Fallback if the server didn't report otpExpiresAt. */
const DEFAULT_EXPIRY_SECONDS = 5 * 60;
/** UX default; the server may report a different remainder. */
const RESEND_COOLDOWN = 30;

/**
 * Inline OTP-entry step shared by register (post-signup) and login (an
 * unverified account) — verifies the registration OTP via the shared auth store
 * and completes the session on success. Port of `WebOtpStep`.
 */
export function OtpStep({ email, onVerified }: { email: string; onVerified: () => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendLeft, setResendLeft] = useState(RESEND_COOLDOWN);
  const [expiryLeft, setExpiryLeft] = useState(DEFAULT_EXPIRY_SECONDS);

  const verifyOtp = useAuthStore((s) => s.verifyOtp);
  const resendOtpAction = useAuthStore((s) => s.resendOtp);
  // Only ever non-null when the backend is running outside production —
  // see auth.service.ts's devOtp(). In production this stays null and the
  // hint below never renders.
  const devOtp = useAuthStore((s) => s.lastDevOtp);

  const tickerRef = useRef<number>(0);

  /**
   * Seeds expiry from the server-reported otpExpiresAt (set by register/resend)
   * and the resend cooldown from otpCooldownSeconds when the server just
   * reported one.
   */
  const startTimers = useCallback(() => {
    const { otpExpiresAt, otpCooldownSeconds } = useAuthStore.getState();
    const remaining =
      otpExpiresAt != null
        ? Math.min(
            Math.max(Math.floor((otpExpiresAt.getTime() - Date.now()) / 1000), 0),
            DEFAULT_EXPIRY_SECONDS * 10,
          )
        : DEFAULT_EXPIRY_SECONDS;
    setExpiryLeft(remaining);
    setResendLeft(otpCooldownSeconds ?? RESEND_COOLDOWN);

    window.clearInterval(tickerRef.current);
    tickerRef.current = window.setInterval(() => {
      setResendLeft((v) => (v > 0 ? v - 1 : 0));
      setExpiryLeft((v) => (v > 0 ? v - 1 : 0));
    }, 1000);
  }, []);

  useEffect(() => {
    startTimers();
    return () => window.clearInterval(tickerRef.current);
  }, [startTimers]);

  useEffect(() => {
    if (resendLeft === 0 && expiryLeft === 0) window.clearInterval(tickerRef.current);
  }, [resendLeft, expiryLeft]);

  const expired = expiryLeft === 0;
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  async function verify() {
    if (busy || code.trim().length === 0) return;
    setBusy(true);
    const error = await verifyOtp(email, code.trim());
    setBusy(false);
    if (error != null) {
      toast(error);
      return;
    }
    onVerified();
  }

  async function resend() {
    if (resendLeft > 0) return;
    const error = await resendOtpAction(email);
    const { lastDevOtp, otpCooldownSeconds } = useAuthStore.getState();
    if (error == null) {
      setCode('');
      startTimers();
    } else if (otpCooldownSeconds != null) {
      setResendLeft(otpCooldownSeconds);
    }
    toast(error ?? (lastDevOtp != null ? `Code resent — dev: ${lastDevOtp}` : 'Code resent.'));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <h1 className="t-headline-small">Verify your email</h1>
      <p style={{ marginTop: 8, color: WebTokens.textSecondary, fontSize: 14 }}>
        Enter the code we sent to {email}.
      </p>

      <div style={{ height: 20 }} />

      <span style={{ color: WebTokens.textSecondary, fontSize: 13 }}>Enter code</span>
      <div style={{ height: 8 }} />
      <OtpBoxField value={code} onChange={setCode} onSubmit={() => void verify()} />

      {devOtp != null && (
        <button
          type="button"
          onClick={() => setCode(devOtp)}
          title="Development build — click to fill"
          style={{
            marginTop: 10,
            alignSelf: 'flex-start',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            background: withAlpha(WebTokens.gold, 0.12),
            border: `1px solid ${withAlpha(WebTokens.gold, 0.4)}`,
            borderRadius: 999,
            color: WebTokens.gold,
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          DEV CODE {devOtp} — tap to fill
        </button>
      )}

      <p
        style={{
          marginTop: 8,
          color: expired ? WebTokens.danger : WebTokens.textMuted,
          fontSize: 12.5,
        }}
      >
        {expired
          ? 'Code expired — resend to get a new one.'
          : `Code expires in ${mmss(expiryLeft)}`}
      </p>

      <div style={{ height: 18 }} />

      <GlowButton
        label="Verify & continue"
        fullWidth
        busy={busy}
        onClick={() => void verify()}
      />

      <div style={{ height: 14 }} />

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button
          type="button"
          className="btn-text"
          disabled={resendLeft > 0}
          onClick={() => void resend()}
          style={{
            color: resendLeft === 0 ? WebTokens.accent : WebTokens.textMuted,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {resendLeft === 0 ? 'Resend code' : `Resend in ${mmss(resendLeft)}`}
        </button>
      </div>
    </div>
  );
}
