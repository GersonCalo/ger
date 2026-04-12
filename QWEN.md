# QWEN.md — Personal Finance & Shared Expenses Platform

## Project Overview

A **monorepo-based web application** for personal finance management and shared group expenses. It allows users to track income/expenses, create groups with real or guest members, split bills, and maintain a unified financial view combining personal and group balances.

### Architecture
- **Monorepo** using npm workspaces
- **Frontend**: React 18 + Vite + TypeScript (`apps/web`)
- **Backend**: Node.js + Express + TypeScript (`apps/api`)
- **Database**: PostgreSQL 16
- **ORM**: Prisma 5 (`packages/db/schema.prisma`)
- **Orchestration**: Docker Compose (dev + production overlay)

### Key Features
- Personal transactions with income/expense tracking
- Group management with join codes, real/guest members, and role-based access (admin/member)
- Expense splitting: equal or weighted splits
- Settlement tracking between group members
- Unified balance view: available money, group balance, and total
- Category system with global, personal, and group-scoped categories
- Default currency: EUR
- JWT-based authentication

## Directory Structure

```
ger/
├── apps/
│   ├── api/          # Express API server (TypeScript)
│   └── web/          # React + Vite frontend (TypeScript)
├── packages/
│   └── db/
│       └── schema.prisma  # Shared Prisma schema
├── docs/
│   ├── api.md              # API endpoint documentation
│   ├── arquitectura.md     # Architecture docs
│   ├── despliegue.md       # Deployment guide
│   └── instalacion.md      # Installation guide
├── docker-compose.yml        # Development environment
├── docker-compose.prod.yml   # Production overlay
└── package.json              # Workspace root
```

## Building and Running

### Prerequisites
- Docker Desktop with Compose enabled

### Development (Docker)

```bash
# Start all services (rebuilds images)
docker compose up -d --build

# Access services
# API:  http://localhost:8080/health
# Web:  http://localhost:3000

# Check logs
docker compose logs api
docker compose logs web
docker compose logs migrate --tail=200
```

### Development (npm workspaces)

```bash
# From project root
npm run dev:api    # Start API dev server
npm run dev:web    # Start Vite dev server
npm run build:api  # Build API
npm run build:web  # Build web

# Prisma commands
npm run prisma:generate  # Generate Prisma client
npm run prisma:push      # Push schema to DB (dev only)
```

### Production (Local)

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
# Access at http://localhost (Nginx serves on port 80)
```

### Services & Ports (Dev)
| Service | Port     | Description              |
|---------|----------|--------------------------|
| db      | 5432     | PostgreSQL               |
| api     | 8080     | Express API server       |
| web     | 3000     | Vite dev server          |

## Key Commands Reference

### API Endpoints (Base: `http://localhost:8080`)

**Auth**: `POST /auth/register`, `POST /auth/login`, `GET /me`

**Personal Finance**: `GET /balance`, `GET /transactions`, `POST /transactions`

**Categories**:
- `GET /categories` — global + personal categories
- `POST /categories` — create personal category
- `PATCH /categories/:id`, `DELETE /categories/:id` — edit/delete personal
- `GET /groups/:id/categories` — global + group categories
- `POST/PATCH/DELETE /groups/:id/categories/...` — group category CRUD

**Groups**: `GET /groups`, `POST /groups`, `POST /groups/join-by-code`

**Group Members**: `GET /groups/:id/members`, `POST/PATCH/DELETE /groups/:id/members/:mid`

**Group Expenses**: `GET/POST /groups/:id/expenses`, `PUT/DELETE /groups/:id/expenses/:eid`

**Balances**: `GET /groups/:id/balances`

**Settlements**: `POST /groups/:id/settlements`, `PUT /groups/:id/settlements/:sid`

All protected endpoints require `Authorization: Bearer <JWT>` header.

## Development Conventions

### Prisma Schema
- Schema lives at `packages/db/schema.prisma`
- In dev, `migrate` service runs `prisma db push --accept-data-loss` on startup
- After schema changes, rebuild with `docker compose up -d --build`

### Categories System
- **Global**: `userId = null`, `groupId = null` — read-only, created at app init
- **Personal**: `userId = <user>`, `groupId = null` — full CRUD for owner
- **Group**: `userId = null`, `groupId = <group>` — full CRUD for group members

### Expense Splitting
- `splitMethod: 'equal'` — automatic equal split
- `splitMethod: 'manual'` — exact amounts per member (must sum to total)
- Amounts always rounded to 2 decimals

### Settlements
- Users can only register settlements where they are the debtor (`fromMemberId`)
- Statuses: `proposed` → `confirmed` or `cancelled`

### Frontend Sync
- Auto-refreshes groups and balance every 10 seconds (while tab visible)
- Refreshes immediately on window focus/visibility change

### Error Codes
- `400` — Invalid input data
- `401` — Not authenticated
- `403` — Insufficient permissions
- `404` — Not found
- `409` — Conflict

## Dependencies Summary

### API
- Express, bcryptjs, jsonwebtoken, zod (validation), helmet, morgan, cors
- Prisma client + server as dev dependency

### Web
- React 18, Vite, @vitejs/plugin-react

### Database
- PostgreSQL 16, Prisma 5

## Useful Docker Commands

```bash
# Stop all services
docker compose down

# Rebuild and start
docker compose up -d --build

# View service logs
docker compose logs -f api

# Reset database volume
docker compose down -v && docker compose up -d --build
```
