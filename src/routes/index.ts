import { Router } from 'express';
import type { Request, Response } from 'express';
import authRoutes from './auth.routes';

const router = Router();

/**
 * @openapi
 * /api/v1/health:
 *   get:
 *     tags: [Health]
 *     summary: Health check endpoint
 *     responses:
 *       200:
 *         description: Server is healthy
 */
router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ─── Mount Feature Routes ─────────────────────────────────
router.use('/auth', authRoutes);

export default router;
