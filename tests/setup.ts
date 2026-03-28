// Global test setup
// Set test environment variables before anything else
process.env.NODE_ENV = 'test';
process.env.PORT = '0'; // Random port for tests
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/node_ts_boiler_test?schema=public';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.REDIS_PASSWORD = '';
process.env.JWT_SECRET = 'test-jwt-secret-at-least-10-chars';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-10-chars';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.RATE_LIMIT_WINDOW_MS = '900000';
process.env.RATE_LIMIT_MAX_REQUESTS = '1000';
process.env.LOG_LEVEL = 'error';
