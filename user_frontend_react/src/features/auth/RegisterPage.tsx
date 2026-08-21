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

/**
 * Web registration (SOW: +1000 coins + Welcome badge on signup, account
 * verification via OTP). Account creation issues an emailed OTP but grants no
 * session until the OTP step verifies it — mirroring the backend contract and
 * the mobile app's register -> OTP -> session flow. Port of `WebRegisterPage`.
 */
export function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [obscure, setObscure] = useState(true);
  const [verifying, setVerifying] = useState(false);
  // Matches the mobile app's register screen default.
  const [agree, setAgree] = useState(true);

  const authenticated = useAuthStore((s) => s.authenticated);
  const loading = useAuthStore((s) => s.loading);
  const register = useAuthStore((s) => s.register);
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

  // The redirect below captured `postAuthTarget` from a pure peek; retiring the
  // stored value belongs here, after render, so StrictMode's double render can
  // never see it half-consumed.
  useEffect(() => {
    if (authenticated) clearPendingLocation();
  }, [authenticated]);

  if (authenticated && !verifying) {
    return <Navigate to={postAuthTarget} replace />;
  }

  async function submit() {
    if (name.trim().length === 0 || email.trim().length === 0 || password.length === 0) {
      toast('Please fill in all fields.');
      return;
    }
    if (password !== confirm) {
      toast('Passwords do not match.');
      return;
    }
    const error = await register(name.trim(), email.trim(), password);
    if (error == null) setVerifying(true);
    else toast(error);
  }

  if (verifying) {
    return (
      <AuthPageScaffold>
        <OtpStep
          email={email.trim()}
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
        <h1 className="t-headline-small">Create your account</h1>
        <p style={{ marginTop: 8, color: WebTokens.textSecondary, fontSize: 14 }}>
          Sign up and start making your calls.
        </p>

        <div style={{ height: 28 }} />

        <input
          className="field"
          value={name}
          placeholder="Full name"
          aria-label="Full name"
          autoComplete="name"
          onChange={(e) => setName(e.target.value)}
        />

        <div style={{ height: 14 }} />

        <input
          className="field"
          type="email"
          value={email}
          placeholder="Email"
          aria-label="Email"
          autoComplete="email"
          onChange={(e) => setEmail(e.target.value)}
        />

        <div style={{ height: 14 }} />

        <div style={{ position: 'relative' }}>
          <input
            className="field"
            type={obscure ? 'password' : 'text'}
            value={password}
            placeholder="Password"
            aria-label="Password"
            autoComplete="new-password"
            onChange={(e) => setPassword(e.target.value)}
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

        <div style={{ height: 14 }} />

        <input
          className="field"
          type={obscure ? 'password' : 'text'}
          value={confirm}
          placeholder="Confirm password"
          aria-label="Confirm password"
          autoComplete="new-password"
          onChange={(e) => setConfirm(e.target.value)}
        />

        <div style={{ height: 18 }} />

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            style={{ width: 18, height: 18, marginTop: 1, accentColor: WebTokens.accent }}
          />
          <span style={{ color: WebTokens.textSecondary, fontSize: 13, lineHeight: 1.4 }}>
            I agree to the{' '}
            <Link
              to={Routes.terms}
              style={{ color: WebTokens.accent, fontWeight: 600 }}
              onClick={(e) => e.stopPropagation()}
            >
              Terms
            </Link>{' '}
            &amp;{' '}
            <Link
              to={Routes.privacy}
              style={{ color: WebTokens.accent, fontWeight: 600 }}
              onClick={(e) => e.stopPropagation()}
            >
              Privacy Policy
            </Link>
          </span>
        </label>

        <div style={{ height: 18 }} />

        <GlowButton
          label="Create account"
          fullWidth
          busy={loading}
          onClick={agree ? () => void submit() : null}
          type="submit"
        />

        <div style={{ height: 20 }} />

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
          <span style={{ color: WebTokens.textSecondary, fontSize: 14 }}>
            Already have an account?
          </span>
          <Link to={Routes.login} style={{ color: WebTokens.accent, fontSize: 14, fontWeight: 600 }}>
            Sign in
          </Link>
        </div>
      </form>
    </AuthPageScaffold>
  );
}
