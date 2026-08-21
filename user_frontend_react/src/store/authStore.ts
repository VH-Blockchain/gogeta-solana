import { create } from 'zustand';
import { isApiException } from '@/core/network/apiException';
import { TokenStore } from '@/core/network/tokenStore';
import { MetaPixel } from '@/core/analytics/metaPixel';
import { AuthRepository, type AuthResult } from '@/data/api/authRepository';
import { UserRepository } from '@/data/api/userRepository';
import { useUserStore } from './userStore';

interface AuthState {
  authenticated: boolean;
  loading: boolean;
  error: string | null;

  /**
   * True from construction until `tryAutoLogin` resolves (token missing,
   * valid, or rejected) — lets the router guard hold off on deciding
   * login-vs-portal instead of bouncing to /login and immediately back once
   * the stored session turns out to be valid.
   */
  restoring: boolean;

  /**
   * Set when `login` fails specifically because the account is unverified
   * (backend 403 ACCOUNT_NOT_VERIFIED) — the screen routes to the OTP step
   * instead of just showing an error. Null for every other outcome.
   */
  unverifiedEmail: string | null;

  /**
   * Seconds remaining on a resend-otp cooldown reported by the backend (set
   * only when `resendOtp` hits it), so the OTP screen's countdown can stay in
   * sync with the server instead of drifting from its own timer.
   */
  otpCooldownSeconds: number | null;

  /**
   * Expiry of the currently active OTP challenge (register/resend), used to
   * seed the OTP screen's countdown accurately instead of a hardcoded guess.
   */
  otpExpiresAt: Date | null;

  /**
   * Dev-only: the backend echoes the OTP (registration or password-reset)
   * outside production so the flow is testable before real email delivery is
   * wired. Null in production.
   */
  lastDevOtp: string | null;

  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string) => Promise<string | null>;
  verifyOtp: (email: string, code: string) => Promise<string | null>;
  resendOtp: (email: string) => Promise<string | null>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<string | null>;
  tryAutoLogin: () => Promise<boolean>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<string | null>;
  sendResetCode: (email: string) => Promise<string | null>;
  verifyResetCode: (email: string, code: string) => Promise<string | null>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<string | null>;
  clearUnverified: () => void;
}

const GENERIC = 'Something went wrong. Please try again.';

