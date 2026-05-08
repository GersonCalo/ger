# Plan: Plataforma de finanzas personales y gastos compartidos

## Resumen

* Objetivo: construir una aplicación web que gestione finanzas personales e integre gastos compartidos en grupos, con un único saldo central por usuario.

* Alcance inicial (MVP): autenticación por email/contraseña, modelo monomoneda, reparto en grupos equitativo y por porcentajes/pesos, sin integraciones bancarias, soporte de participantes “invitados/falsos” en grupos.

* Entorno: Frontend React, Backend Node.js/Express, Base de datos PostgreSQL.&#x20;

* Portabilidad: todo el proyecto se ejecuta con Docker (desarrollo y producción) para desplegar “en cualquier lugar”.

## Estado actual

* Repositorio: vacío en c:\Users\gerson.calo\Documents\trae\_projects\ger.

* No existen dependencias ni estructura de proyecto; se requiere scaffolding completo (frontend, backend y base de datos).

## Decisiones confirmadas

* Autenticación: Email + contraseña con verificación por correo y recuperación.

* Moneda: Monomoneda (moneda base por usuario/grupo; sin FX en MVP).

* Repartos de grupo: Equitativo y por porcentajes/pesos (seleccionable por gasto).

* Integraciones bancarias: Ninguna en MVP (entrada manual/CSV opcional).

* Participantes en grupos: se admiten miembros vinculados a usuarios reales y participantes “falsos” (sin cuenta) para separar gastos.

## Arquitectura propuesta

* Monorepo con tres paquetes principales:

  * apps/web: SPA React + TypeScript (Vite), estado con React Query, componentes básicos; diseño adaptable.

  * apps/api: Node.js + Express + TypeScript; JWT para sesiones; validación de entrada; controladores REST.

  * packages/db: ORM Prisma con PostgreSQL; migraciones versionadas; acceso compartido por API.

* Comunicación: REST JSON entre web y api; CORS configurado.

* Configuración: variables de entorno (.env) gestionadas por AWS Secrets Manager en producción; nunca versionar secretos.

* Contenedorización: Dockerfiles por servicio y orquestación con docker-compose para entorno local y producción.

## Modelo de datos (Prisma/SQL)

* users: id, email (único), password\_hash, name, currency (moneda base), created\_at.

* sessions (opcional si se usa JWT de corta duración + refresh): id, user\_id, refresh\_token, expires\_at.

* personal\_transactions: id, user\_id, type ('income'/'expense'), amount, category, occurred\_at, note.

* groups: id, name, owner\_user\_id, currency, created\_at.

* group\_members: id, group\_id, user\_id (nullable), display\_name, weight (nullable), role ('member'/'admin').

* group\_expenses: id, group\_id, payer\_member\_id, amount, description, occurred\_at, split\_method ('equal'/'weights').

* group\_splits: id, expense\_id, member\_id, share\_amount (opcional), share\_weight (opcional) — se calcula según método.

* group\_settlements: id, group\_id, from\_member\_id, to\_member\_id, amount, occurred\_at, status ('proposed'/'confirmed'/'cancelled').

* unified\_ledger\_entries (derivado o materializado): referencia cruzada para reflejar en el saldo personal los efectos netos de los grupos (recepciones y pagos).

## Flujos clave

* Registro/Login: email + contraseña; verificación por correo; JWT (access + refresh) y revocación.

* Finanzas personales: alta/edición de ingresos y gastos; saldo calculado por suma de transacciones + efecto neto de grupos.

* Grupos:

  * Miembros: añadir usuarios reales (user\_id) y participantes falsos (user\_id null, display\_name).

  * Gastos: creación con método de reparto (equitativo o pesos). El pagador es un miembro concreto.

  * Cálculo de balances: por grupo, se computa lo debido/por cobrar por miembro.

  * Liquidaciones: registrar pagos entre miembros; marcar como confirmadas; para participantes falsos se registran como “externas”.

* Integración con saldo personal: el efecto neto por usuario (pagos realizados - deudas propias + cobros a otros) se refleja en unified\_ledger\_entries.

## API (Express)

* Autenticación:

  * POST /auth/register, POST /auth/login, POST /auth/refresh, POST /auth/logout

  * GET /users/me

* Finanzas personales:

  * GET/POST/PUT/DELETE /transactions

  * GET /balance (saldo personal incluyendo grupos)

* Grupos:

  * GET/POST /groups

  * GET/POST/PUT/DELETE /groups/:id/members

  * GET/POST/PUT/DELETE /groups/:id/expenses

  * GET /groups/:id/balances

  * POST /groups/:id/settlements (crear), PUT /groups/:id/settlements/:sid (confirmar/cancelar)

## Frontend (React)

* Páginas:

  * Dashboard: saldo, resumen de grupos, liquidaciones pendientes.

  * Finanzas personales: lista y formulario de transacciones.

  * Grupos: listado; detalle con miembros, gastos, balances; formulario de gasto (método de reparto).

* Componentes clave:

  * Formulario de gasto con selector de método (equitativo/pesos), pesos por miembro, soporte de participantes falsos.

  * Tabla de balances del grupo con sugerencias de liquidación.

