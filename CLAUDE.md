# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Personal + group finance tracker ("finanzas-integradas"). npm-workspaces monorepo: a React SPA (`apps/web`) talking to an Express REST API (`apps/api`), both TypeScript, with a shared Prisma schema in `packages/db`. Persistence is PostgreSQL. Most user-facing strings and code comments are in Spanish.

## Commands

Run from the repo root (workspace scripts delegate to the right app):

```bash
npm run dev:api          # ts-node-dev, port 8080
npm run dev:web          # Vite dev server, port 3000

npm run build:api        # tsc -> apps/api/dist
npm run build:web        # vite build

npm run prisma:generate  # regenerate Prisma Client after editing schema.prisma
npm run prisma:push      # push schema to the DB (prisma db push, no migrations)

npm test                 # vitest (watch) across web + api
npm run test:run         # vitest run (one-shot, use for CI/verification)
npm run test:coverage    # with v8 coverage
npm run test:e2e         # Playwright end-to-end
```

Run a single test file / filter (cd into the app first, since the root script fans out to both workspaces):

```bash
cd apps/api && npx vitest run src/routes/transactions.test.ts
cd apps/web && npx vitest run -t "budget card"
```

Full stack via Docker (`docker compose up -d`): brings up Postgres 16, a one-shot `migrate` service (runs `prisma db push`), the API (8080), and the web dev server (3000). The `.env` at the root feeds compose.

## Prisma workflow

The schema lives at `packages/db/schema.prisma` (not under `apps/api`). Prisma commands pass `--schema=../../packages/db/schema.prisma` from within `apps/api`. This project uses **`prisma db push`, not migrations** — there is no migrations directory. After changing the schema, run `npm run prisma:generate` then `npm run prisma:push`.

## API architecture (`apps/api`)

- `src/index.ts` → `src/app.ts`: Express app with helmet/cors/morgan; all routes mounted under `/api/v1` in `src/routes/index.ts`. `ensureGlobalCategories()` runs on boot to seed shared categories.
- **Domain layer** (`src/domain/<context>/{value-objects,services}`): pure business logic with no HTTP/Prisma dependencies — e.g. `Money` (integer cents, immutable), `MonthPeriod`, `calculateUserBalanceSummary`, `calculateMonthlySummary`, and the plan policy (`resolvePlan`/`canCreateGroup` in `domain/billing`). Routes/libs fetch data and delegate money math and plan rules here; new financial rules go in a domain service with unit tests first.
- **Free/premium**: plan limits live in `domain/billing/services/plan-policy.ts` (free = 1 owned group). Routes return `403 PLAN_LIMIT_REACHED`; the web client (`ApiError.code`) opens `PaywallModal` on that code. The `Subscription` model backs the plan (no row → free).
- **Auth**: JWT bearer tokens. `requireAuth` middleware (`src/middlewares/requireAuth.ts`) verifies the token and puts the user id on `res.locals.userId` — read it there in handlers, not from a decoded param.
- **Validation**: Zod schemas per route; validation errors go through `sendError` / `zodIssuesDetails` (`src/lib/apiError.ts`) which produce the `{ error: { code, message, details } }` shape the web client parses.
- **Env**: `src/config/env.ts` validates env vars with Zod at startup and `process.exit(1)` on failure. `DATABASE_URL` is required.

### Key cross-cutting concepts

- **Personal ledger sync** (`src/lib/personalLedgerSync.ts`): Group expenses and confirmed settlements are mirrored into each affected user's `PersonalTransaction` rows (marked `locked: true` with a `sourceType`/`sourceRefId`). These synced rows are derived data — never edit them directly; re-run the sync helpers inside the same DB transaction after mutating the source group data. `syncUserGroupLedgerBackfill` reconciles a user's full set and deletes stale mirrors.
- **Idempotency** (`src/lib/idempotency.ts`): Mutating endpoints support an idempotency key; the request payload is canonicalized + SHA-256 hashed and stored in `IdempotencyRequest`. Same key + same hash replays the stored response; same key + different hash returns 409.
- **Budget alerts** (`src/lib/budgetAlerts.ts`): After transactions change, `checkBudgetThresholds` recomputes per-category monthly spend and fires 80%/100% alerts (persisted in `BudgetAlert`, deduped by unique constraint) and web-push notifications.
- **Balances**: `src/lib/userBalance.ts` (personal) and `src/lib/groupBalances.ts` (group splits/settlements). `roundMoney` in groupBalances is the shared money-rounding helper — use it for currency math.

## Web architecture (`apps/web`)

- Vite + React 18 + react-router-dom. `@/` is aliased to `apps/web/src` (in both `vite.config.ts` and `vitest.config.ts`).
- **State is composed of hooks, not a store.** `src/hooks/useFinanceApp.ts` wires together `useAuth`, `useTransactions`, `useCategories`, `useBudgets`, `useGroups`, plus `useBootstrap` (session hydration) and `useAutoRefresh`. It returns one flat object spread from all the domain hooks; `App.tsx` passes this `financeApp` object down through `AppRoutes`. When adding a feature, add/extend a domain hook and wire it in `useFinanceApp`.
- **API client**: `src/lib/api.ts` centralizes all fetch calls. Base URL is `VITE_API_URL` (default `http://localhost:8080`) + `/api/v1`. `parseJson` unwraps the API error envelope (including Zod `details.issues`) into thrown `Error` messages.
- Screens live in `src/screens`, reusable UI in `src/components/ui`, domain components in `src/components/<domain>`. There's a service worker (`public/sw.js`) for PWA/push.

## Testing conventions

- Vitest everywhere. API tests run in `node`; web tests default to `node` too, so **React component tests must opt into jsdom with a `// @vitest-environment jsdom` header comment** (see `BudgetCard.test.tsx`).
- API route tests mock `../db/prisma.js` and `../middlewares/requireAuth.js` with `vi.mock`, stubbing `prisma.$transaction` to invoke the callback with a mock transaction client. Follow the pattern in `src/routes/transactions.test.ts` when testing routes that use `$transaction`.
- Coverage thresholds (80%) are scoped to specific lib files only (see the `coverage.include` lists in each `vitest.config.ts`), not the whole codebase.

## Docs

Design/product docs are in `docs/` (Spanish): `arquitectura.md`, `api.md`, `prd.md`, epic files (`EP-*.md`, `HD-*.md`), and deployment (`despliegue.md`, `instalacion.md`).
