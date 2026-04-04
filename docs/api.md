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
- GET /transactions
- POST /transactions

## Grupos
- GET /groups
- POST /groups
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
- `GET /groups/:id/balances` devuelve miembros, gastos, liquidaciones, balances y sugerencias de liquidación.
- Las liquidaciones impactan el neto del grupo solo cuando su estado es `confirmed`.