* Estado/validación:

  * React Query para datos; validación con Zod en formularios y en API.

## Seguridad

* Hash de contraseñas con bcrypt.

* JWT de corta duración; refresh tokens almacenados de forma segura; revocación en servidor.

* Validación de entrada estricta (Zod/Joi); sanitización.

* Registros de auditoría mínimos; protección de CORS; rate limiting en rutas sensibles.

## Infraestructura (AWS)

### Contenedorización y despliegue con Docker

* Objetivo: portabilidad total; “docker-compose up” levanta web, api y db localmente; en producción se usa el mismo enfoque o despliegue a cualquier proveedor compatible con Docker.

* Servicios en docker-compose.yml (raíz del repo):

  * db: imagen postgres:15, volumen persistente, variables POSTGRES\_USER/PASSWORD/DB.

  * api: build apps/api/Dockerfile; variables de entorno; healthcheck; depende de db; ejecuta migraciones (prisma migrate) al inicio o vía servicio dedicado.

  * migrate (opcional): job one-shot para ejecutar migraciones antes de api.

  * web (desarrollo): build apps/web/Dockerfile.dev con Vite dev server y Hot Reload.

  * web (producción): build apps/web/Dockerfile para generar estáticos y servir con nginx:alpine.

* Red: red interna para api<->db, exposición de puertos: api (por ejemplo 8080), web (por ejemplo 3000/80).

* Variables de entorno: .env y .env.production; en servidores usar inyección segura (secrets/variables).

* Logs: salida estándar; se puede integrar con cualquier stack (ELK/Datadog) sin cambiar código.

### Despliegue en cloud (opciones)

* Cualquier proveedor compatible con Docker/Compose:

  * VPS (DigitalOcean, Hetzner): docker-compose con systemd y volúmenes.

  * Plataformas PaaS (Render, Railway): servicios Docker; base de datos gestionada o contenedorizada.

  * AWS ECS/Fargate: usar imágenes y definición de tareas; secretos en Secrets Manager; RDS opcional.

## Verificación y pruebas

* Unit tests: lógica de reparto (equitativo y pesos), cálculo de balances por grupo, efectos en unified\_ledger\_entries.

* Integra/E2E: flujos de registro, creación de grupo, alta de miembros (usuario real y falso), creación de gasto, visualización de balance, liquidación.

* Datos de prueba: seeding de 2 usuarios + 1 participante falso + 1 grupo + 3 gastos.

* Criterios de aceptación:

  * Un usuario puede registrar ingresos/gastos, ver saldo.

  * En un grupo, se crean miembros (reales y falsos), se agrega un gasto y se ve el reparto correcto.

  * Los balances muestran cuánto debe cada miembro; se registran liquidaciones.

  * El saldo personal refleja el efecto neto de los grupos.

## Plan de ejecución (fases y archivos)

1. Inicialización de monorepo:

   * Crear estructura:

     * apps/web (React + Vite + TS): src/App.tsx, src/pages/{Dashboard,Personal,Grupos}.tsx

     * apps/api (Express + TS): src/index.ts, src/routes/{auth,transactions,groups}.ts

     * packages/db (Prisma): schema.prisma, migrations/

   * Configuración de eslint/prettier, tsconfig, .env.example
2. Contenedorización:

   * Crear Dockerfiles:

     * apps/api/Dockerfile (multi-stage: build + runtime; ejecuta prisma generate; CMD “node dist/index.js”).

     * apps/web/Dockerfile (multi-stage: build y nginx para producción).

     * apps/web/Dockerfile.dev (desarrollo con Vite).

   * Crear docker-compose.yml (servicios: db, migrate, api, web) y docker-compose.prod.yml (override para producción).

   * Definir volúmenes persistentes para Postgres y mapeo de puertos.
3. Modelo de datos y migraciones:

   * Definir schema.prisma con tablas indicadas; generar migraciones; conectar a PostgreSQL local.
4. Backend API:

   * Implementar auth (register/login/refresh) con bcrypt/JWT.

   * Rutas de transacciones personales y cálculo de saldo.

   * Rutas de grupos, miembros (incluye falsos), gastos, balances, liquidaciones.

   * Validación con Zod; control de errores; pruebas unitarias de lógica de reparto.
5. Frontend:

   * Páginas y formularios; componentes de gasto con selector de método; tablas de balances y liquidaciones.

   * Estado con React Query; integración con API; mensajes de error y loaders.
6. Integración y despliegue:

   * Pipeline CI (lint, build, tests).

   * Ejecución local: docker-compose up (dev) y docker-compose -f docker-compose.yml -f docker-compose.prod.yml up (prod).

   * Despliegue a proveedor: subir imágenes, inyectar variables y levantar servicios; DB persistente/gestionada; TLS mediante reverse proxy (nginx/traefik) si procede.

## Supuestos y riesgos

* Monomoneda elimina complejidad de FX pero implica acordar moneda por grupo y usuario.

* Participantes falsos requieren cuidado en liquidaciones (no hay cuentas ni notificaciones); se marcan como “externas”.

* Sin integraciones bancarias, la entrada es manual; CSV puede añadirse luego.

* La sugerencia de Prisma puede cambiar si prefieres SQL puro o otro ORM.

