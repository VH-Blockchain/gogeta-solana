import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { Routes } from '@/router/routes';
import { clearPendingLocation, peekPendingLocation } from '@/router/pendingLocation';
import { useAuthStore } from '@/store/authStore';
import { WebTokens } from '@/theme/webTokens';
import { AuthPageScaffold } from '@/components/AuthPageScaffold';
import { GlowButton } from '@/components/GlowButton';
import { toast } from '@/hooks/useToast';
import { OtpStep } from './OtpStep';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Web sign-in. Uses the shared auth store end-to-end (live API), proving the
 * shared data layer works on web. Port of `WebLoginPage`.
 */
export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [obscure, setObscure] = useState(true);
  const [touched, setTouched] = useState(false);

  const authenticated = useAuthStore((s) => s.authenticated);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const unverifiedEmail = useAuthStore((s) => s.unverifiedEmail);
  const login = useAuthStore((s) => s.login);
  const clearUnverified = useAuthStore((s) => s.clearUnverified);

  const navigate = useNavigate();

  /**
   * Where to land once a session exists: the portal page the guard bounced away
   * from, else Predict (matching the app's post-login destination, not the
   * Dashboard). Peeked purely during render — see pendingLocation.ts — and
   * cleared by `landInPortal` at the moment it's actually used, so the
   * post-submit navigate and the already-authenticated redirect below can never
   * disagree about the target.
   */
  const postAuthTarget = peekPendingLocation() ?? Routes.predictions;
  const landInPortal = () => {
    clearPendingLocation();
    navigate(postAuthTarget, { replace: true });
  };

  // Leaving this page must not strand the OTP step for the next visit.
  useEffect(() => () => clearUnverified(), [clearUnverified]);

  // The redirect below captured `postAuthTarget` from a pure peek; retiring the
  // stored value belongs here, after render, so StrictMode's double render can
  // never see it half-consumed.
  useEffect(() => {
    if (authenticated) clearPendingLocation();
  }, [authenticated]);

  const emailError = !touched
    ? null
    : email.trim().length === 0
      ? 'Email is required'
      : !EMAIL_RE.test(email.trim())
        ? 'Enter a valid email'
        : null;
  const passwordError = !touched ? null : password.length === 0 ? 'Password is required' : null;

  /**
   * An already-signed-in visitor bounces into the portal — to the deep-linked
   * page they were originally headed for, else Predict (matching the app's
   * post-login destination, not the Dashboard).
   */
  if (authenticated && unverifiedEmail == null) {
    return <Navigate to={postAuthTarget} replace />;
  }

  async function submit() {
    setTouched(true);
    if (email.trim().length === 0 || !EMAIL_RE.test(email.trim()) || password.length === 0) return;

    const ok = await login(email.trim(), password);
    if (ok) {
      landInPortal();
    } else if (useAuthStore.getState().unverifiedEmail == null) {
      toast(useAuthStore.getState().error ?? 'Sign in failed');
    }
    // unverifiedEmail != null: correct credentials but the account never
    // completed OTP verification — fall through to the OTP step below instead
    // of erroring.
  }

  if (unverifiedEmail != null) {
    return (
      <AuthPageScaffold>
        <OtpStep
          email={unverifiedEmail}
          onVerified={landInPortal}
        />
      </AuthPageScaffold>
    );
  }

  return (
    <AuthPageScaffold>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: 'flex', flexDirection: 'column' }}
      >
        <h1 className="t-headline-small">Welcome back</h1>
        <p className="t-body-medium" style={{ marginTop: 8, color: WebTokens.textSecondary }}>
          Sign in to continue predicting.
        </p>

        <div style={{ height: 28 }} />

        <input
          className="field"
          type="email"
          value={email}
          placeholder="Email"
          aria-label="Email"
          autoComplete="email"
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setTouched(true)}
        />
        {emailError && <span className="field-error">{emailError}</span>}

        <div style={{ height: 14 }} />

        <div style={{ position: 'relative' }}>
          <input
            className="field"
            type={obscure ? 'password' : 'text'}
            value={password}
            placeholder="Password"
            aria-label="Password"
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setTouched(true)}
            style={{ paddingRight: 48 }}
          />
          <button
            type="button"
            aria-label={obscure ? 'Show password' : 'Hide password'}
            onClick={() => setObscure((v) => !v)}
            style={{
              position: 'absolute',
              right: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: WebTokens.textMuted,
              display: 'inline-flex',
            }}
          >
            {obscure ? (
              <VisibilityOffIcon sx={{ fontSize: 20 }} />
            ) : (
              <VisibilityIcon sx={{ fontSize: 20 }} />
            )}
          </button>
        </div>
        {passwordError && <span className="field-error">{passwordError}</span>}

        <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
          <Link
            to={Routes.forgotPassword}
            className="btn-text"
            style={{ color: WebTokens.textSecondary, fontSize: 13 }}
          >
            Forgot password?
          </Link>
        </div>

        <div style={{ height: 18 }} />

        <GlowButton label="Sign in" fullWidth busy={loading} onClick={() => void submit()} type="submit" />

        {error != null && !loading && <span className="field-error">{error}</span>}

        <div style={{ height: 20 }} />

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
          <span style={{ color: WebTokens.textSecondary, fontSize: 14 }}>New here?</span>
          <Link
            to={Routes.register}
            style={{ color: WebTokens.accent, fontSize: 14, fontWeight: 400 }}
          >
            Create an account
          </Link>
        </div>
      </form>
    </AuthPageScaffold>
  );
}
