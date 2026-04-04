# Plan: Backend real de grupos con persistencia, balances y liquidaciones

## Resumen

- Objetivo: sustituir la implementación local de grupos por una implementación real con persistencia en PostgreSQL/Prisma, API REST en Express y consumo desde la pestaña Grupos del frontend.
- Resultado esperado: la pestaña **Grupos** deja de depender de `localStorage`, lee/escribe datos contra backend y muestra grupos, miembros, gastos, balances y liquidaciones reales.
- Alcance de esta iteración: persistencia server-side, endpoints de grupos alineados con el plan del proyecto, cálculo de balances en backend y adaptación del frontend actual para consumir la nueva API.
- Fuera de alcance en esta iteración: invitaciones por email, búsqueda de usuarios, migración automática de datos locales ya guardados, notificaciones, refresh tokens y ledger unificado de saldo personal.

## Análisis del estado actual

### Backend actual

- La API vive en un único router monolítico en [index.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/routes/index.ts#L1-L177).
- Hoy solo existen endpoints reales para:
  - salud/configuración,
  - autenticación (`/auth/register`, `/auth/login`, `/me`),
  - transacciones personales (`GET /transactions`, `POST /transactions`).
- La autenticación está implementada inline en el router actual mediante JWT y helpers locales; no hay middleware reutilizable de autorización.
- Prisma está inicializado de forma mínima en [prisma.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/db/prisma.ts#L1-L3).

### Modelo de datos actual

- El esquema ya contiene las entidades necesarias para grupos en [schema.prisma](file:///c:/Users/gerson/Documents/trae_projects/ger/packages/db/schema.prisma#L35-L99):
  - `Group`
  - `GroupMember`
  - `GroupExpense`
  - `GroupSplit`
  - `GroupSettlement`
- El modelo ya soporta:
  - miembros reales (`userId`) e invitados (`userId = null`),
  - gastos con `splitMethod`,
  - splits explícitos,
  - liquidaciones con estados `proposed|confirmed|cancelled`.
- No hay aún lógica de negocio server-side que use estos modelos.

### Frontend actual

- La pestaña de grupos usa estado local en [useFinanceApp.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/hooks/useFinanceApp.ts#L21-L279).
- El almacenamiento actual de grupos está en [storage.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/lib/storage.ts#L1-L39).
- La lógica de balances y sugerencias vive en frontend en [groups.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/lib/groups.ts#L1-L122).
- La UI de grupos consume tipos locales simplificados en [types.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/types.ts#L30-L61) y [GroupsScreen.tsx](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/GroupsScreen.tsx#L1-L300).

### Infraestructura actual

- El entorno Docker usa `prisma db push` desde `docker-compose.yml` en lugar de migraciones versionadas en [docker-compose.yml](file:///c:/Users/gerson/Documents/trae_projects/ger/docker-compose.yml#L19-L29).
- El script disponible también es `prisma:db-push` en [package.json](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/package.json#L6-L12).

## Decisiones y supuestos

- Se mantendrá el modelo Prisma actual como base para minimizar riesgo; solo se ajustará si hace falta para restricciones o relaciones necesarias del backend real.
- La API de grupos seguirá el contrato funcional descrito en [api.md](file:///c:/Users/gerson/Documents/trae_projects/ger/docs/api.md#L23-L36), adaptado al estado real del proyecto.
- Los balances se calcularán en backend a demanda usando:
  - gastos persistidos,
  - splits persistidos,
  - liquidaciones **confirmadas** como ajuste real de deuda,
  - liquidaciones `proposed` y `cancelled` fuera del neto final.
- Al crear un grupo, el usuario autenticado se creará también como `GroupMember` administrador del grupo.
- En frontend se eliminará la persistencia local de grupos; el token seguirá en `localStorage`.
- No se implementará migración automática de grupos locales antiguos a la base de datos; al pasar a backend, la fuente de verdad será exclusivamente la API.
- Se mantendrá `prisma db push` como mecanismo de evolución de esquema en esta iteración, porque es el flujo real ya usado por Docker y scripts del proyecto.

## Cambios propuestos

### 1) Refactorizar la API para introducir una capa reutilizable de autenticación y grupos

**Archivos a modificar**

- [apps/api/src/routes/index.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/routes/index.ts)

**Archivos a crear**

- `apps/api/src/middlewares/requireAuth.ts`
- `apps/api/src/routes/groups.ts`
- `apps/api/src/routes/auth.ts`
- `apps/api/src/routes/transactions.ts`
- `apps/api/src/lib/groupBalances.ts`
- `apps/api/src/lib/groupSerializers.ts`

**Qué / por qué / cómo**

- Separar el router monolítico actual en routers por dominio:
  - auth,
  - transactions,
  - groups.
- Extraer un middleware `requireAuth` para no repetir parsing/verificación de JWT.
- Añadir helpers de serialización para devolver respuestas estables al frontend y evitar exponer directamente la forma cruda de Prisma.
- Mover el cálculo de balances a una librería backend reutilizable, de forma que el frontend ya no calcule saldos de grupo localmente.
- Mantener `/health` y `/config` en el router raíz para no romper el entorno actual.

### 2) Implementar el dominio backend de grupos completo sobre Prisma

**Archivo principal**

- `apps/api/src/routes/groups.ts`

**Archivos de apoyo**

- `apps/api/src/lib/groupBalances.ts`
- `apps/api/src/lib/groupSerializers.ts`

**Endpoints a implementar**

- `GET /groups`
- `POST /groups`
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

**Decisiones de comportamiento**

- `GET /groups`
  - devolverá solo grupos donde el usuario autenticado:
    - sea `ownerUserId`, o
    - tenga un `GroupMember.userId` asociado.
  - incluirá resumen ligero: id, nombre, moneda, fecha, conteo de miembros, conteo de gastos.
- `POST /groups`
  - creará el grupo,
  - creará al owner como miembro admin,
  - aceptará miembros invitados iniciales por `displayName`,
  - podrá aceptar opcionalmente miembros reales por `userId` si ya se quiere soportar desde API.
- Miembros:
  - se validará que pertenezcan al grupo,
  - se impedirá borrar al último admin,
  - se impedirá borrar un miembro referenciado por gastos o liquidaciones; en ese caso se devolverá error de dominio claro.
- Gastos:
  - `POST /groups/:id/expenses` persistirá:
    - gasto,
    - splits derivados según `equal` o `weights`.
  - `PUT` recalculará y reescribirá los splits del gasto.
  - `DELETE` eliminará gasto y sus splits asociados.
- Reparto:
  - `equal`: divide entre todos los miembros activos del grupo.
  - `weights`: usa `GroupMember.weight`; si falta peso, se tratará como `1`.
  - las diferencias por redondeo a 2 decimales se resolverán en backend de forma determinista sobre el último split para garantizar que la suma cierre exactamente al monto.
- Balances:
  - `GET /groups/:id/balances` devolverá:
    - balances por miembro (`paid`, `owes`, `settledIn`, `settledOut`, `net`),
    - gastos del grupo,
    - liquidaciones existentes,
    - sugerencias de liquidación calculadas a partir del neto final.
- Liquidaciones:
  - `POST /groups/:id/settlements` creará registros con estado inicial `proposed`.
  - `PUT /groups/:id/settlements/:sid` permitirá marcar `confirmed` o `cancelled`.
  - solo las `confirmed` impactarán el neto del balance.

### 3) Endurecer validación y autorización del backend de grupos

**Archivos**

- `apps/api/src/middlewares/requireAuth.ts`
- `apps/api/src/routes/groups.ts`

**Qué / por qué / cómo**

- Validar todas las entradas con Zod siguiendo el patrón ya usado en `transactions`.
- Comprobar pertenencia del usuario al grupo antes de leer datos.
- Comprobar permisos de escritura:
  - lectura: owner o miembro real del grupo,
  - administración de miembros: admin del grupo,
  - creación/edición/borrado de gastos y liquidaciones: admin del grupo.
- Devolver errores 400/401/403/404 con mensajes de dominio claros para que el frontend pueda responder adecuadamente.

### 4) Ajustar el esquema Prisma solo donde sea necesario para la operación real

**Archivo**

- [packages/db/schema.prisma](file:///c:/Users/gerson/Documents/trae_projects/ger/packages/db/schema.prisma)

**Cambios previstos**

- Añadir restricciones e índices mínimos si hacen falta para consultas/consistencia:
  - índices por `groupId`, `userId`, `expenseId`,
  - unicidad razonable si se detectan duplicados posibles,
  - reglas de borrado coherentes para `splits` cuando se borra un gasto.
- Mantener los campos tipo `String` actuales para `role`, `splitMethod` y `status` en esta iteración, salvo que un ajuste concreto sea imprescindible.

**Motivo**

- El modelo ya cubre el dominio; el foco real es activar la lógica de negocio sin introducir una migración estructural mayor innecesaria.

### 5) Migrar el frontend para consumir grupos reales del backend

**Archivos a modificar**

- [apps/web/src/lib/api.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/lib/api.ts)
- [apps/web/src/types.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/types.ts)
- [apps/web/src/hooks/useFinanceApp.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/hooks/useFinanceApp.ts)
- [apps/web/src/screens/GroupsScreen.tsx](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/GroupsScreen.tsx)
- [apps/web/src/screens/DashboardScreen.tsx](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/DashboardScreen.tsx)
- [apps/web/src/screens/ProfileScreen.tsx](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/ProfileScreen.tsx)
- [apps/web/src/lib/storage.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/lib/storage.ts)
- [apps/web/src/lib/groups.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/lib/groups.ts)

**Qué / por qué / cómo**

- Extender `api.ts` con llamadas reales de grupos:
  - listar grupos,
  - crear grupo,
  - crear/editar/borrar miembros,
  - crear/editar/borrar gastos,
  - leer balances,
  - crear/actualizar liquidaciones.
- Sustituir los tipos `LocalGroup` por tipos API reales, manteniendo solo la forma necesaria para UI.
- Cambiar `useFinanceApp.ts` para:
  - cargar grupos desde backend al iniciar sesión,
  - dejar de hidratar grupos desde `storage.ts`,
  - manejar estados de carga/errores específicos de grupos,
  - refrescar balances después de mutaciones.
- Adaptar `GroupsScreen.tsx` a la nueva forma de datos:
  - miembros con `displayName`,
  - balances calculados por backend,
  - sugerencias de liquidación ya devueltas por API,
  - estados reales de settlements.
- Limpiar `storage.ts` para que solo persista el token.
- Reducir `groups.ts` a utilidades puramente de presentación o eliminar la lógica de dominio que pase al backend.
- Ajustar Dashboard/Profile si hoy dependen de supuestos de grupos locales.

### 6) Actualizar documentación técnica para reflejar el estado real

**Archivos**

- [docs/api.md](file:///c:/Users/gerson/Documents/trae_projects/ger/docs/api.md)
- [README.md](file:///c:/Users/gerson/Documents/trae_projects/ger/README.md)

**Qué / por qué / cómo**

- Cambiar la documentación de “planificado” a “implementado” para la parte realmente completada.
- Documentar la forma real de los endpoints de grupos y el hecho de que la pestaña Grupos ahora usa persistencia backend.

## Orden de implementación recomendado

1. Refactorizar router y middleware de auth.
2. Implementar endpoints backend de grupos con validación y serialización.
3. Añadir cálculo backend de balances y sugerencias.
4. Ajustar esquema Prisma si la implementación lo exige y aplicar `db push`.
5. Extender cliente web/API y tipos del frontend.
6. Eliminar persistencia local de grupos del hook y de `storage.ts`.
7. Adaptar la UI de grupos y resúmenes dependientes.
8. Actualizar documentación.

## Verificación

### Backend

- Compilar API con `npm run build:api`.
- Aplicar esquema con el flujo actual del proyecto (`prisma db push` vía script o Docker).
- Levantar entorno con `docker compose up -d`.
- Probar manualmente:
  - registro/login,
  - crear grupo,
  - agregar miembros invitados,
  - crear gasto equal,
  - crear gasto weights,
  - consultar balances,
  - crear liquidación,
  - confirmar liquidación,
  - volver a consultar balances.

### Frontend

- Compilar frontend con `npm run build:web`.
- Verificar en navegador móvil/local:
  - la pestaña Grupos carga desde backend,
  - crear grupo ya no depende de `localStorage`,
  - al recargar la página los grupos siguen existiendo,
  - balances y liquidaciones cambian tras cada mutación,
  - errores de validación/autorización se muestran de forma clara.

### Criterios de aceptación

- Un usuario autenticado puede crear un grupo persistente y verlo tras recargar.
- Un grupo puede tener miembros invitados y reales.
- Un gasto compartido persiste y genera splits correctos.
- `GET /groups/:id/balances` devuelve netos consistentes antes y después de liquidaciones confirmadas.
- La pestaña Grupos deja de usar datos locales como fuente de verdad.
