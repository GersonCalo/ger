# API (Resumen de Endpoints)

Base URL local: http://localhost:8080

## Salud
- GET /health
  - Respuesta: `{ status: "ok", env: "development|production" }`

## Autenticación
- POST /auth/register
- POST /auth/login
- GET /me

## Finanzas personales
- GET /balance
- GET /transactions
- POST /transactions

## Grupos
- GET /groups
- POST /groups
- POST /groups/join-by-code
- GET /groups/:id/join-code
- GET /groups/:id/members
- POST /groups/:id/members
- PUT /groups/:id/members/:mid
- DELETE /groups/:id/members/:mid
- GET /groups/:id/expenses
- POST /groups/:id/expenses
- PUT /groups/:id/expenses/:eid
- DELETE /groups/:id/expenses/:eid
- GET /groups/:id/balances
- POST /groups/:id/settlements
- PUT /groups/:id/settlements/:sid

Notas:
- Validación de entrada implementada con Zod en auth, transacciones y grupos.
- Autorización implementada mediante JWT Bearer.
- `GET /balance` devuelve saldo personal, neto agregado de grupos y total consolidado.
- `GET /groups/:id/balances` devuelve miembros, gastos, liquidaciones, balances y sugerencias de liquidación.
- `POST /groups/join-by-code` crea un miembro real para el usuario autenticado usando un código fijo del grupo.
- `GET /groups/:id/join-code` expone el código del grupo para admins.
- `POST /groups/:id/settlements` registra una liquidación aplicada al balance desde el momento de creación.
- El usuario autenticado solo puede registrar liquidaciones saliendo de su propio balance como deudor.
- Las sugerencias de liquidación sirven como atajo de ejecución, pero la UI mantiene también el registro manual de importes parciales.
- Los importes de reparto se calculan y cierran siempre a dos decimales.
- Los nuevos usuarios y grupos usan EUR por defecto.
- El frontend refresca automáticamente grupos y saldo consolidado cada 10 segundos mientras la pestaña está visible y también al recuperar foco.