/**
 * Real authentication against the backend (JWT persisted in local storage).
 * Port of AuthProvider.
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  authenticated: false,
  loading: false,
  error: null,
  restoring: true,
  unverifiedEmail: null,
  otpCooldownSeconds: null,
  otpExpiresAt: null,
  lastDevOtp: null,

  login: async (email, password) => {
    set({ loading: true, error: null, unverifiedEmail: null });
    try {
      const result = await AuthRepository.login(email.trim(), password);
      await completeSession(set, result);
      return true;
    } catch (e) {
      if (isApiException(e) && e.code === 'ACCOUNT_NOT_VERIFIED') {
        set({
          loading: false,
          unverifiedEmail: (e.data?.email as string | undefined) ?? email.trim(),
        });
      } else {
        set({ loading: false, error: isApiException(e) ? e.message : GENERIC });
      }
      return false;
    }
  },

  /**
   * Creates the account and emails a verification OTP. Returns null on
   * success (caller should show the OTP step) — no session is granted until
   * verifyOtp succeeds. Returns a user-facing error message on failure.
   */
  register: async (name, email, password) => {
    set({ loading: true, error: null });
    try {
      const r = await AuthRepository.register(name.trim(), email.trim(), password);
      set({ lastDevOtp: r.otp ?? null, otpExpiresAt: r.otpExpiresAt, loading: false });
      return null;
    } catch (e) {
      const message = isApiException(e) ? e.message : GENERIC;
      set({ error: message, loading: false });
      return message;
    }
  },

  /**
   * Verifies the registration OTP. On success the backend marks the account
   * verified and returns a real session — completes login. Returns null on
   * success, else a user-facing error message.
   */
  verifyOtp: async (email, code) => {
    try {
      const result = await AuthRepository.verifyOtp(email.trim(), code.trim());
      await completeSession(set, result);
      MetaPixel.logCompleteRegistration();
      return null;
    } catch (e) {
      return isApiException(e) ? e.message : GENERIC;
    }
  },

  /**
   * Requests a fresh registration-verification OTP. Returns null on success,
   * else a user-facing error message (`otpCooldownSeconds` is set when the
   * failure was a cooldown, so the UI can sync its countdown).
   */
  resendOtp: async (email) => {
    set({ otpCooldownSeconds: null });
    try {
      const r = await AuthRepository.resendOtp(email.trim());
      if (r.alreadyVerified) return 'This email is already verified — please log in.';
      set({ lastDevOtp: r.otp ?? null, otpExpiresAt: r.otpExpiresAt ?? null });
      return null;
    } catch (e) {
      if (isApiException(e)) {
        if (e.code === 'OTP_COOLDOWN') {
          const retry = e.data?.retryAfterSeconds;
          const seconds = typeof retry === 'number' ? retry : Number.parseInt(String(retry), 10);
          set({ otpCooldownSeconds: Number.isNaN(seconds) ? null : seconds });
        }
        return e.message;
      }
      return GENERIC;
    }
  },

  /**
   * Changes the signed-in user's password given their current one. Null on
   * success, else a user-facing error message (e.g. wrong current password).
   */
  changePassword: async (currentPassword, newPassword) => {
    try {
      await AuthRepository.changePassword(currentPassword, newPassword);
      return null;
    } catch (e) {
      return isApiException(e) ? e.message : GENERIC;
    }
  },

  /** Restore a session from a stored token (used on portal boot). */
  tryAutoLogin: async () => {
    const token = TokenStore.read();
    if (!token) {
      set({ restoring: false });
      return false;
    }
    try {
      useUserStore.getState().setUser(await UserRepository.profile());
      set({ authenticated: true, restoring: false });
      return true;
    } catch {
      TokenStore.clear();
      set({ restoring: false });
      return false;
    }
  },

  logout: async () => {
    TokenStore.clear();
    set({
      authenticated: false,
      unverifiedEmail: null,
      otpCooldownSeconds: null,
      otpExpiresAt: null,
      lastDevOtp: null,
    });
  },

  /**
   * Deletes the account server-side, then clears the local session.
   * Returns null on success, else a user-facing error message.
   */
  deleteAccount: async () => {
    try {
      await UserRepository.deleteAccount();
      await get().logout();
      return null;
    } catch (e) {
      return isApiException(e) ? e.message : GENERIC;
    }
  },

  /** Requests a password-reset code. Returns null on success, else an error. */
  sendResetCode: async (email) => {
    try {
      set({ lastDevOtp: await AuthRepository.forgotPassword(email.trim()) });
      return null;
    } catch (e) {
      return isApiException(e) ? e.message : GENERIC;
    }
  },

  /**
   * Checks the emailed reset code is valid (without consuming it) before the
   * user is allowed onto the new-password screen.
   */
  verifyResetCode: async (email, code) => {
    try {
      await AuthRepository.verifyResetCode(email.trim(), code.trim());
      return null;
    } catch (e) {
      return isApiException(e) ? e.message : GENERIC;
    }
  },

  /** Sets a new password using the emailed code. Null on success, else error. */
  resetPassword: async (email, code, newPassword) => {
    try {
      await AuthRepository.resetPassword(email.trim(), code.trim(), newPassword);
      return null;
    } catch (e) {
      return isApiException(e) ? e.message : GENERIC;
    }
  },

  clearUnverified: () => set({ unverifiedEmail: null }),
}));

/**
 * Persists the token, loads the enriched profile (badges + rank, falling
 * back to the basic user on failure), and marks the session authenticated.
 * Shared by login and verifyOtp — the only two calls that ever receive a
 * real token.
 */
async function completeSession(
  set: (partial: Partial<AuthState>) => void,
  result: AuthResult,
): Promise<void> {
  TokenStore.save(result.token);
  try {
    useUserStore.getState().setUser(await UserRepository.profile());
  } catch {
    useUserStore.getState().setUser(result.user);
  }
  set({ authenticated: true, loading: false, unverifiedEmail: null });
}
