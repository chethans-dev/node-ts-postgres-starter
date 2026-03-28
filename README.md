# Comprehensive Boilerplate Documentation

Welcome to the ultimate guide for this Node.js + TypeScript REST API Boilerplate. This document meticulously breaks down **every single file, package, configuration, and architectural design choice** in the repository. It explains *how* it was initialized, *why* certain tools were chosen, and *how* they all work together to create a production-grade application.

---

## Table of Contents
1. [Initial Setup & Package Management](#1-initial-setup--package-management)
2. [Core Tooling & Configurations](#2-core-tooling--configurations)
3. [Database & ORM (PostgreSQL + Prisma)](#3-database--orm-postgresql--prisma)
4. [Caching & Performance (Redis)](#4-caching--performance-redis)
5. [Docker & Containerization](#5-docker--containerization)
6. [Continuous Integration (GitHub Actions)](#6-continuous-integration-github-actions)
7. [Application Architecture (Express.js)](#7-application-architecture-expressjs)
8. [Middlewares & Security](#8-middlewares--security)
9. [Error Handling & Validation (Zod)](#9-error-handling--validation-zod)
10. [Authentication Flow (JWT)](#10-authentication-flow-jwt)
11. [Testing (Vitest + Supertest)](#11-testing-vitest--supertest)
12. [API Documentation (Swagger)](#12-api-documentation-swagger)

---

## 1. Initial Setup & Package Management

### `package.json`
The project was initialized using `npm init -y`. Our `package.json` drives the entire development lifecycle.

*   **Runtime:** Node.js (v20+ target).
*   **Main Application Dependencies:**
    *   `express`: The core web framework holding the API together.
    *   `dotenv`: Loads environment variables from `.env` files into `process.env`.
    *   `zod`: A TypeScript-first schema declaration and validation library (used for both validating incoming HTTP requests and validating the `.env` file upon startup).
    *   `pino` & `pino-http`: Extremely fast logging frameworks (JSON format in production).
    *   `morgan`: HTTP request logger middleware.
    *   `helmet`, `cors`, `express-rate-limit`, `hpp`: Security suite to defend against common web vulnerabilities.
    *   `@prisma/client`: Database ORM client to interact with PostgreSQL.
    *   `ioredis`: A robust, performance-focused Redis client for Node.js.
    *   `jsonwebtoken` & `bcrypt`: Core libraries for handling the authentication lifecycle (hashing passwords, signing JWTs).
    *   `swagger-jsdoc` & `swagger-ui-express`: Autogenerates interactive API documentation from JSDoc comments.
*   **Dev Dependencies:**
    *   `typescript`, `@types/*`: Type definitions for Node and all Javascript-native dependencies.
    *   `tsx`: An incredibly fast TypeScript execute runtime (replaces `ts-node`).
    *   `nodemon`: Hot-reloading development server config.
    *   `eslint`, `prettier`: Code quality tools.
    *   `vitest`, `supertest`: The modern, V8-powered testing suite replacing Jest.

### `npm scripts` detailed:
*   `dev`: Spawns `nodemon` to watch file changes, which in turn runs `tsx src/server.ts`.
*   `build`: Deletes the old `/dist` folder using `rimraf`, then compiles TypeScript via `npx tsc`.
*   `start`: Runs the compiled vanilla JavaScript `node dist/server.js` (for production).
*   `lint`/`format`: Invokes ESLint and Prettier to automatically fix code styling errors.
*   `setup`: A convenient script that installs NPM modules, copies `.env`, boots Docker, and applies the DB migrations.

---

## 2. Core Tooling & Configurations

### `tsconfig.json`
*   **Target (`ES2022`) & Module (`commonjs`)**: Compiles modern TS into highly compatible server-side code.
*   **`strict: true`**: Enforces strict null checks and aggressive typings (banning implicit `any`).
*   **`paths`**: Sets up Module Aliasing so imports look clean (e.g., `import { validate } from '@middlewares/validate'` instead of `../../../middlewares/validate`).
*   **`outDir` & `rootDir`**: Instructs the compiler to read from `./src` and place compiled `.js` files in `./dist`.

### `.eslintrc.cjs` & `.prettierrc`
We integrate ESLint and Prettier tightly. Prettier handles **code formatting** (tabs, single quotes, line breaks), while ESLint handles **code quality** (unused variables, explicit return types).
*   The config explicitly ignores `_` prefixed variables (like `_req`) as unused variables.
*   It ensures we don't accidentally leave `console.log` in the codebase; instead, we must use our `pino` logger.

### `nodemon.json`
Configures hot-reloading. Watches the `src/` directory for any file changes ending in `.ts` or `.json` and executes `tsx src/server.ts` instantly to restart the server during development.

---

## 3. Database & ORM (PostgreSQL + Prisma)

### `prisma/schema.prisma`
Prisma acts as our database bridge. The schema explicitly defines our models:
1.  **User Model:** Contains `id`, `email`, `password` (hashed), and maps to the `users` table via `@@map("users")`.
2.  **RefreshToken Model:** A one-to-many relationship mapping one User to multiple rotatable refresh tokens.

*Why Prisma 6?*
Prisma 7 recently introduced massive breaking changes dropping standard properties like `url` inside schemas. This boilerplate uses Prisma 6 explicitly so developers can easily run `npx prisma db push` or `npx prisma migrate dev` locally and utilize standard connection strings locally and in production.

### `src/config/prisma.ts`
Initializes a singleton Prisma Client.
*   In `development` environments, it binds an event listener to log every single SQL query execution time via Pino.
*   It handles global database connection/disconnection graceful limits to prevent memory leaks or exhausting connection pools during `SIGINT` (CTRL+C).

---

## 4. Caching & Performance (Redis)

### `src/config/redis.ts`
Uses `ioredis` to manage the cache layer.
*   **Robust Reconnection:** Uses a custom `retryStrategy` function. If Redis crashes or isn't booted up yet, it will exponentially backoff and keep attempting reconnection rather than bringing the entire Node API down.
*   **Purpose:** Primed for rate-limiting data, heavily queried data caching, or session ID storing.

---

## 5. Docker & Containerization

### `docker-compose.yml`
Sets up the local dependency infrastructure without forcing you to install native Postgres/Redis applications on your Mac/PC.
*   **`postgres:16-alpine`**: Spins up Postgres v16, mapping port `5432:5432` with built-in health checks.
*   **`redis:7-alpine`**: Spins up a lightweight Redis instance on `6379`.
*   **Volumes (`postgres_data`, `redis_data`)**: Ensures that even if you destroy the containers, your local development database state/users remain persistent.

### `Dockerfile` & `.dockerignore`
This is a **Multi-stage Production Dockerfile**.
*   **Builder Stage:** Installs *all* npm dependencies (including dev tools), generates the Prisma client, and runs `npm run build` to compile TypeScript to Javascript.
*   **Production Stage:** Uses a pristine `node:20-alpine` image. It copies only the necessary `/dist`, the `package.json`, and installs strictly `--only=production` dependencies.
*   **Security:** Creates a specialized non-root `nodeuser` so the container runs safely without root privileges.

---

## 6. Continuous Integration (GitHub Actions)

### `.github/workflows/ci.yml`
Automatically runs on every Git push to `main` or `develop` branches.
*   **Services Layer:** Automatically spins up a Postgres and Redis service native to the GitHub Ubuntu runner.
*   **Job Flow:** Checkout code -> Setup Node 20 -> Install dependencies (`npm ci`) -> Run `prisma generate` -> Apply database structure -> Run Linter -> Compile Build -> Execute automated tests.
*   This actively blocks bad code or failing tests from merging to production.

---

## 7. Application Architecture (Express.js)

The codebase strictly adheres to standard Domain-Driven Design (DDD) patterns for scalability:

*   **`src/app.ts` (The Blueprint):** Initializes the `express()` app. It is entirely detached from the network layer. It mounts the security tools, JSON parsers, HTTP loggers, and the feature routers. Finally, it mounts the global `errorHandler`.
*   **`src/server.ts` (The Engine):** Imports `app`. Connects to Prisma and Redis. Tells the app to start `listen`ing on `env.PORT`. Crucially, it attaches event listeners for `uncaughtException`, `SIGTERM`, and `SIGINT` to gracefully stop the database connections and close the HTTP server out before killing the process.
*   **`src/routes/`:** Matches URL endpoints (e.g. `POST /register`) to Controller functions. This is also where Swagger/OpenAPI `@openapi` YAML comments live above each route.
*   **`src/controllers/`:** The gatekeeper. Extracts inputs from `req.body`, calls the Service business logic layer, and replies with standard `res.status(200).json(...)`.
*   **`src/services/`:** Where the heavy lifting occurs. The auth service directly queries Prisma, compares bcrypt hashes, signs JWTs, and applies core logic.

---

## 8. Middlewares & Security

*   **`helmet`**: Modifies dozens of HTTP headers specifically designed to prevent cross-site scripting (XSS), clickjacking, and mime-sniffing.
*   **`express-rate-limit`**: Limits requests. By default, handles 100 requests per 15 minutes per IP. This defends against Brute-force and basic DDoS attacks.
*   **`cors`**: Protects against unexpected cross-origin requests. Restricted to `env.CORS_ORIGIN` out of the box.
*   **`hpp`**: HTTP Parameter Pollution protector. Disables exploits where attackers send duplicate query keys (e.g. `?sort=asc&sort=desc`) trying to crash parsing arrays in the server.

---

## 9. Error Handling & Validation (Zod)

### The Zod Validation Pipeline (`src/middlewares/validate.ts`)
*   Every route goes through a `validate(zodSchema)` middleware before hitting the controller.
*   It checks `req.body` against defined rules (e.g., "password must have 8 chars and special characters").
*   If validation fails, Zod throws a `ZodError`, hitting our Global Error Handler immediately. The controller is completely bypassed.

### The Global Error Handler (`src/middlewares/errorHandler.ts`)
Instead of duplicating `try/catch` blocks randomly across 100 routes, we use `src/middlewares/asyncHandler.ts` to wrap every controller.
When an error bounces out, the global `errorHandler` categorizes it dynamically:
1.  **Zod Errors:** Iterates over `.issues` and maps them into a beautiful, human-readable Array describing exactly which fields failed.
2.  **Prisma Errors:** Catches the specific Prisma Error Code (`P2002`). E.g., if a user registers an existing email, Prisma throws a unique constraint exception. The handler catches this and translates it specifically to a `HTTP 409 Conflict - Duplicate Entry`.
3.  **AppErrors:** Any custom operational `throw AppError.unauthorized()` calls are handled.
4.  **Unknown Errors:** The ultimate fallback logs the fatal stack trace recursively to Pino, and returns a sanitized `500 Server Error` (hiding the stack traces from hackers in production).

---

## 10. Authentication Flow (JWT)

A production-level access and refresh token economy. Access tokens (`15m` expiry) are used to access the API. Refresh tokens (`7d` expiry) are securely stored in the PostgreSQL database mapping to the user.
*   **Login Flow:** Password verified against hash -> New Access/Refresh tokens emitted. Refresh token is saved to DB via Prisma.
*   **Refresh Flow:** User submits the Refresh token. We search for it in Prisma. If it's valid, we immediately **DELETE IT** from the database and generate a **NEW** pair (Token Rotation). This ensures if a token is stolen, the attacker has limited utility.
*   **Middleware Guards:** `src/middlewares/auth.ts` intercepts requests, splits the `Bearer` token header, verifies `env.JWT_SECRET`, embeds the decoded payload into `req.user`, or rejects it as `401 Unauthorized`. It also exports an `authorize('ADMIN')` RBAC (Role-Based Access Control) function.

---

## 11. Testing (Vitest + Supertest)

*   **Framework:** `vitest` because it executes parallel tests drastically faster than Jest, using modern V8 engine bindings.
*   **`tests/setup.ts`**: The very first file executed before any test runs. It forces process variables (DB URL, Redis URL, JWT Secrets) into specific safe "mock/test" variables. This ensures running tests never accidentally deletes your development database.
*   **`tests/health.test.ts`**: Integration tests using `supertest`. Supertest fires internal mock HTTP calls instantly through the Express app without binding to an actual port, ensuring the router behaves as expected.

---

## 12. API Documentation (Swagger)

*   **`src/config/swagger.ts`**: Initializes `swagger-jsdoc` parsing tool.
*   It reads the `// @openapi` JSDoc annotations directly situated above every route in `src/routes/`.
*   The interactive Swagger client UI is automatically served by `swagger-ui-express` running at `http://localhost:8000/api-docs`. It supports direct component reuse via generic schemas housed in `src/interfaces/index.ts` so you don't repeat API type defs inside Swagger docs twice.
