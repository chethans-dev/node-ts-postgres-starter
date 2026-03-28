import app from './app';
import { env } from './config/env';
import logger from './config/logger';
import { connectDatabase, disconnectDatabase } from './config/prisma';
import { connectRedis, disconnectRedis } from './config/redis';

// ─── Bootstrap ───────────────────────────────────────────

async function bootstrap(): Promise<void> {
  // Connect to external services
  await connectDatabase();
  await connectRedis();

  // Start HTTP server
  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 Server running on http://localhost:${env.PORT}`);
    logger.info(`📚 API Docs: http://localhost:${env.PORT}/api-docs`);
    logger.info(`🌍 Environment: ${env.NODE_ENV}`);
  });

  // ─── Graceful Shutdown ──────────────────────────────────

  const gracefulShutdown = async (signal: string) => {
    logger.info(`${signal} received. Starting graceful shutdown...`);

    server.close(async () => {
      logger.info('HTTP server closed');

      await disconnectDatabase();
      await disconnectRedis();

      logger.info('All connections closed. Exiting.');
      process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // ─── Unhandled Errors ────────────────────────────────────

  process.on('unhandledRejection', (reason: Error) => {
    logger.fatal({ err: reason }, '💥 Unhandled Promise Rejection');
    throw reason;
  });

  process.on('uncaughtException', (error: Error) => {
    logger.fatal({ err: error }, '💥 Uncaught Exception');
    process.exit(1);
  });
}

bootstrap().catch((error) => {
  logger.fatal({ err: error }, '❌ Failed to start application');
  process.exit(1);
});
