# API (Resumen de Endpoints)

Base URL local: http://localhost:8080

## Salud y configuración
- `GET /health`
  - Respuesta: `{ status: "ok", env: "development|production" }`
- `GET /config`
  - Respuesta: `{ hasDatabaseUrl: true|false }`

## Autenticación
- `POST /auth/register`
- `POST /auth/login`
- `GET /me`

## Finanzas personales
- `GET /balance`
- `GET /transactions`
- `GET /transactions/export.csv`
- `POST /transactions`
- `PATCH /transactions/:id`
- `DELETE /transactions/:id`

## Categorías
- `GET /categories`
- `POST /categories`
- `PATCH /categories/:id`
- `DELETE /categories/:id`
- `GET /groups/:id/categories`
- `POST /groups/:id/categories`
- `PATCH /groups/:groupId/categories/:id`
- `DELETE /groups/:groupId/categories/:id`

## Grupos
- `GET /groups`
- `POST /groups`
- `POST /groups/join-by-code`
- `GET /groups/:id/join-code`
- `GET /groups/:id/members`
- `POST /groups/:id/members`
- `PUT /groups/:id/members/:mid`
- `DELETE /groups/:id/members/:mid`
- `POST /groups/:id/members/:mid/rejoin`
- `GET /groups/:id/expenses`
- `POST /groups/:id/expenses`
- `PUT /groups/:id/expenses/:eid`
- `DELETE /groups/:id/expenses/:eid`
- `GET /groups/:id/balances`
- `POST /groups/:id/settlements`
- `PUT /groups/:id/settlements/:sid`

## Notificaciones push
- `GET /push/vapid-public-key`
- `POST /push/subscribe`

## Presupuestos
- `GET /budgets`
- `POST /budgets`
- `PATCH /budgets/:id`
- `DELETE /budgets/:id`

## Insights
- `GET /insights/monthly-summary?month=&year=` — resumen del mes (por defecto, el actual): ingresos, gastos, categoría con mayor gasto, comparación con el mes anterior (`expenseDeltaPercent`, `null` si el mes anterior no tiene gastos) y consejos simples (`tips`). El cálculo vive en el servicio de dominio `calculateMonthlySummary` (`src/domain/insights`).

## Billing (free/premium)
- `GET /billing/plan` — plan efectivo del usuario (`free` | `premium`), límites (`limits.maxOwnedGroups`, `null` = ilimitado) y uso actual (`usage.ownedGroups`). El plan se resuelve desde la entidad `Subscription` (sin suscripción, cancelada o caducada → `free`).
- `POST /groups` devuelve `403 PLAN_LIMIT_REACHED` (con `details: { feature, plan, limit, current }`) cuando un usuario free intenta crear más grupos de los que permite su plan (1 grupo propio). La regla vive en `canCreateGroup` / `resolvePlan` (`src/domain/billing/services/plan-policy.ts`), nunca en controladores. El frontend muestra el paywall al recibir ese código.

---

## Notas generales

### Autenticación y validación
- Todos los endpoints protegidos requieren JWT Bearer token en el header `Authorization`.
- Validación de entrada implementada con Zod en auth, transacciones, categorías y grupos.
- Errores: `400` datos inválidos, `401` no autenticado, `403` sin permisos, `404` no encontrado, `409` conflicto.

### Categorías
- Existen 3 tipos de categorías según su ámbito:
  - **Globales**: `userId = null`, `groupId = null` (solo lectura, creadas por defecto al iniciar la app)
  - **Personales**: `userId = <id del usuario>`, `groupId = null` (CRUD completo para el propietario)
  - **De grupo**: `userId = null`, `groupId = <id del grupo>` (CRUD completo para miembros del grupo)
- `GET /categories` devuelve categorías globales + personales del usuario autenticado.
- `GET /groups/:id/categories` devuelve categorías globales + del grupo específico.
- **Categorías personales**:
  - `POST /categories` crea una categoría personal. Body: `{ name, type: 'income' | 'expense', color?, icon? }`.
  - `PATCH /categories/:id` edita una categoría personal. Body: `{ name?, color?, icon? }`. Solo el propietario puede editar.
  - `DELETE /categories/:id` elimina una categoría personal. Solo el propietario puede eliminar.
- **Categorías de grupo**:
  - `POST /groups/:id/categories` crea una categoría del grupo. Body: `{ name, type: 'income' | 'expense', color?, icon? }`.
  - `PATCH /groups/:groupId/categories/:id` edita una categoría del grupo. Body: `{ name?, color?, icon? }`. Solo miembros del grupo.
  - `DELETE /groups/:groupId/categories/:id` elimina una categoría del grupo. Solo miembros del grupo.
- Las categorías globales **no se pueden editar ni eliminar** desde ningún endpoint.

### Transacciones personales
- `GET /transactions` soporta paginación por cursor y filtros por query params:
  - `from`, `to` — rango de fechas (ISO datetime)
  - `type` — `'income' | 'expense'`
  - `origin` — `'manual' | 'group'` (transacciones manuales vs derivadas de gastos de grupo)
  - `cursor`, `limit` — paginación (default 20, max 100)
  - Respuesta: `{ transactions[], nextCursor, hasMore }`
