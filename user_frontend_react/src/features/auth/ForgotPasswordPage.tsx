import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Routes } from '@/router/routes';
import { useAuthStore } from '@/store/authStore';
import { WebTokens } from '@/theme/webTokens';
import { AuthPageScaffold } from '@/components/AuthPageScaffold';
import { GlowButton } from '@/components/GlowButton';
import { OtpBoxField } from '@/components/OtpBoxField';
import { toast } from '@/hooks/useToast';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Backend OTPs are 4 digits (auth.service.ts's issueOtp()). */
const CODE_LENGTH = 4;

const SUBTITLES = [
  "Enter your account email and we'll send you a reset code.",
  `Enter the ${CODE_LENGTH}-digit code we sent to your email.`,
  'Choose a new password for your account.',
];

const CTA_LABELS = ['Send code', 'Verify code', 'Update password'];

/** Three-step reset wizard: email -> code -> new password. */
export function ForgotPasswordPage() {
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);

  const sendResetCode = useAuthStore((s) => s.sendResetCode);
  const verifyResetCode = useAuthStore((s) => s.verifyResetCode);
  const resetPassword = useAuthStore((s) => s.resetPassword);
  const navigate = useNavigate();

  const emailError = !emailTouched
    ? null
    : email.trim().length === 0
      ? 'Email is required'
      : !EMAIL_RE.test(email.trim())
        ? 'Enter a valid email'
        : null;

  async function run(action: () => Promise<string | null>, onDone?: string) {
    setBusy(true);
    const error = await action();
    setBusy(false);
    if (error != null) {
      toast(error);
      return false;
    }
    if (onDone) toast(onDone);
    return true;
  }

  async function handleSendCode() {
    setEmailTouched(true);
    if (email.trim().length === 0 || !EMAIL_RE.test(email.trim())) return;
    const ok = await run(() => sendResetCode(email), 'Reset code sent to your email.');
    if (ok) setStep(1);
  }

  async function handleVerifyCode() {
    if (code.trim().length < CODE_LENGTH) {
      toast(`Enter the ${CODE_LENGTH}-digit code.`);
      return;
    }
    const ok = await run(() => verifyResetCode(email, code));
    if (ok) setStep(2);
  }

  async function handleReset() {
    if (password.length === 0) {
      toast('Enter a new password.');
      return;
    }
    const ok = await run(() => resetPassword(email, code, password));
    if (ok) {
      toast('Password updated — sign in with your new password.');
      navigate(Routes.login, { replace: true });
    }
  }

  const onCta = [handleSendCode, handleVerifyCode, handleReset][step];

  return (
    <AuthPageScaffold>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <h1 className="t-headline-small">Reset password</h1>
        <p style={{ marginTop: 8, color: WebTokens.textSecondary, fontSize: 14 }}>
          {SUBTITLES[step]}
        </p>

        <div style={{ height: 20 }} />
        <StepDots step={step} />
        <div style={{ height: 20 }} />

        {step === 0 ? (
          <>
            <input
              className="field"
              type="email"
              value={email}
              placeholder="Email"
              aria-label="Email"
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setEmailTouched(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSendCode();
              }}
            />
            {emailError && <span className="field-error">{emailError}</span>}
          </>
        ) : step === 1 ? (
          <>
            <span style={{ color: WebTokens.textSecondary, fontSize: 13 }}>Enter code</span>
            <div style={{ height: 8 }} />
            <OtpBoxField
              value={code}
              onChange={setCode}
              length={CODE_LENGTH}
              onSubmit={() => void handleVerifyCode()}
            />
          </>
        ) : (
          <input
            className="field"
            type="password"
            value={password}
            placeholder="New password"
            aria-label="New password"
            autoComplete="new-password"
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleReset();
            }}
          />
        )}

        <div style={{ height: 22 }} />

        <GlowButton label={CTA_LABELS[step]} fullWidth busy={busy} onClick={() => void onCta()} />

        <div style={{ height: 18 }} />

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Link to={Routes.login} style={{ color: WebTokens.textSecondary, fontSize: 13 }}>
            ← Back to sign in
          </Link>
        </div>
      </div>
    </AuthPageScaffold>
  );
}

function StepDots({ step }: { step: number }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            background: i <= step ? WebTokens.accent : WebTokens.surfaceHover,
            transition: 'background 200ms ease',
          }}
        />
      ))}
    </div>
  );
}
