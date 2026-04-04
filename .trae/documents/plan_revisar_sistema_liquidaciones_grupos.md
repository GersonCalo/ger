# Plan: revisar y rehacer el sistema de liquidaciones de grupos

## Resumen

- Objetivo: corregir el comportamiento de balances y liquidaciones para que el flujo encaje con el caso esperado de negocio.
- Caso objetivo confirmado:
  - si `test1` paga un gasto de `30 €` compartido entre `test1`, `test2` y `test3`,
  - el balance esperado es:
    - `test1`: `+20 €`,
    - `test2`: `-10 €`,
    - `test3`: `-10 €`,
  - y para equilibrar, `test2` y `test3` deben poder liquidar `10 €` cada uno hacia `test1`.
- Decisiones confirmadas:
  - una liquidación debe impactar en balances **al crearla**,
  - hay que revisar **todo el flujo**: cálculo, backend y frontend,
  - las liquidaciones sugeridas deben poder ejecutarse con **un botón**,
  - solo el **deudor** debe poder ejecutar una sugerencia,
  - debe seguir existiendo una vía manual para registrar una liquidación distinta o parcial, por ejemplo `5 €` en vez de `10 €`.

## Estado actual

### Cálculo de balances

- La lógica central está en [groupBalances.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/lib/groupBalances.ts).
- El balance actual suma:
  - `paid`,
  - resta `owes`,
  - resta `settledOut`,
  - suma `settledIn`,
  en [groupBalances.ts:L93-L155](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/lib/groupBalances.ts#L93-L155).
- Las sugerencias de liquidación se calculan emparejando acreedores y deudores según `netCents` en [groupBalances.ts:L157-L198](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/lib/groupBalances.ts#L157-L198).

### Problema detectado en liquidaciones

- Hoy las liquidaciones creadas se guardan con estado `proposed` en [groups.ts:L1119-L1127](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/routes/groups.ts#L1119-L1127).
- El cálculo de balances **ignora** cualquier liquidación que no esté `confirmed` en [groupBalances.ts:L124-L138](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/lib/groupBalances.ts#L124-L138).
- Eso contradice el comportamiento pedido: si el usuario registra que ya pagó, el balance debería cambiar inmediatamente.

### Problema detectado en permisos y flujo backend

- Crear liquidaciones exige permisos de admin porque usa `assertAdminGroup()` en [groups.ts:L1087-L1093](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/routes/groups.ts#L1087-L1093).
- Confirmar/cancelar también exige admin en [groups.ts:L1141-L1147](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/routes/groups.ts#L1141-L1147).
- Esto no encaja con el flujo deseado donde el **deudor** debe poder ejecutar su pago sugerido sin depender de un admin.

### Problema detectado en frontend

- La UI solo **muestra** sugerencias; no permite ejecutarlas desde la lista en [GroupsScreen.tsx:L365-L384](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/GroupsScreen.tsx#L365-L384).
- El formulario manual de liquidación existe, pero crea una liquidación genérica sin integrar el concepto de “ejecutar sugerida” ni el rol del deudor en [GroupsScreen.tsx:L387-L446](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/GroupsScreen.tsx#L387-L446).
- La lista de liquidaciones asume el estado `proposed` y ofrece botón de confirmación en [GroupsScreen.tsx:L448-L484](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/GroupsScreen.tsx#L448-L484).

### Datos y contratos ya disponibles

- El payload de balances ya incluye:
  - `members`,
  - `expenses`,
  - `settlements`,
  - `balances`,
  - `suggestions`,
  en [types.ts:L109-L121](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/types.ts#L109-L121).
- El frontend ya dispone de cliente para:
  - crear liquidaciones,
  - actualizar estado,
  - cargar balances,
  desde [api.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/lib/api.ts).

## Análisis del caso de negocio

### Regla esperada

- Un gasto pagado por un miembro y compartido entre los miembros del grupo debe dejar al pagador con saldo positivo por la parte adelantada a otros.
- Para un grupo de 3 con gasto de `30 €` pagado por `test1` y reparto equitativo:
  - cada miembro soporta `10 €`,
  - `test1` pagó `30 €` y debía `10 €`, por tanto neto `+20 €`,
  - `test2` debía `10 €` y pagó `0 €`, por tanto neto `-10 €`,
  - `test3` debía `10 €` y pagó `0 €`, por tanto neto `-10 €`.

### Consecuencia funcional

- Las sugerencias correctas para ese caso son:
  - `test2 → test1 : 10 €`
  - `test3 → test1 : 10 €`
- Si `test2` registra una liquidación de `10 €` a `test1`, su deuda debe pasar a `0 €` y el saldo de `test1` debe bajar de `+20 €` a `+10 €`.
- Si en vez de eso registra `5 €`, debe quedar:
  - `test2`: `-5 €`
  - `test1`: `+15 €`

## Supuestos y decisiones

- Se mantendrá la idea de estados de liquidación en base de datos si ya existe valor analítico o histórico, pero la creación normal desde producto deberá quedar aplicada inmediatamente.
- La implementación más coherente con la decisión “impacta al crear” es que la creación desde frontend genere liquidaciones ya efectivas, en vez de depender del estado `proposed`.
- El botón rápido de sugerencia debe estar visible solo cuando el usuario autenticado coincida con el `fromMemberId` sugerido.
- El formulario manual seguirá existiendo y permitirá importes parciales.
- La UI no debe perder trazabilidad histórica de liquidaciones ya registradas.

## Cambios propuestos

### 1) Revisar la semántica de liquidaciones en backend

**Archivo**

- [groups.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/routes/groups.ts)

**Qué**

- Cambiar el flujo de creación de liquidaciones para que el registro impacte en balances al momento de crearse.
- Revisar permisos para que la acción la pueda ejecutar el deudor correspondiente y no solo un admin.

**Por qué**

- El flujo actual obliga a una segunda confirmación y rompe el caso de negocio pedido.
- También impide que el propio deudor ejecute su liquidación sugerida de forma directa.

**Cómo**

- Reemplazar el uso de `assertAdminGroup()` por acceso compatible con miembros reales del grupo para crear liquidaciones.
- Validar que el usuario autenticado solo pueda:
  - crear liquidaciones manuales en su propio nombre como pagador (`fromMemberId`),
  - ejecutar sugerencias donde él es el deudor.
- Decidir si:
  - se crea directamente con estado `confirmed`,
  - o se introduce un nuevo significado de estado que igualmente compute como aplicado.
- Mantener la integridad de miembros y grupo con las validaciones ya existentes.

### 2) Alinear el cálculo de balances con la nueva semántica

**Archivo**

- [groupBalances.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/lib/groupBalances.ts)

**Qué**

- Ajustar qué liquidaciones se consideran efectivas al calcular `settledIn`, `settledOut` y `net`.
- Revisar el cálculo con el escenario base `30 / 10 / 10`.

**Por qué**

- Hoy solo cuentan las `confirmed`, lo que deja el balance “sin mover” tras registrar una liquidación.
- El usuario ha definido explícitamente que pagar ya debe modificar el saldo.

**Cómo**

- Decidir una regla de cómputo clara:
  - incluir liquidaciones creadas como aplicadas,
  - excluir solo canceladas o anuladas.
- Verificar que `calculateSettlementSuggestions()` reduzca correctamente las sugerencias después de una liquidación completa o parcial.
- Documentar la regla monetaria esperada para evitar ambigüedad futura.

### 3) Revisar serialización y contratos del flujo de liquidaciones

**Archivos**

- [groups.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/routes/groups.ts)
- [types.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/types.ts)
- [api.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/lib/api.ts)

**Qué**

- Adaptar tipos y contratos a la nueva semántica del settlement:
  - creación directa aplicada,
  - posibilidad de mantener estados históricos si siguen existiendo,
  - datos suficientes para que la UI sepa si el usuario puede ejecutar una sugerencia.

**Por qué**

- El frontend necesita saber qué botones mostrar y qué estados renderizar.
- Si cambian permisos o significado de `status`, el contrato debe reflejarlo.

**Cómo**

- Revisar si basta con el contrato actual o si hace falta incluir más metadata derivada.
- Mantener cambios mínimos si el payload actual ya cubre el caso mediante `userId` de miembros y `fromMemberId/toMemberId`.

### 4) Rehacer la UX de sugerencias y liquidaciones manuales

**Archivo**

- [GroupsScreen.tsx](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/GroupsScreen.tsx)

**Qué**

- Convertir la sección de “Liquidaciones sugeridas” en una zona accionable.
- Mantener además el formulario manual para registrar pagos distintos a la sugerencia.

**Por qué**

- El usuario quiere dos caminos simultáneos:
  - un clic para ejecutar la sugerida completa,
  - posibilidad de registrar otro importe, incluyendo importes parciales.

**Cómo**

- Añadir botón de ejecución rápida en cada sugerencia visible solo para el deudor correspondiente.
- Hacer que el botón rápido cree la liquidación completa sugerida y deje el balance actualizado al instante.
- Mantener el formulario manual, pero orientarlo a “ya he pagado X a Y”.
- Valorar precargar el formulario manual con la sugerencia seleccionada para facilitar el caso parcial.

### 5) Ajustar el hook de estado para el nuevo flujo

**Archivo**

- [useFinanceApp.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/hooks/useFinanceApp.ts)

**Qué**

- Alinear las acciones del frontend con el nuevo comportamiento de liquidaciones aplicadas al crear.

**Por qué**

- Ahora mismo el hook todavía expone creación y confirmación como pasos separados.

**Cómo**

- Revisar `createSettlement` y `confirmSettlement` para:
  - que el refresh posterior refleje el efecto inmediato,
  - que el flujo rápido desde sugerencia sea sencillo de invocar,
  - que no se mantenga una UX antigua basada en “proposed → confirm”.
- Si la confirmación deja de ser necesaria en producto, simplificar su uso en la pantalla y conservar solo lo que siga teniendo sentido.

### 6) Actualizar documentación funcional y técnica

**Archivo**

- [docs/api.md](file:///c:/Users/gerson/Documents/trae_projects/ger/docs/api.md)

**Qué**

- Documentar la semántica nueva de liquidaciones:
  - cuándo impactan,
  - quién puede ejecutarlas,
  - cómo conviven sugerencia rápida y liquidación manual.

**Por qué**

- El comportamiento actual documentado ya no sería suficiente para entender el flujo esperado.

## Riesgos y puntos a vigilar

- Romper la coherencia histórica si se cambia el significado de `status` sin revisar datos existentes.
- Permitir registrar pagos por otro miembro si no se atan bien permisos y `fromMemberId`.
- Mostrar botones de ejecución rápida a usuarios que no son el deudor real.
- Duplicar pagos si la sugerencia rápida y el formulario manual no se distinguen bien en UX.
- Mantener sugerencias obsoletas si no se recalculan tras una liquidación parcial.

## Verificación

### Técnica

- Revisar diagnósticos TypeScript del backend y frontend.
- Verificar contratos y tipos usados por la pantalla de grupos.

### Funcional

- Caso 1:
  - grupo con `test1`, `test2`, `test3`,
  - gasto de `30 €` pagado por `test1`,
  - comprobar balances `+20 / -10 / -10`.
- Caso 2:
  - ejecutar sugerencia rápida `test2 → test1 : 10 €`,
  - comprobar balances `+10 / 0 / -10`.
- Caso 3:
  - ejecutar sugerencia rápida `test3 → test1 : 10 €`,
  - comprobar balances `0 / 0 / 0`.
- Caso 4:
  - en vez de sugerida completa, registrar manualmente `test2 → test1 : 5 €`,
  - comprobar balances `+15 / -5 / -10`.
- Caso 5:
  - verificar que un usuario que no es el deudor no puede ejecutar la sugerencia rápida de otro.

### Criterios de aceptación

- Crear una liquidación actualiza balances inmediatamente.
- Las sugerencias coinciden con el caso de negocio definido para el ejemplo `30 €`.
- El deudor puede ejecutar su sugerencia con un solo botón.
- El formulario manual sigue permitiendo registrar un importe distinto o parcial.
- La UI deja de depender del flujo antiguo de confirmar una liquidación propuesta para que el balance cambie.