- `GET /transactions/export.csv` exporta todas las transacciones filtradas a CSV. Mismos filtros que `GET /transactions` excepto cursor/limit. Descarga automática como `movimientos-YYYY-MM-DD.csv`.
- `POST /transactions` crea una transacción manual. Body: `{ type, amount, categoryId?, note?, occurredAt? }`. `amount` acepta número o string.
- `PATCH /transactions/:id` edita una transacción manual propia. Body: `{ type?, amount?, categoryId?, note?, occurredAt? }`. No se puede editar si `locked: true`.
- `DELETE /transactions/:id` elimina una transacción manual propia. No se puede eliminar si `locked: true`.
- Las transacciones con `sourceType` derivado de grupo (`group_expense`, `group_settlement_paid`, `group_settlement_received`) tienen `locked: true` y no se pueden editar ni eliminar manualmente.

### Balances
- `GET /balance` devuelve: `{ personalIncome, personalExpense, personalBalance, groupNet, totalBalance, groupsBreakdown[] }`.
- `GET /groups/:id/balances` devuelve: `{ group, members[], expenses[], settlements[], balances[], suggestions[] }`.

### Grupos
- `POST /groups` crea un grupo con miembros opcionales. Body: `{ name, currency?, members?: [{ userId?, displayName, weight?, role? }] }`. El creador se añade automáticamente como admin.
- `POST /groups/join-by-code` crea un miembro real usando un código de grupo. Body: `{ code }`.
- `GET /groups/:id/join-code` expone el código del grupo (solo para admins).
- `POST /groups/:id/members` añade un miembro al grupo (solo admin). Body: `{ userId?, displayName, weight?, role? }`.
- `PUT /groups/:id/members/:mid` actualiza un miembro (solo admin). Body: `{ displayName?, weight?, role? }`. El último admin no puede perder permisos de administración.
- `DELETE /groups/:id/members/:mid` da de baja un miembro (soft delete, marca `leftAt`). Solo admin. No puedes eliminarte a ti mismo ni al último admin del grupo.
- `POST /groups/:id/members/:mid/rejoin` reactiva un miembro que fue dado de baja. Solo admin.
- `POST /groups/:id/expenses` y `PUT /groups/:id/expenses/:eid` soportan:
  - `splitMethod: 'equal'` — reparto equitativo automático
  - `splitMethod: 'manual'` — reparto manual con importes exactos por miembro
  - Ambos requieren `idempotencyKey` en el body para evitar duplicados.
  - En reparto manual la suma de `shareAmount` debe coincidir exactamente con el total del gasto.
- La edición/creación de gastos está permitida al **admin del grupo**, al **creador del gasto** (`createdByMemberId`), o al **pagador** (si no hay `createdByMemberId`).
- `DELETE /groups/:id/expenses/:eid` elimina un gasto y sus transacciones derivadas. Solo admin.
- `POST /groups/:id/settlements` registra una liquidación. Body: `{ fromMemberId, toMemberId, amount, occurredAt?, idempotencyKey }`. Requiere `idempotencyKey`. El usuario debe ser el deudor (`fromMemberId`). Valida que exista deuda real y que el monto no supere lo pendiente.
- `PUT /groups/:id/settlements/:sid` cambia estado a `confirmed` o `cancelled`. Solo admin del grupo.

### Moneda y redondeo
- Los importes de reparto se calculan y cierran siempre a **2 decimales**.
- Nuevos usuarios y grupos usan **EUR** por defecto.

### Sincronización frontend
- El frontend refresca automáticamente grupos y saldo consolidado cada **10 segundos** mientras la pestaña está visible.
- También refresca inmediatamente al recuperar foco o visibilidad de ventana.

### Presupuestos
- `GET /budgets` lista los presupuestos del usuario autenticado. Soporta filtros opcionales por query params:
  - `month` — mes (1-12)
  - `year` — año (2020-2099)
  - `period` — periodo (`monthly`)
  - `categoryId` — ID de categoría personal del usuario
  - Respuesta: `{ budgets[] }`
- `POST /budgets` crea un presupuesto. Body: `{ categoryId, amount, period: 'monthly', month, year }`.
  - `amount` debe ser mayor que 0.
  - `categoryId` debe ser una categoría personal del usuario (no globales ni de grupo).
  - Respuesta 201: `{ budget }`
  - Error 409 si ya existe un presupuesto para la misma categoría/mes/año/periodo.
- `PATCH /budgets/:id` edita un presupuesto propio. Body parcial: `{ categoryId?, amount?, period?, month?, year? }`.
  - Valida que el presupuesto pertenezca al usuario (404 si no existe).
  - Valida categoría personal si se cambia `categoryId`.
  - Detecta conflictos de unicidad si se cambian campos que afectan la clave única (409).
- `DELETE /budgets/:id` elimina un presupuesto propio.
  - Respuesta 204 sin body.
  - Error 404 si no existe o no pertenece al usuario.
