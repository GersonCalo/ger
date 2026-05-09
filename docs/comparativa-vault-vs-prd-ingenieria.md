# Comparativa: Vault (myMind) vs PRD de Ingeniería (GER)

Fuente del vault (en disco): `C:\Users\gerson\Desktop\myMind\myMind` (WSL: `/mnt/c/Users/gerson/Desktop/myMind/myMind`).

PRD de referencia: `docs/prd-ingenieria.md`.

## 1) Desarrollo de GER registrado en el vault

Notas encontradas (relacionadas a GER):

- `wiki/fuentes/proyecto-ger.md` (análisis del proyecto: arquitectura, schema, endpoints, UX flows)
- `wiki/entidades/ger-plataforma.md` (ficha del proyecto)
- `wiki/conceptos/finanzas-personales-grupales.md`
- `wiki/conceptos/ledger-sync.md`
- `wiki/conceptos/split-de-gastos.md`
- `wiki/conceptos/settlement-suggestions.md`
- `wiki/conceptos/web-push-notifications.md`
- `wiki/conceptos/diseno-mobile-first.md`
- `wiki/conceptos/validacion-con-zod.md`
- `wiki/conceptos/prisma.md`
- `wiki/conceptos/arquitectura-monorepo.md`
- `wiki/log.md` (entrada de ingest)

## 2) Matriz de estado vs `docs/prd-ingenieria.md`

Leyenda:

- **Hecho**: criterios del PRD cubiertos por implementación documentada + rastros en el código.
- **Medio hecho**: existe implementación, pero hay inconsistencias relevantes con los criterios (ej. contrato de errores).
- **Falta**: no se observan endpoints/flows equivalentes.

### P0 (Must Have)

| Epic | Historia | Estado | Evidencia / notas |
|---|---|---|---|
| E1 | US-P0-001 Registro de usuario | **Hecho** | API `POST /auth/register` (ver `apps/api/src/routes/auth.ts`), bcrypt/JWT descritos en `wiki/fuentes/proyecto-ger.md`. |
| E1 | US-P0-002 Login y sesión activa | **Hecho** | API `POST /auth/login`, middleware `requireAuth`, `GET /me`. |
| E2 | US-P0-003 Crear movimiento personal | **Hecho** | API `POST /transactions` (ver `apps/api/src/routes/transactions.ts`). |
| E2 | US-P0-004 Editar y eliminar movimiento personal | **Falta** | No aparecen endpoints `PUT/PATCH/DELETE /transactions/:id` en `apps/api/src/routes/transactions.ts`. |
| E2 | US-P0-005 Ver resumen personal | **Hecho** | API `GET /balance` (consolidado) + dashboard descrito en `wiki/fuentes/proyecto-ger.md`. |
| E3 | US-P0-006 Crear grupo | **Hecho** | API `POST /groups` + `GET /groups` (implementación descrita en `wiki/fuentes/proyecto-ger.md`). |
| E3 | US-P0-007 Agregar miembros reales e invitados | **Hecho** | CRUD de miembros en `apps/api/src/routes/groups.ts`; invitados soportados (displayName sin userId). |
| E3 | US-P0-008 Acceso por código de grupo | **Hecho** | API `POST /groups/join-by-code` (ver `apps/api/src/routes/groups.ts`). |
| E4 | US-P0-009 Registrar gasto grupal con split equal/manual | **Hecho** | API `POST /groups/:id/expenses`; `splitMethod` validado como `equal/manual` en `groups.ts`. |
| E4 | US-P0-010 Recalculo de balances por miembro | **Hecho** | API `GET /groups/:id/balances` + algoritmo y `suggestions` descritos en `wiki/conceptos/settlement-suggestions.md`. |
| E4 | US-P0-011 Integración con historial unificado | **Hecho** | `GET /transactions` + `syncUserGroupLedgerBackfill()` (`wiki/conceptos/ledger-sync.md`). |
| E5 | US-P0-012 Registrar liquidación entre miembros | **Hecho** | API `POST /groups/:id/settlements` + `PUT /groups/:id/settlements/:sid`. |
| E5 | US-P0-013 Impacto de liquidaciones en disponible personal | **Hecho** | Ledger sync para settlements (`group_settlement_*`) descrito en `wiki/conceptos/ledger-sync.md`. |
| E6 | US-P0-014 Validación y errores de API | **Medio hecho** | Zod en rutas + `errorHandler`, pero las respuestas de validación no son totalmente uniformes (ej. `{ message, details }` vs `{ status: 'error', message }`). |
| E6 | US-P0-015 Salud y configuración mínima | **Hecho** | `GET /health` y `/config` (redirect en `apps/api/src/app.ts`), `DATABASE_URL` requerido (`apps/api/src/config/env.ts`). |

### P1 (Should Have)

| Historia | Estado | Evidencia / notas |
|---|---|---|
| US-P1-001 Edición de gastos grupales | **Hecho** | API `PUT /groups/:id/expenses/:eid` (ver `apps/api/src/routes/groups.ts`). |
| US-P1-002 Eliminación de gastos grupales | **Hecho** | API `DELETE /groups/:id/expenses/:eid`. |
| US-P1-003 Filtros en historial unificado | **Falta** | `GET /transactions` solo soporta `?limit=all`; no se ven filtros por fecha/tipo/origen ni paginación estable. |
| US-P1-004 Mejoras UX de conciliación (sugerencias) | **Hecho** | `GET /groups/:id/balances` devuelve `suggestions`; UX descrita en el vault. |
| US-P1-005 Protección contra operaciones duplicadas (idempotencia) | **Falta** | No se ve manejo de idempotency key en rutas (gastos/liquidaciones) ni está documentado en el vault. |

### P2 (Could Have)

| Historia | Estado | Evidencia / notas |
|---|---|---|
| US-P2-001 Soporte multi-moneda avanzado | **Falta** | Hay moneda por grupo, pero no se observa conversión/FX. |
| US-P2-002 Notificaciones de eventos de grupo | **Hecho** | Rutas `/push/*`, modelo `PushSubscription`, UX en `ProfileScreen` descritos en `wiki/conceptos/web-push-notifications.md`. |
| US-P2-003 Exportación de movimientos (CSV) | **Falta** | No se observa endpoint/export en documentación del vault ni rastros obvios en rutas. |

## 3) Brechas principales detectadas

- **US-P0-004**: falta edición/eliminación de movimientos personales (API y UI asociada).
- **US-P0-014**: estandarizar el formato de errores de validación (contrato consistente).
- **US-P1-003**: faltan filtros y paginación estable en historial.
- **US-P1-005**: falta idempotencia en creación de gasto y creación de liquidación.
