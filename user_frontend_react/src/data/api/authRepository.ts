import { ApiClient } from '@/core/network/apiClient';
import type { AppUser } from '../models';
import { userFromApi } from '../mappers';

export interface AuthResult {
  token: string;
  user: AppUser;
}

/**
 * Result of a successful register() call: the account exists but is
 * unverified — no session yet, just the freshly-issued OTP's metadata.
 */
export interface RegisterOutcome {
  email: string;
  name: string;
  otpExpiresAt: Date;
  /** dev builds only */
  otp?: string | null;
}

/** Result of a successful resend-otp call. */
export interface OtpIssued {
  otpExpiresAt?: Date | null;
  /** dev builds only */
  otp?: string | null;
  alreadyVerified: boolean;
}

function toResult(data: any): AuthResult {
  return { token: data.token as string, user: userFromApi(data.user) };
}

/** Talks to the backend /auth and /users/me endpoints. */
export const AuthRepository = {
  async login(email: string, password: string): Promise<AuthResult> {
    return toResult(await ApiClient.post('/auth/login', { email, password }));
  },

  /**
   * Creates the account and emails a verification OTP. No session is granted
   * yet — call verifyOtp with the code to get a token.
   */
  async register(name: string, email: string, password: string): Promise<RegisterOutcome> {
    const m: any = await ApiClient.post('/auth/register', { name, email, password });
    return {
      email: m.email as string,
      name: m.name as string,
      otpExpiresAt: new Date(m.otpExpiresAt as string),
      otp: (m.otp as string | undefined) ?? null,
    };
  },

  /**
   * Requests a fresh verification OTP (registration flow). Throws an
   * ApiException with code "OTP_COOLDOWN" if called too soon after the last.
   */
  async resendOtp(email: string): Promise<OtpIssued> {
    const m: any = await ApiClient.post('/auth/resend-otp', { email });
    if (m.alreadyVerified === true) return { alreadyVerified: true };
    return {
      otpExpiresAt: m.otpExpiresAt ? new Date(m.otpExpiresAt as string) : null,
      otp: (m.otp as string | undefined) ?? null,
      alreadyVerified: false,
    };
  },

  async me(): Promise<AppUser> {
    return userFromApi((await ApiClient.get('/users/me')) as Record<string, any>);
  },

  /**
   * Requests a password-reset code for `email`. Returns the OTP when the
   * backend exposes it (non-production builds only), otherwise null.
   */
  async forgotPassword(email: string): Promise<string | null> {
    const m: any = await ApiClient.post('/auth/forgot-password', { email });
    return (m?.otp as string | undefined) ?? null;
  },

  /**
   * Validates a reset code WITHOUT consuming it (so the UI can gate the
   * new-password step). Throws an ApiException on an invalid/expired code.
   */
  async verifyResetCode(email: string, code: string): Promise<void> {
    await ApiClient.post('/auth/verify-reset-code', { email, code });
  },

  /** Completes a password reset using the code sent to `email`. */
  async resetPassword(email: string, code: string, newPassword: string): Promise<void> {
    await ApiClient.post('/auth/reset-password', { email, code, newPassword });
  },

  /**
   * Changes the signed-in user's password given their current one — no OTP,
   * since knowing the current password already proves identity. Throws an
   * ApiException if `currentPassword` doesn't match.
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await ApiClient.patch('/users/me/password', { currentPassword, newPassword });
  },

  /**
   * Verifies an account-verification code. On success the backend marks the
   * account verified and returns a real session token, same shape as login.
   */
  async verifyOtp(email: string, code: string): Promise<AuthResult> {
    return toResult(await ApiClient.post('/auth/verify-otp', { email, code }));
  },
};
