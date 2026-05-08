# Plan: Ledger unificado y unión a grupos por código

## Resumen

- Objetivo: hacer que el saldo personal global refleje también el efecto neto de los grupos y añadir un flujo real para unir usuarios a grupos mediante un código compartible.
- Resultado esperado:
  - el dashboard muestra por separado saldo personal, efecto neto de grupos y total consolidado,
  - un usuario autenticado puede copiar un código fijo de grupo y otro usuario puede unirse desde la pestaña Grupos pegando ese código,
  - los grupos pasan a poder tener más de un usuario real de forma explícita y usable desde producto.
- Ajustes adicionales confirmados:
  - el reparto backend debe cerrar siempre con importes redondeados a 2 decimales,
  - la moneda por defecto de la app pasa a EUR para datos nuevos,
  - los datos existentes conservan su moneda actual.

## Estado actual

### Saldo personal y dashboard

- El resumen personal actual se calcula solo con transacciones personales en [useFinanceApp.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/hooks/useFinanceApp.ts#L386-L408).
- El dashboard consume únicamente `summary.balance`, `summary.income` y `summary.expense` en [DashboardScreen.tsx](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/DashboardScreen.tsx#L35-L48).
- No existe hoy un endpoint `GET /balance` ni una proyección backend de saldo consolidado; las rutas personales actuales son solo [transactions.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/routes/transactions.ts#L1-L68).

### Balance de grupos

- El neto por miembro ya se calcula en backend como `paid - owes - settledOut + settledIn` en [groupBalances.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/lib/groupBalances.ts#L92-L154).
- El endpoint [groups.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/routes/groups.ts#L763-L870) ya devuelve miembros, gastos, liquidaciones, balances y sugerencias, pero no expone un agregado “mi efecto global de grupos”.
- El vínculo real entre usuario y grupo ya existe mediante `GroupMember.userId` en [schema.prisma](file:///c:/Users/gerson/Documents/trae_projects/ger/packages/db/schema.prisma#L52-L70).

### Unión de usuarios reales a grupos

- Hoy no existe modelo, endpoint ni UI para invitación o unión por código.
- La API ya puede añadir miembros reales si se pasa `userId`, pero la UI actual solo manda `displayName` para invitados en [api.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/lib/api.ts#L143-L156) y [useFinanceApp.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/hooks/useFinanceApp.ts#L319-L340).
- La pantalla de grupos actual centraliza creación de grupo, alta manual de invitados, gastos y liquidaciones en [GroupsScreen.tsx](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/GroupsScreen.tsx#L1-L452).

### Moneda y redondeo

- Los defaults persistentes siguen en USD para `User.currency` y `Group.currency` en [schema.prisma](file:///c:/Users/gerson/Documents/trae_projects/ger/packages/db/schema.prisma#L11-L22) y [schema.prisma](file:///c:/Users/gerson/Documents/trae_projects/ger/packages/db/schema.prisma#L37-L50).
- El formateo visual ya usa locale `es-ES` y respeta el código de moneda recibido en [format.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/lib/format.ts#L1-L10).
- La lógica de reparto actual ya intenta cerrar céntimos en backend, pero hay que endurecer la regla de “siempre a dos decimales” como criterio explícito de esta entrega en [groupBalances.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/lib/groupBalances.ts#L27-L90) y [groups.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/routes/groups.ts#L182-L259).

## Decisiones y supuestos confirmados

- Ledger global:
  - el dashboard mostrará tres magnitudes separadas:
    - saldo personal,
    - efecto neto de grupos,
    - total consolidado.
- Unión por código:
  - el código será fijo por grupo en esta primera versión,
  - si un usuario entra con código y ya existía un invitado “parecido”, no se fusionará; se creará un miembro real nuevo.
- Moneda:
  - EUR será el default para nuevos usuarios y nuevos grupos,
  - no se migrarán automáticamente usuarios o grupos existentes.
- Criterio de ledger:
  - el “efecto neto de grupos” se derivará del neto vigente de todos los grupos donde el usuario tenga `GroupMember.userId`,
  - solo las liquidaciones `confirmed` modificarán ese neto, igual que hoy ocurre en balances de grupo.
- Alcance de esta iteración:
  - no incluye invitaciones por email,
  - no incluye regeneración de código,
  - no incluye fusión retroactiva de invitados con usuarios reales,
  - no incluye selector general de moneda por usuario desde UI de perfil salvo que sea necesario para mantener coherencia del registro nuevo.

## Cambios propuestos

### 1) Añadir soporte persistente de código de grupo

**Archivo principal**

- [schema.prisma](file:///c:/Users/gerson/Documents/trae_projects/ger/packages/db/schema.prisma)

**Archivos a modificar**

- [groups.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/routes/groups.ts)
- [groupSerializers.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/lib/groupSerializers.ts)
- [api.md](file:///c:/Users/gerson/Documents/trae_projects/ger/docs/api.md)

**Qué / por qué / cómo**

- Añadir un campo persistente `joinCode` en `Group`, único e indexado, para que cada grupo tenga un código estable.
- Generar el código al crear el grupo desde backend; no depender del frontend para ello.
- Incluir el código en las respuestas de detalle/resumen de grupo solo donde tenga sentido para la UI autenticada.
- Validar unicidad y longitud razonable del código para que sea compartible manualmente.

### 2) Implementar la unión a grupos por código en backend

**Archivo principal**

- [groups.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/routes/groups.ts)

**Archivos a modificar**

- [api.md](file:///c:/Users/gerson/Documents/trae_projects/ger/docs/api.md)
- [README.md](file:///c:/Users/gerson/Documents/trae_projects/ger/README.md)

**Endpoints nuevos**

- `POST /groups/join-by-code`
- `GET /groups/:id/join-code`

**Qué / por qué / cómo**

- `GET /groups/:id/join-code`
  - devolverá el código fijo del grupo,
  - quedará restringido a owner/admin del grupo.
- `POST /groups/join-by-code`
  - recibirá el código,
  - localizará el grupo,
  - comprobará que el usuario autenticado aún no pertenece como miembro real,
  - creará un `GroupMember` real con `userId = usuario autenticado`,
  - usará como `displayName` el nombre o email del usuario,
  - asignará rol `member` y `weight = 1`.
- Se devolverán errores claros para:
  - código inexistente,
  - usuario ya unido al grupo,
  - grupo inconsistente o inaccesible.

### 3) Diseñar el ledger unificado como cálculo derivado, no como tabla materializada

**Archivos principales**

- `apps/api/src/lib/userBalance.ts`
- [transactions.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/routes/transactions.ts)

**Archivos de apoyo**

- [groups.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/routes/groups.ts)
- [groupBalances.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/lib/groupBalances.ts)

**Qué / por qué / cómo**

- Implementar un helper backend que calcule, para un usuario:
  - total de ingresos personales,
  - total de gastos personales,
  - saldo personal puro,
  - neto agregado de grupos donde participa como miembro real,
  - total consolidado = saldo personal + neto de grupos.
- En esta fase se hará como cálculo derivado “on demand”, reutilizando:
  - `PersonalTransaction`,
  - `GroupMember.userId`,
  - balances ya calculables por grupo.
- Evita introducir una tabla `unified_ledger_entries` ahora mismo y reduce riesgo de desincronización; deja abierta una futura materialización si el volumen crece.

### 4) Exponer un endpoint real de balance global

**Archivo**

- [transactions.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/routes/transactions.ts)

**Qué / por qué / cómo**

- Añadir `GET /balance` protegido por JWT.
- La respuesta incluirá al menos:
  - `personalIncome`
  - `personalExpense`
  - `personalBalance`
  - `groupNet`
  - `totalBalance`
  - `groupsBreakdown` con cada grupo y el neto del usuario
- Esto permite que el frontend deje de derivar el saldo global localmente y consuma una fuente única de verdad desde backend.

### 5) Garantizar redondeo monetario estricto a dos decimales en grupos

**Archivos**

- [groupBalances.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/lib/groupBalances.ts)
- [groups.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/routes/groups.ts)

**Qué / por qué / cómo**

- Centralizar helpers de dinero en céntimos:
  - conversión a céntimos,
  - normalización desde `Decimal`,
  - vuelta a importe con 2 decimales.
- Asegurar que:
  - los splits guardados siempre se persisten con 2 decimales,
  - la suma de splits coincide exactamente con el importe del gasto,
  - balances y sugerencias no acumulan ruido de redondeo.
- Revisar reparto `equal` y `weights` para que el cierre de céntimos quede determinista.

### 6) Cambiar el default de moneda a EUR para nuevos datos

**Archivos**

- [schema.prisma](file:///c:/Users/gerson/Documents/trae_projects/ger/packages/db/schema.prisma)
- [auth.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/routes/auth.ts)
- [groups.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/routes/groups.ts)
- [ProfileScreen.tsx](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/ProfileScreen.tsx)
- [README.md](file:///c:/Users/gerson/Documents/trae_projects/ger/README.md)

**Qué / por qué / cómo**

- Cambiar el default persistente de `currency` a `EUR`.
- Mantener compatibilidad con datos existentes: no se tocarán registros ya creados.
- Asegurar que usuario nuevo y grupo nuevo usen EUR cuando no se especifique otra cosa.
- Ajustar textos de UI/documentación para que el comportamiento esperado quede claro.

### 7) Adaptar el cliente web y los tipos al nuevo balance global y a la unión por código

**Archivos**

- [types.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/types.ts)
- [api.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/lib/api.ts)
- [useFinanceApp.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/hooks/useFinanceApp.ts)

**Qué / por qué / cómo**

- Añadir tipos para:
  - payload de `GET /balance`,
  - payload de `POST /groups/join-by-code`,
  - posible exposición de `joinCode` en grupos.
- Extender `api.ts` con:
  - `balance(token)`,
  - `joinGroupByCode(token, code)`,
  - `groupJoinCode(token, groupId)`.
- Cambiar `useFinanceApp.ts` para:
  - cargar el balance consolidado al iniciar sesión,
  - refrescarlo después de transacciones, gastos, nuevas uniones y liquidaciones,
  - exponer acciones para unirse por código y copiar/mostrar el código del grupo seleccionado.
- Mantener el enfoque de evitar waterfalls: cargar en paralelo `me`, `transactions`, `groups` y `balance` cuando sea posible.

### 8) Rediseñar la pestaña Grupos para soportar compartir código y unirse a un grupo

**Archivo principal**

- [GroupsScreen.tsx](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/GroupsScreen.tsx)

**Archivos de apoyo**

- [App.tsx](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/App.tsx)

**Qué / por qué / cómo**

- Añadir un nuevo bloque “Unirse a un grupo” dentro de la pestaña Grupos:
  - input para pegar código,
  - acción de unirse,
  - feedback de error/éxito.
- Añadir en el detalle del grupo un bloque “Código del grupo”:
  - mostrar el código del grupo seleccionado,
  - ofrecer botón de copiar o, como mínimo, mostrarlo claramente.
- Mantener la pantalla actual de creación y operación del grupo, sin mezclar innecesariamente la lógica de join con la de gastos.
- Si el usuario se une con éxito:
  - refrescar listado,
  - seleccionar el grupo unido,
  - cargar su detalle actualizado.

### 9) Actualizar el dashboard para mostrar saldo personal, neto de grupos y total consolidado

**Archivo principal**

- [DashboardScreen.tsx](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/DashboardScreen.tsx)

**Archivos de apoyo**

- [useFinanceApp.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/hooks/useFinanceApp.ts)

**Qué / por qué / cómo**

- Sustituir el summary actual derivado solo de transacciones por un summary consolidado desde API.
- Mostrar explícitamente:
  - saldo personal,
  - efecto neto de grupos,
  - saldo total consolidado.
- Reutilizar el radar de grupos actual para el primer grupo, pero sin presentar el total consolidado como si fuera solo caja personal.
- Ajustar textos para que el usuario entienda la diferencia entre efectivo personal y saldo neto compartido.

### 10) Documentar el nuevo alcance implementado

**Archivos**

- [api.md](file:///c:/Users/gerson/Documents/trae_projects/ger/docs/api.md)
- [README.md](file:///c:/Users/gerson/Documents/trae_projects/ger/README.md)

**Qué / por qué / cómo**

- Documentar:
  - `GET /balance`,
  - `POST /groups/join-by-code`,
  - `GET /groups/:id/join-code`,
  - defaults EUR,
  - criterio de redondeo a dos decimales,
  - comportamiento de unión por código sin fusión de invitados existentes.

## Orden de implementación recomendado

1. Ajustar esquema Prisma:
   - `joinCode` en grupos,
   - defaults EUR.
2. Crear helpers de dinero/redondeo y revisar reparto backend.
3. Implementar helper backend de balance global por usuario.
4. Añadir `GET /balance`.
5. Añadir `GET /groups/:id/join-code` y `POST /groups/join-by-code`.
6. Actualizar serializadores y tipos API necesarios.
7. Extender cliente web y hook principal con balance global y unión por código.
8. Adaptar `GroupsScreen.tsx` con bloque de “Unirse a un grupo” y bloque de “Código del grupo”.
9. Adaptar `DashboardScreen.tsx` para mostrar las tres cifras separadas.
10. Actualizar documentación.

## Verificación

### Backend

- Compilar la API.
- Aplicar `prisma db push` con el nuevo esquema.
- Verificar que grupos nuevos reciben `joinCode`.
- Verificar que usuarios nuevos reciben `currency = EUR`.
- Probar por API:
  - registrar usuario A,
  - crear grupo,
  - leer código del grupo,
  - registrar usuario B,
  - unirse con código,
  - crear gasto,
  - consultar `GET /groups/:id/balances`,
  - consultar `GET /balance` para ambos usuarios,
  - confirmar una liquidación y comprobar el cambio en `groupNet`.

### Redondeo

- Validar reparto `equal` con importes que no dividen exacto en céntimos.
- Validar reparto `weights` con pesos asimétricos.
- Confirmar que:
  - todos los `shareAmount` quedan con 2 decimales,
  - la suma de splits coincide exactamente con el gasto,
  - el neto agregado no deriva en residuos tipo `0.009999`.

### Frontend

- Compilar la web.
- Verificar en navegador:
  - el dashboard muestra saldo personal, neto de grupos y total consolidado por separado,
  - la pestaña Grupos muestra el código del grupo seleccionado,
  - existe un bloque claro para unirse por código,
  - al unirse por código el grupo aparece tras refresco sin recargar manualmente,
  - un grupo puede contener más de un usuario real visible en la lista de miembros.

### Criterios de aceptación

- El saldo global deja de depender solo de transacciones personales.
- El usuario ve por separado saldo personal, efecto neto de grupos y total consolidado.
- Cada grupo nuevo tiene un código fijo y compartible.
- Un segundo usuario puede unirse a un grupo usando ese código desde la UI.
- Tras unirse, el usuario aparece como miembro real del grupo.
- Los cálculos monetarios de grupos cierran siempre a dos decimales.
- Los nuevos usuarios y grupos usan EUR por defecto.
