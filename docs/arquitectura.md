# Arquitectura

## Visión general
- SPA React (apps/web) que consume una API REST (apps/api).
- API Node.js/Express con TypeScript y validación de entrada.
- Persistencia en PostgreSQL, modelada con Prisma (packages/db).
- Contenedores Docker por servicio y orquestación con Docker Compose.

## Módulos
- apps/web: interfaz con Vite, React 18 y TS.
- apps/api: servidor Express; rutas de salud y próximas rutas de auth, transacciones y grupos.
- packages/db: schema Prisma que define usuarios, transacciones personales, grupos, miembros, gastos, splits y liquidaciones.

## Datos principales (resumen)
- User: email, hash de contraseña, moneda, timestamps.
- PersonalTransaction: ingresos/gastos por usuario.
- Group: metadatos y moneda de grupo.
- GroupMember: miembro real (userId) o invitado (userId null) con displayName y peso opcional.
- GroupExpense y GroupSplit: gasto y reglas de reparto (equitativo/pesos).
- GroupSettlement: liquidaciones entre miembros.

## Flujos clave
- Autenticación: email + contraseña (JWT corto + refresh).
- Finanzas personales: CRUD de transacciones y cálculo de saldo.
- Grupos: alta/edición de miembros, registro de gastos, cálculo de balances y liquidaciones.

## Contenedores
- api: compila TS, genera Prisma Client y expone 8080.
- web (dev): Vite server en 3000; (prod): Nginx sirviendo estáticos.
- db: Postgres 15 con volumen persistente.
- migrate: aplica “db push” o migraciones antes de levantar api.

## Rutas de referencia
- API base: http://localhost:8080
- Salud: GET /health
- Frontend dev: http://localhost:3000

