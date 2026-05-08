# AGENTS.md

## Scope and source of truth
- This is an npm workspace monorepo: `apps/api` (Express + TS), `apps/web` (React + Vite), `packages/db/schema.prisma` (shared Prisma schema).
- Prefer repo scripts and compose files over prose docs when they conflict.

## Commands you will actually use
- Start full dev stack (DB + schema push + API + Web): `docker compose up -d --build`.
- Faster frontend iteration in Docker: `docker compose watch` (syncs `apps/web`, rebuilds when `apps/web/package.json` changes).
- Local non-Docker app dev: first `docker compose up -d db migrate`, then `npm run dev:api` and `npm run dev:web` in separate shells.
- Workspace build commands from repo root: `npm run build:api`, `npm run build:web`.

## API and frontend wiring gotchas
- API is mounted at `/api/v1`; web client builds URLs as `${VITE_API_URL}/api/v1` in `apps/web/src/lib/api.ts`.
- API also exposes temporary redirects `/health` and `/config` -> `/api/v1/*` (useful for quick checks, but new routes should target `/api/v1`).
- Default web API base falls back to `http://localhost:8080` if `VITE_API_URL` is unset.

## Prisma and schema change workflow
- Prisma schema path is hardcoded to `../../packages/db/schema.prisma` in API scripts.
- In Docker dev, `migrate` runs `prisma db push --accept-data-loss` on startup.
- After editing `packages/db/schema.prisma`, rebuild containers (`docker compose up -d --build`) so API image + Prisma client are in sync.
- For local workspace flow, use root scripts: `npm run prisma:generate` then `npm run prisma:push`.

## Verified constraints worth preserving
- Environment validation in `apps/api/src/config/env.ts` requires `DATABASE_URL`; `PORT`, `NODE_ENV`, and `JWT_SECRET` have defaults.
- There is no repo-level test/lint/typecheck script and no CI workflow committed under `.github/workflows`; do not assume standard `npm test` gates exist.
- `.env` is gitignored; `.env.example` is production-oriented. Avoid committing real secrets (VAPID/JWT/DB URLs).
- Expense split inputs accepted by API routes are `equal` and `manual` (`apps/api/src/routes/groups.ts`), even though some shared/frontend types still mention `weights`.
