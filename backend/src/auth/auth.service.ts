import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OtpPurpose, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { EconomyService } from '../economy/economy.service';
import { GamificationService } from '../gamification/gamification.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { isReviewAccount } from '../common/review-account';
import {
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResendOtpDto,
  ResetPasswordDto,
  VerifyOtpDto,
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger('Auth');

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly economy: EconomyService,
    private readonly gamification: GamificationService,
    private readonly mail: MailService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const username = await this.uniqueUsername(dto.name, email);
    const rules = await this.economy.getRules();
    const avatarSeed = Math.floor(Math.random() * 1000);

    // Registration grants the signup bonus (admin-configured) and the Welcome badge atomically.
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email, name: dto.name.trim(), username, passwordHash, avatarSeed, coins: 0 },
      });
      if (rules.signupBonus > 0 && !isReviewAccount(email)) {
        await this.economy.applyTxn(tx, created.id, 'SIGNUP_BONUS', rules.signupBonus, {
          description: 'Registration bonus',
        });
      }
      await this.gamification.awardBadge(tx, created.id, 'WELCOME');
      return tx.user.findUniqueOrThrow({ where: { id: created.id } });
    });

    // No JWT yet — the account is unverified until verifyOtp() succeeds.
    const { code, expiresAt } = await this.issueOtp(user.id, user.email, 'VERIFY_EMAIL');
    return {
      requiresVerification: true,
      email: user.email,
      name: user.name,
      otpExpiresAt: expiresAt.toISOString(),
      otp: this.devOtp(code),
    };
  }

  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Deliberately reveals account existence (product decision, overriding
    // the more common anti-enumeration generic message) so the client can
    // show "User not exist" distinctly from "wrong password".
    if (!user) {
      throw new NotFoundException({
        error: 'USER_NOT_FOUND',
        message: 'User not exist.',
      });
    }
    if (!(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException({
        error: 'INVALID_PASSWORD',
        message: 'Incorrect password.',
      });
    }
    if (user.isSuspended) throw new UnauthorizedException('Account suspended');
    if (!user.isVerified) {
      // Credentials are correct but the account was never OTP-verified — no
      // token is issued. The client routes to the OTP screen and calls
      // resend-otp itself; we don't auto-send here to avoid spamming on
      // repeated failed/blocked login attempts.
      throw new ForbiddenException({
        error: 'ACCOUNT_NOT_VERIFIED',
        email: user.email,
        message: 'Please verify your email before signing in.',
      });
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    });
    return this.tokenResponse(user);
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const user = await this.consumeOtp(dto.email, dto.code, 'VERIFY_EMAIL');
    const verified = await this.prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true, lastActiveAt: new Date() },
    });
    return { verified: true, ...this.tokenResponse(verified) };
  }

  async resendOtp(dto: ResendOtpDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });
    // Don't leak whether the email exists.
    if (!user) return { sent: true };
    if (user.isVerified) return { sent: false, alreadyVerified: true };

    const cooldownSeconds = Number(this.config.get('OTP_RESEND_COOLDOWN_SECONDS') ?? 45);
    const last = await this.prisma.otp.findFirst({
      where: { userId: user.id, purpose: 'VERIFY_EMAIL' },
      orderBy: { createdAt: 'desc' },
    });
    if (last) {
      const retryAfterMs = cooldownSeconds * 1000 - (Date.now() - last.createdAt.getTime());
      if (retryAfterMs > 0) {
        throw new BadRequestException({
          error: 'OTP_COOLDOWN',
          retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
          message: 'Please wait before requesting another code.',
        });
      }
    }

    const { code, expiresAt } = await this.issueOtp(user.id, user.email, 'VERIFY_EMAIL');
    return { sent: true, otpExpiresAt: expiresAt.toISOString(), otp: this.devOtp(code) };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });
    // Deliberately reveals account existence (product decision, overriding
    // the more common anti-enumeration generic response) so the client can
    // show "User not exist" instead of silently pretending a code was sent.
    if (!user) {
      throw new NotFoundException({
        error: 'USER_NOT_FOUND',
        message: 'User not exist.',
      });
    }
    const { code, expiresAt } = await this.issueOtp(user.id, user.email, 'RESET_PASSWORD');
    return { sent: true, otpExpiresAt: expiresAt.toISOString(), otp: this.devOtp(code) };
  }

  /** Validates a reset code WITHOUT consuming it, so the app can gate the
   * "enter new password" step. The code is consumed later by resetPassword. */
  async verifyResetCode(dto: VerifyOtpDto) {
    await this.findValidOtp(dto.email, dto.code, 'RESET_PASSWORD');
    return { valid: true };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.consumeOtp(dto.email, dto.code, 'RESET_PASSWORD');
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    return { reset: true };
  }

  // ── helpers ──────────────────────────────────────────────────────────

  private tokenResponse(user: User) {
    const token = this.jwt.sign({ sub: user.id, email: user.email, role: user.role });
    return { token, user: this.publicUser(user) };
  }

  publicUser(user: User) {
    const { passwordHash, ...rest } = user;
    void passwordHash;
    return rest;
  }

  private async uniqueUsername(name: string, email: string): Promise<string> {
    const base =
      '@' +
      (name || email.split('@')[0])
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '.')
        .replace(/^\.+|\.+$/g, '')
        .slice(0, 18);
    let candidate = base;
    let i = 0;
    while (await this.prisma.user.findUnique({ where: { username: candidate } })) {
      i += 1;
      candidate = `${base}${i}`;
    }
    return candidate;
  }

  private async issueOtp(
    userId: string,
    email: string,
    purpose: OtpPurpose,
  ): Promise<{ code: string; expiresAt: Date }> {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const ttl = Number(this.config.get('OTP_TTL_MINUTES') ?? 5);
    const expiresAt = new Date(Date.now() + ttl * 60_000);
    await this.prisma.otp.create({ data: { userId, code, purpose, expiresAt } });
    if (this.mail.enabled) {
      try {
        await this.mail.sendOtp(email, code, purpose);
      } catch (err) {
        // Keep the flow alive on mail-provider hiccups; surface the code in
        // the server log so support can assist the user manually.
        this.logger.error(`OTP email to ${email} failed: ${String(err)}`);
        this.logger.log(`OTP for ${userId} (${purpose}): ${code}`);
      }
    } else {
      // No mail provider configured (local dev): log instead of emailing.
      this.logger.log(`OTP for ${userId} (${purpose}): ${code}`);
    }
    return { code, expiresAt };
  }

  /** Looks up a still-valid (unconsumed, unexpired) OTP without modifying it. */
  private async findValidOtp(email: string, code: string, purpose: OtpPurpose) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (!user) throw new BadRequestException('Invalid code');
    const otp = await this.prisma.otp.findFirst({
      where: { userId: user.id, purpose, code, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) throw new BadRequestException('Invalid or expired code');
    return { user, otp };
  }

  private async consumeOtp(
    email: string,
    code: string,
    purpose: OtpPurpose,
  ): Promise<User> {
    const { user, otp } = await this.findValidOtp(email, code, purpose);
    await this.prisma.otp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
    return user;
  }

  /** Expose the OTP in the response only in development so the app flow is testable. */
  private devOtp(code: string): string | undefined {
    return this.config.get('NODE_ENV') === 'production' ? undefined : code;
  }
}
