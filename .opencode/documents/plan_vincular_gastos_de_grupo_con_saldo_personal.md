# Plan: vincular gastos de grupo con saldo personal y total disponible

## Resumen

- Objetivo: cuadrar la contabilidad de la app para que los gastos y liquidaciones de grupos impacten también en las finanzas personales.
- Problema actual:
  - el saldo personal solo se calcula desde `PersonalTransaction`,
  - el balance de grupos se calcula aparte,
  - el total es `saldo personal + neto de grupos`,
  - pero los gastos pagados en grupos no reducen el dinero disponible personal ni aparecen en Movimientos.
- Resultado buscado:
  - **Disponible**: dinero real con el que cuento ahora.
  - **Total**: disponible + dinero que me deben en grupos.
  - **Balance en grupos**: posición neta frente a los grupos.

## Estado actual

### Backend

- El resumen global del usuario se calcula en [userBalance.ts:L80-L167](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/lib/userBalance.ts#L80-L167).
- Ahí el sistema calcula:
  - `personalIncome` y `personalExpense` desde `PersonalTransaction`,
  - `groupNet` sumando el `netCents` de cada grupo del usuario,
  - `totalBalance = personalBalance + groupNet`.
- El neto de cada grupo depende del motor de balances en [groupBalances.ts:L93-L155](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/lib/groupBalances.ts#L93-L155).
- Crear gastos de grupo hoy solo escribe `GroupExpense` y `GroupSplit` en [groups.ts:L826-L890](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/routes/groups.ts#L826-L890).
- Crear movimientos personales hoy solo escribe `PersonalTransaction` en [transactions.ts:L36-L75](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/routes/transactions.ts#L36-L75).
- El esquema Prisma no tiene ninguna relación entre gasto de grupo y movimiento personal en [schema.prisma:L18-L27](file:///c:/Users/gerson/Documents/trae_projects/ger/packages/db/schema.prisma#L18-L27) y [schema.prisma:L57-L76](file:///c:/Users/gerson/Documents/trae_projects/ger/packages/db/schema.prisma#L57-L76).

### Frontend

- El frontend consume `GET /balance` con `GlobalBalancePayload` desde [api.ts:L95-L100](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/lib/api.ts#L95-L100) y [types.ts:L30-L43](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/types.ts#L30-L43).
- `useFinanceApp` carga y refresca `transactions`, `groups` y `balance` en [useFinanceApp.ts:L171-L219](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/hooks/useFinanceApp.ts#L171-L219) y [useFinanceApp.ts:L241-L320](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/hooks/useFinanceApp.ts#L241-L320).
- Home muestra hoy:
  - saldo total,
  - saldo personal,
  - neto grupos,
  - ingresos,
  en [DashboardScreen.tsx:L37-L58](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/DashboardScreen.tsx#L37-L58).
- Movimientos solo muestra `PersonalTransaction`, sin registros originados en grupos, en [TransactionsScreen.tsx:L39-L205](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/TransactionsScreen.tsx#L39-L205).

## Intención confirmada

- Cuando pagas un gasto de grupo de 100€, el **saldo personal disponible debe bajar 100€ completos**.
- Si otra persona paga y tú quedas debiendo 25€, **tu saldo disponible no baja hasta que hagas la liquidación real**.
- Cuando registras una liquidación y recuperas 30€, **tu saldo personal disponible sube 30€**.
- Los movimientos originados por grupos deben verse **también en Home y en Movimientos**.
- Esos movimientos deben ser **automáticos y bloqueados**, no editables manualmente.

## Modelo contable propuesto

### Definiciones

- **Disponible personal**
  - dinero real en caja o cuenta,
  - se calcula con movimientos personales manuales **más** movimientos automáticos originados en grupos.
- **Balance en grupos**
  - neto pendiente por cobrar o pagar dentro de grupos,
  - sigue saliendo del motor de balances de grupo.
- **Total**
  - para cumplir con la definición confirmada por el usuario:
    - `total = disponible + max(groupNet, 0)`
  - es decir:
    - si me deben dinero en grupos, el total lo suma,
    - si debo dinero a grupos, eso no vuelve a restarse otra vez del disponible.

### Regla operativa

- **Gasto de grupo pagado por mí**
  - crea un movimiento personal automático de tipo gasto por el importe completo pagado.
- **Gasto de grupo pagado por otra persona**
  - no crea movimiento personal automático para mí en ese momento.
- **Liquidación que yo pago**
  - crea un movimiento personal automático de tipo gasto por el importe liquidado.
- **Liquidación que yo recibo**
  - crea un movimiento personal automático de tipo ingreso por el importe liquidado.
- **Edición de gasto de grupo**
  - debe actualizar el movimiento automático asociado del pagador.

## Decisiones técnicas

### 1) Añadir vínculo persistente entre grupos y movimientos personales automáticos

**Archivos**

- [schema.prisma](file:///c:/Users/gerson/Documents/trae_projects/ger/packages/db/schema.prisma)

**Qué**

- Extender `PersonalTransaction` para distinguir:
  - origen manual,
  - origen grupo,
  - tipo de referencia al origen,
  - id de la entidad origen.

**Por qué**

- Hace falta trazabilidad y sincronización para que:
  - un gasto/liquidación de grupo aparezca en Movimientos,
  - se pueda bloquear edición manual,
  - se pueda actualizar sin duplicados.

**Cómo**

- Añadir campos equivalentes a:
  - `sourceType`,
  - `sourceRefId`,
  - `locked`,
  - `groupId` opcional para trazabilidad.
- Añadir índice/constraint único sobre el origen lógico del movimiento automático para evitar duplicados.

### 2) Crear una capa de sincronización backend grupo → finanzas personales

**Archivos**

- [groups.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/routes/groups.ts)
- nuevo helper en `apps/api/src/lib/` para no meter demasiada lógica en la ruta

**Qué**

- Centralizar la creación y actualización de movimientos personales automáticos.

**Por qué**

- Las rutas de grupos hoy solo escriben datos del dominio grupo.
- Si se mezcla la lógica directamente en varias rutas sin helper compartido, el comportamiento será frágil.

**Cómo**

- Crear helper reutilizable con operaciones como:
  - sincronizar gasto de grupo del pagador,
  - sincronizar liquidación pagada/cobrada,
  - actualizar movimiento automático de un gasto editado.
- Ejecutar esa sincronización dentro de la misma transacción DB cuando se cree o edite:
  - un `GroupExpense`,
  - un `GroupSettlement`.

### 3) Ajustar el cálculo global del balance

**Archivos**

- [userBalance.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/lib/userBalance.ts)

**Qué**

- Redefinir las métricas expuestas por `GET /balance`.

**Por qué**

- El concepto de “saldo personal” cambia: ya no es solo manual, sino el dinero disponible real después de gastos y liquidaciones de grupos.

**Cómo**

- Calcular:
  - `personalIncome` incluyendo ingresos manuales + liquidaciones cobradas desde grupos,
  - `personalExpense` incluyendo gastos manuales + gastos/liquidaciones pagados desde grupos,
  - `personalBalance` como disponible real,
  - `groupNet` manteniendo el neto actual de grupos,
  - `totalBalance = personalBalance + Math.max(groupNet, 0)`.
- Mantener `groupsBreakdown` y extenderlo si hiciera falta para explicar mejor el origen del total.

### 4) Extender tipos y cliente API

**Archivos**

- [types.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/types.ts)
- [api.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/lib/api.ts)

**Qué**

- Reflejar en frontend los nuevos campos de transacción y, si hace falta, el nuevo copy de balance.

**Por qué**

- El historial personal debe poder distinguir registros manuales de registros de grupo.

**Cómo**

- Extender `Transaction` con campos como:
  - `sourceType`,
  - `locked`,
  - `groupId`,
  - `groupName` si se decide devolverlo desde backend.
- Ajustar `GlobalBalancePayload` solo si se amplía el desglose visible.

### 5) Adaptar el hook principal

**Archivos**

- [useFinanceApp.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/hooks/useFinanceApp.ts)

**Qué**

- Reutilizar el flujo actual de refresh sin cambiar la arquitectura general.

**Por qué**

- Ya refresca balance, movimientos y grupos al crear/editar gastos y liquidaciones.
- Eso encaja bien con el nuevo modelo si backend devuelve los nuevos datos.

**Cómo**

- Mantener el patrón actual:
  - crear/editar gasto de grupo,
  - refrescar `transactions`,
  - refrescar `groups`,
  - refrescar `balance`.
- Solo ajustar mapeos y nombres si cambian los conceptos visibles en el resumen.

### 6) Rediseñar Home con las tres métricas correctas

**Archivos**

- [DashboardScreen.tsx](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/DashboardScreen.tsx)

**Qué**

- Cambiar la narrativa de métricas a:
  - disponible,
  - total,
  - balance en grupos.

**Por qué**

- Es exactamente la lectura que el usuario ha pedido.

**Cómo**

- Hero:
  - foco principal en **Total** o en **Disponible** según la jerarquía final confirmada por este plan; en esta implementación se propone:
    - hero principal = **Disponible**,
    - stats secundarias = **Total**, **Balance grupos**, **Ingresos**.
- Ajustar etiquetas y microcopy para explicar solo lo imprescindible.
- Si `groupsBreakdown` ya llega usable, valorar un mini resumen “te deben / debes” sin sobrecargar.

### 7) Integrar movimientos de grupo en la pestaña Movimientos

**Archivos**

- [TransactionsScreen.tsx](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/TransactionsScreen.tsx)

**Qué**

- Mezclar en el historial:
  - movimientos personales manuales,
  - movimientos automáticos originados en grupos.

**Por qué**

- El usuario ha pedido ver esa vinculación también en Movimientos.

**Cómo**

- Mostrar badge o meta corta de origen:
  - `Grupo · Viaje Lisboa`,
  - `Liquidación · Piso`.
- Marcar visualmente los automáticos como bloqueados:
  - sin acciones de edición,
  - con copy muy corta tipo “Sincronizado desde grupos”.
- Mantener filtro por ingresos/gastos funcionando sobre ambos orígenes.

### 8) Mantener coherencia en grupos

**Archivos**

- [GroupsScreen.tsx](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/GroupsScreen.tsx)

**Qué**

- Añadir solo el mínimo soporte visual para que el usuario entienda el efecto financiero sin duplicar información.

**Por qué**

- El dominio grupo sigue siendo la fuente de verdad del reparto y las liquidaciones.

**Cómo**

- No duplicar un historial personal dentro de grupos.
- Valorar un microcopy corto en gastos o pagos del grupo indicando que:
  - los pagos y liquidaciones ya impactan el disponible personal.
- Mantener la UI actual de subtabs salvo ajustes menores de texto.

## Riesgos y puntos a vigilar

- **Doble impacto contable**
  - si se resta un gasto grupal del disponible y además se usa `total = disponible + groupNet` sin matiz, el caso donde yo debo dinero podría quedar doblemente penalizado.
  - por eso este plan fija `total = disponible + max(groupNet, 0)`.
- **Duplicados de movimientos automáticos**
  - especialmente al editar un gasto o repetir refresh.
  - requiere constraint única por origen.
- **Migración de datos existentes**
  - los gastos/liquidaciones de grupo ya creados no tendrán movimientos personales asociados.
  - habrá que decidir si:
    - se hace backfill,
    - o solo aplica a partir de la migración.
  - este plan propone incluir backfill como parte del cambio para cuadrar datos históricos.
- **Historial mezclado**
  - si no se etiqueta bien, el usuario puede no distinguir qué es manual y qué viene de grupos.

## Supuestos y decisiones

- Se implementará **backfill** para que gastos y liquidaciones ya existentes de grupos también se reflejen en el saldo personal y en Movimientos.
- Los movimientos automáticos de grupo serán **no editables** desde la UI de Movimientos.
- El origen de verdad seguirá siendo:
  - grupos para gastos/liquidaciones compartidas,
  - movimientos personales para operaciones manuales ajenas a grupos.
- No se cambiará la mecánica de balances internos de grupo; solo se conectará con finanzas personales.

## Verificación

### Backend

- Crear o adaptar tests para validar:
  - gasto de grupo pagado por mí ⇒ baja disponible personal,
  - gasto pagado por otro ⇒ no baja mi disponible hasta liquidar,
  - liquidación pagada por mí ⇒ baja disponible,
  - liquidación recibida por mí ⇒ sube disponible,
  - total = disponible + solo neto positivo de grupos.

### Datos

- Verificar migración Prisma y backfill:
  - sin duplicados,
  - con referencias correctas entre origen grupal y movimiento personal.

### Frontend

- Revisar que Home muestre correctamente:
  - disponible,
  - total,
  - balance en grupos.
- Revisar que Movimientos muestre entradas automáticas de grupo con marca de bloqueo.
- Revisar que al:
  - crear gasto de grupo,
  - editar gasto,
  - registrar liquidación,
  se refresquen correctamente balance y movimientos.

### Criterios de aceptación

- Un gasto de grupo pagado por el usuario descuenta el importe completo del saldo personal disponible.
- Una deuda pendiente en grupo no descuenta del disponible hasta que se liquide.
- Una liquidación recibida suma al saldo personal disponible.
- Home muestra claramente disponible, total y balance en grupos con la nueva lógica.
- Movimientos incluye registros automáticos originados en grupos y no permite editarlos manualmente.
- Los datos históricos de grupos quedan sincronizados con finanzas personales tras la migración.
