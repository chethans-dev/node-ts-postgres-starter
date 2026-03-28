import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import type { JwtPayload, TokenPair, UserResponse } from '../interfaces';
import type { RegisterInput, LoginInput } from '../validations/auth.validation';

const SALT_ROUNDS = 12;

export class AuthService {
  /**
   * Register a new user.
   */
  async register(
    input: RegisterInput,
  ): Promise<{ user: UserResponse; tokens: TokenPair }> {
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw AppError.conflict('A user with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(input.password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        email: input.email,
        password: hashedPassword,
        firstName: input.firstName,
        lastName: input.lastName,
      },
    });

    const tokens = await this.generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  /**
   * Login an existing user.
   */
  async login(
    input: LoginInput,
  ): Promise<{ user: UserResponse; tokens: TokenPair }> {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user || !user.isActive) {
      throw AppError.unauthorized('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.password);

    if (!isPasswordValid) {
      throw AppError.unauthorized('Invalid email or password');
    }

    const tokens = await this.generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  /**
   * Refresh access token using a valid refresh token.
   */
  async refreshToken(token: string): Promise<TokenPair> {
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      // Clean up expired token if it exists
      if (storedToken) {
        await prisma.refreshToken.delete({ where: { id: storedToken.id } });
      }
      throw AppError.unauthorized('Invalid or expired refresh token');
    }

    // Rotate refresh token: delete old, create new
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });

    const tokens = await this.generateTokens({
      userId: storedToken.user.id,
      email: storedToken.user.email,
      role: storedToken.user.role,
    });

    return tokens;
  }

  /**
   * Get user profile by ID.
   */
  async getProfile(userId: string): Promise<UserResponse> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw AppError.notFound('User not found');
    }

    return this.sanitizeUser(user);
  }

  /**
   * Logout: revoke all refresh tokens for a user.
   */
  async logout(userId: string): Promise<void> {
    await prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }

  // ─── Private Helpers ────────────────────────────────────

  private async generateTokens(payload: JwtPayload): Promise<TokenPair> {
    const accessToken = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as unknown as number,
    });

    const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN as unknown as number,
    });

    // Parse the refresh expiry for DB storage
    const refreshExpiresMs = this.parseExpiry(env.JWT_REFRESH_EXPIRES_IN);

    // Store refresh token in DB
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: payload.userId,
        expiresAt: new Date(Date.now() + refreshExpiresMs),
      },
    });

    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
    createdAt: Date;
  }): UserResponse {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      createdAt: user.createdAt,
    };
  }

  private parseExpiry(expiry: string): number {
    const units: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7 days

    return parseInt(match[1]) * (units[match[2]] || units.d);
  }
}

export const authService = new AuthService();
