# API (Resumen de Endpoints)

Base URL local: http://localhost:8080

## Salud
- GET /health
  - Respuesta: `{ status: "ok", env: "development|production" }`

## Autenticación (planificado)
- POST /auth/register
- POST /auth/login
- POST /auth/refresh
- POST /auth/logout
- GET /users/me

## Finanzas personales (planificado)
- GET /transactions
- POST /transactions
- PUT /transactions/:id
- DELETE /transactions/:id
- GET /balance

## Grupos (planificado)
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
- Validación de entrada con Zod (a implementar en siguientes iteraciones).
- Autorización mediante JWT (a implementar).

