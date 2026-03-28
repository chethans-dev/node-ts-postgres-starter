import type { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import type { AuthenticatedRequest } from '../interfaces';
import { StatusCodes } from 'http-status-codes';

export class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    const result = await authService.register(req.body);

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'User registered successfully',
      data: result,
    });
  }

  async login(req: Request, res: Response): Promise<void> {
    const result = await authService.login(req.body);

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Login successful',
      data: result,
    });
  }

  async refreshToken(req: Request, res: Response): Promise<void> {
    const { refreshToken } = req.body;
    const tokens = await authService.refreshToken(refreshToken);

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Token refreshed successfully',
      data: tokens,
    });
  }

  async getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    const user = await authService.getProfile(req.user!.userId);

    res.status(StatusCodes.OK).json({
      success: true,
      data: { user },
    });
  }

  async logout(req: AuthenticatedRequest, res: Response): Promise<void> {
    await authService.logout(req.user!.userId);

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Logged out successfully',
    });
  }
}

export const authController = new AuthController();
