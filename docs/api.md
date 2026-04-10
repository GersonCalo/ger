# API (Resumen de Endpoints)

Base URL local: http://localhost:8080

## Salud
- `GET /health`
  - Respuesta: `{ status: "ok", env: "development|production" }`

## Autenticación
- `POST /auth/register`
- `POST /auth/login`
- `GET /me`

## Finanzas personales
- `GET /balance`
- `GET /transactions`
- `POST /transactions`

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
- `GET /groups/:id/expenses`
- `POST /groups/:id/expenses`
- `PUT /groups/:id/expenses/:eid`
- `DELETE /groups/:id/expenses/:eid`
- `GET /groups/:id/balances`
- `POST /groups/:id/settlements`
- `PUT /groups/:id/settlements/:sid`

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

### Balances
- `GET /balance` devuelve: `{ personalIncome, personalExpense, personalBalance, groupNet, totalBalance, groupsBreakdown[] }`.
- `GET /groups/:id/balances` devuelve: `{ members[], expenses[], settlements[], balances[], suggestions[] }`.

### Grupos
- `POST /groups/join-by-code` crea un miembro real usando un código fijo del grupo. Body: `{ code }`.
- `GET /groups/:id/join-code` expone el código del grupo (solo para admins).
- `POST /groups/:id/expenses` y `PUT /groups/:id/expenses/:eid` soportan:
  - `splitMethod: 'equal'` — reparto equitativo automático
  - `splitMethod: 'manual'` — reparto manual con importes exactos por miembro
- En reparto manual la suma de `shareAmount` debe coincidir exactamente con el total del gasto.
- La edición de gastos está permitida al **admin del grupo** y al **pagador del gasto**.
- `POST /groups/:id/settlements` registra una liquidación propuesta.
- `PUT /groups/:id/settlements/:sid` cambia estado a `confirmed` o `cancelled`.
- El usuario autenticado solo puede registrar liquidaciones donde sea el deudor (`fromMemberId`).

### Moneda y redondeo
- Los importes de reparto se calculan y cierran siempre a **2 decimales**.
- Nuevos usuarios y grupos usan **EUR** por defecto.

### Sincronización frontend
- El frontend refresca automáticamente grupos y saldo consolidado cada **10 segundos** mientras la pestaña está visible.
- También refresca inmediatamente al recuperar foco o visibilidad de ventana.
