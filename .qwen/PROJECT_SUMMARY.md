The user wants me to generate a comprehensive project summary in markdown format based on the entire conversation history. Let me analyze what was done across all the interactions.

The conversation covered three main features:
1. Soft-delete of group members (eliminating users from groups without affecting historical data)
2. Web Push Notifications for group activity
3. Environment configuration for deployment

Let me organize this into a comprehensive summary.# Project Summary

## Overall Goal
Enhance a **monorepo-based personal finance & shared expenses platform** (React + Express + TypeScript + PostgreSQL + Prisma) with two major features: (1) soft-delete group members while preserving historical financial data, and (2) Web Push notifications for real-time group activity alerts, plus production-ready environment configuration.

## Key Knowledge

### Architecture
- **Monorepo** using npm workspaces: `apps/web` (React 18 + Vite + TS), `apps/api` (Express + TS), `packages/db` (Prisma 5 + PostgreSQL 16)
- **Orchestration**: Docker Compose (dev) with overlay for production
- **Auth**: JWT-based, `Authorization: Bearer <token>`
- **Default currency**: EUR

### Soft-Delete Members Design
- Added `leftAt DateTime?` to `GroupMember` — `null` means active, set timestamp means removed
- Removed `@@unique([groupId, userId])` to allow users to rejoin after leaving
- Active members are filtered with `where: { leftAt: null }` across all queries that list/select members
- **Historical data preserved**: expense balance calculations include ALL members (including soft-deleted) for accuracy
- **Access control**: soft-deleted members no longer pass group access checks (`members: { some: { userId, leftAt: null } }`)
- New endpoint: `POST /groups/:id/members/:mid/rejoin` for admins to reactivate a removed member

### Web Push Notifications Design
- **Technology**: `web-push` package with VAPID protocol
- **Storage**: `PushSubscription` table (one per user per device/browser)
- **Service Worker**: `apps/web/public/sw.js` — handles push events and notification clicks (navigates to group)
- **Triggered events**:
  1. **Expense created** → all group members except creator
  2. **Settlement created** → only the creditor (toMember)
  3. **Member removed** → only the removed member
- **Client flow**: On login, if push is supported and not previously asked, browser prompts for permission. Toggle in ProfileScreen to enable/disable.
- **Requires HTTPS in production** (works on localhost without it)

### Environment Variables
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_MAILTO` — for Web Push
- `JWT_SECRET` — for token signing
- `DATABASE_URL` — PostgreSQL connection
- `.env.example` created as template with security notes

### Build & Dev Commands
```bash
docker compose up -d --build        # Start all services
npm run build:api                   # TypeScript compile API
npm run build:web                   # Vite build frontend
docker compose logs -f api          # View API logs
docker compose down -v              # Reset database
```

## Recent Actions

### 1. Soft-Delete Group Members [DONE]
- **Schema**: Added `leftAt` field, removed unique constraint, added index on `[groupId, leftAt]`
- **API**: Modified DELETE endpoint to soft-delete instead of hard delete; removed reference-count blocking; added `rejoin` endpoint
- **Access control**: Updated `getAccessibleGroup`, `getAdminGroup`, and all member queries to filter `leftAt: null`
- **Balance calculation**: Explicitly includes all members (even soft-deleted) for historical accuracy
- **Frontend**: Delete button on member pills in Settings tab (admin-only, with confirmation dialog); cannot delete self
- **Both builds pass cleanly** (API tsc + web vite)

### 2. Web Push Notifications [DONE]
- **Schema**: New `PushSubscription` model with `endpoint`, `p256dh`, `auth` fields
- **Backend**: Created `apps/api/src/lib/push.ts` (sends push to user, auto-cleans 410 Gone subscriptions), `apps/api/src/routes/push.ts` (`/push/subscribe`, `/push/vapid-public-key`)
- **Service Worker**: `apps/web/public/sw.js` — shows notifications, navigates to group on click
- **Client library**: `apps/web/src/lib/push.ts` — `subscribeToPush()`, `unsubscribeFromPush()`, permission management via localStorage flags
- **Integration**: Auto-subscribe on login in `useFinanceApp.ts`; ProfileScreen has enable/disable toggle
- **Push triggers added to**: expense creation (line ~1019), settlement creation (line ~1523), member deletion (line ~827) in `groups.ts`
- **VAPID keys generated** for development and added to `docker-compose.yml`
- **Both builds pass cleanly**

### 3. Environment Configuration [DONE]
- Created `.env.example` with all required production variables and security notes
- Updated `.env` with current VAPID keys
- Fixed `.dockerignore` to allow `.env` through while blocking `.env.local` and `.env.production.local`
- Added TypeScript declaration file for `web-push` module (`apps/api/src/types/web-push.d.ts`)

## Current Plan

All implemented features are complete and building successfully. Next steps for the user:

1. **[TODO]** Run `docker compose up -d --build` to apply Prisma schema changes (including `PushSubscription` table and `leftAt` field)
2. **[TODO]** Test soft-delete: create a group with members, add expenses, then remove a member → verify historical data intact
3. **[TODO]** Test push notifications: log in as two users in separate browsers, accept notification permission, create expense from one user, verify notification appears on the other
4. **[TODO]** Before production deployment: generate new VAPID keys with `npx web-push generate-vapid-keys` and set a strong `JWT_SECRET`

---

## Summary Metadata
**Update time**: 2026-04-12T20:48:49.244Z 
