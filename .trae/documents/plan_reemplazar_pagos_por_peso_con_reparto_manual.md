# Plan: reemplazar “Por pesos” por reparto manual de importes

## Resumen

- Objetivo: sustituir la opción actual `Por pesos` por un modo de reparto manual donde el usuario pueda asignar cuánto corresponde a cada miembro del grupo.
- Regla de negocio confirmada:
  - la suma de todos los importes asignados a miembros debe ser exactamente igual al total del gasto,
  - si no cuadra, el gasto no se puede guardar.
- Decisiones confirmadas:
  - `Por pesos` desaparece y se reemplaza por el nuevo modo manual,
  - la fase incluye **crear y editar** gastos,
  - para permisos de edición se tomará la regla `pagador = creador`,
  - la UX del reparto manual será **mixta**:
    - inputs por miembro,
    - validación exacta de suma,
    - ayuda para autocompletar el resto.

## Estado actual

### Frontend de creación de gastos

- La pantalla de grupos tiene un formulario de alta de gasto en [GroupsScreen.tsx:L284-L364](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/GroupsScreen.tsx#L284-L364).
- Ese formulario solo envía:
  - `description`,
  - `amount`,
  - `payerMemberId`,
  - `splitMethod`,
  mediante `onAddExpense`.
- La UI actual ofrece dos modos visuales en [GroupsScreen.tsx:L344-L359](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/GroupsScreen.tsx#L344-L359):
  - `Equitativo`
  - `Por pesos`
- No hay inputs por miembro para definir importes personalizados.

### Cliente frontend y hook

- El componente de grupos está conectado desde [App.tsx:L114-L130](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/App.tsx#L114-L130).
- El hook crea gastos con `addGroupExpense` en [useFinanceApp.ts:L440-L470](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/hooks/useFinanceApp.ts#L440-L470).
- El cliente HTTP `createGroupExpense` solo soporta `splitMethod` sin `splits` manuales en [api.ts:L149-L168](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/lib/api.ts#L149-L168).
- No existe cliente frontend para editar o borrar gastos, aunque backend sí lo soporta.

### Backend de creación y edición de gastos

- La validación del gasto actual solo acepta `equal` y `weights` en [groups.ts:L77-L83](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/routes/groups.ts#L77-L83).
- La creación de gasto usa `buildExpenseSplits` en [groups.ts:L234-L285](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/routes/groups.ts#L234-L285).
- La ruta `POST /groups/:id/expenses` crea gasto y sus splits en [groups.ts:L781-L842](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/routes/groups.ts#L781-L842).
- La ruta `PUT /groups/:id/expenses/:eid` ya existe y recalcula splits al editar en [groups.ts:L844-L923](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/routes/groups.ts#L844-L923).
- La ruta `DELETE /groups/:id/expenses/:eid` también existe en [groups.ts:L925-L956](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/routes/groups.ts#L925-L956).

### Persistencia y balances

- Prisma ya guarda `shareAmount` y `shareWeight` por split en [schema.prisma:L90-L100](file:///c:/Users/gerson/Documents/trae_projects/ger/packages/db/schema.prisma#L90-L100).
- El modelo `GroupExpense` no guarda un `createdBy`; solo existe `payerMemberId` en [schema.prisma:L73-L88](file:///c:/Users/gerson/Documents/trae_projects/ger/packages/db/schema.prisma#L73-L88).
- El cálculo de balances ya usa directamente `shareAmount` si los splits lo traen informado en [groupBalances.ts:L64-L70](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/lib/groupBalances.ts#L64-L70).
- Eso significa que el motor ya está preparado para reparto manual explícito, siempre que el backend persista bien los importes.

### Situación de edición de gastos

- El listado de gastos en la UI es solo lectura en [GroupsScreen.tsx:L536-L559](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/GroupsScreen.tsx#L536-L559).
- No hay botones, estado ni formularios para editar gastos existentes.
- Como no hay `createdBy`, el permiso solicitado se implementará usando `payerMemberId` como identidad del “creador” a efectos de edición.

## Análisis del cambio pedido

### Nueva regla funcional

- El usuario debe poder crear un gasto y decir cuánto corresponde a cada miembro del grupo.
- El reparto ya no dependerá de pesos persistidos del miembro, sino de importes concretos por gasto.
- Ejemplo conceptual correcto:
  - gasto total `35 €`,
  - miembro A `10 €`,
  - miembro B `12,50 €`,
  - miembro C `12,50 €`,
  - suma total `35 €`.

### Implicación técnica

- El nuevo modo no requiere una migración estructural para splits porque `shareAmount` ya existe.
- Sí requiere:
  - ampliar los esquemas y tipos para soportar `manual`,
  - aceptar un array de `splits` manuales en POST/PUT,
  - añadir UI de reparto por miembro,
  - crear permisos y cliente frontend de edición.

## Supuestos y decisiones

- `Por pesos` se elimina de la UI y del flujo de creación/edición expuesto al usuario.
- Se añadirá un nuevo `splitMethod` explícito, previsiblemente `manual`, para distinguir los gastos repartidos por importes manuales.
- El reparto manual siempre se expresará con importes monetarios por miembro, no con porcentajes ni pesos.
- La suma se validará en céntimos para evitar errores de coma flotante.
- El autocompletado del resto se resolverá en frontend como ayuda de UX, pero backend seguirá validando la suma exacta.
- Para permisos de edición:
  - admin del grupo puede editar cualquier gasto,
  - el pagador del gasto puede editar su propio gasto,
  - otros miembros no pueden editarlo.
- La fase incluye edición, pero no necesariamente borrado con nueva UX, ya que el cambio pedido se centra en creación y modificación.

## Cambios propuestos

### 1) Sustituir `weights` por `manual` en validación y cálculo de splits

**Archivos**

- [groups.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/routes/groups.ts)
- [groupBalances.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/lib/groupBalances.ts)
- [userBalance.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/lib/userBalance.ts)

**Qué**

- Cambiar el contrato de gasto para aceptar reparto manual por importes.
- Retirar `weights` del flujo expuesto y soportar `manual`.

**Por qué**

- El usuario ya no quiere reparto por peso y sí quiere asignar importes exactos a cada miembro.

**Cómo**

- Ampliar `expenseSchema` para aceptar:
  - `splitMethod: 'equal' | 'manual'`,
  - `splits` manuales cuando proceda.
- Adaptar `buildExpenseSplits` para:
  - seguir calculando `equal`,
  - validar y persistir `manual`.
- Mantener la lógica de balances basada en `shareAmount`, ajustando solo tipos/casts donde hoy se asume `weights`.

### 2) Validar que el reparto manual cierre exactamente el total

**Archivos**

- [groups.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/routes/groups.ts)

**Qué**

- Validar en backend que:
  - existan importes para miembros válidos del grupo,
  - no haya miembros repetidos,
  - estén cubiertos todos los participantes requeridos por la UX elegida,
  - la suma exacta en céntimos coincida con `amount`.

**Por qué**

- La regla clave del negocio es que la suma de lo asignado debe ser exactamente igual al gasto total.

**Cómo**

- Normalizar importes a céntimos antes de comparar.
- Rechazar peticiones con suma incorrecta o miembros fuera del grupo.
- Mantener mensajes de error claros para que la UI pueda guiar al usuario.

### 3) Añadir permisos de edición de gastos por admin o pagador

**Archivos**

- [groups.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/routes/groups.ts)

**Qué**

- Cambiar la autorización de edición de gastos para que no dependa solo de admin.

**Por qué**

- El usuario ha definido una regla dual:
  - admin puede editar cualquier gasto,
  - el usuario que creó el gasto puede editar el suyo.
- Dado que hoy no existe `createdBy`, se usará `payerMemberId` como equivalente funcional.

**Cómo**

- Revisar la ruta `PUT /groups/:id/expenses/:eid`.
- Resolver el miembro del usuario autenticado dentro del grupo.
- Permitir edición si:
  - es admin,
  - o si su `member.id` coincide con `expense.payerMemberId`.
- Mantener el resto de miembros sin permiso de edición.

### 4) Crear cliente frontend para edición de gastos

**Archivos**

- [api.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/lib/api.ts)
- [useFinanceApp.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/hooks/useFinanceApp.ts)

**Qué**

- Añadir soporte frontend para actualizar gastos existentes con reparto manual.

**Por qué**

- Backend ya tiene `PUT` pero frontend no lo usa.
- La fase confirmada incluye también edición de gastos.

**Cómo**

- Extender `createGroupExpense` para aceptar `splits` manuales.
- Añadir `updateGroupExpense`.
- Exponer desde el hook:
  - creación de gasto manual,
  - edición de gasto manual/equitativo,
  - refresh posterior del grupo y balance global.

### 5) Rediseñar la UI del formulario de gasto para reparto manual

**Archivos**

- [GroupsScreen.tsx](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/GroupsScreen.tsx)
- [types.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/types.ts)

**Qué**

- Reemplazar visualmente `Por pesos` por una opción de reparto manual.
- Añadir inputs por miembro para definir lo que corresponde a cada uno.

**Por qué**

- El usuario necesita controlar directamente cuánto corresponde a cada participante.

**Cómo**

- Mantener un selector de modo con:
  - `Equitativo`
  - `Personalizado`
- Cuando el modo sea manual:
  - mostrar un campo de importe por cada miembro,
  - mostrar suma actual vs total del gasto,
  - bloquear el submit si no cuadra,
  - añadir ayuda para completar el resto.
- La opción mixta se implementará con una acción tipo:
  - “Completar resto”
  - o un comportamiento equivalente sobre el último miembro editable.

### 6) Añadir edición de gastos en el listado

**Archivos**

- [GroupsScreen.tsx](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/GroupsScreen.tsx)

**Qué**

- Incorporar affordances de edición en el listado de gastos existentes.

**Por qué**

- La fase incluye editar gastos ya creados.

**Cómo**

- Mostrar botón de editar solo si el usuario actual:
  - es admin del grupo,
  - o es el pagador del gasto.
- Reutilizar el mismo formulario de gasto en modo edición o abrir un estado equivalente dentro de la pantalla.
- Cargar:
  - descripción,
  - total,
  - pagador,
  - reparto actual por miembro a partir de `expense.splits`.

### 7) Actualizar tipos y documentación

**Archivos**

- [types.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/types.ts)
- [api.md](file:///c:/Users/gerson/Documents/trae_projects/ger/docs/api.md)

**Qué**

- Reflejar el nuevo modo de reparto y la edición de gastos.

**Por qué**

- El contrato visible debe explicar que ya no se usa `weights` en producto y que ahora existe reparto manual exacto.

**Cómo**

- Cambiar los tipos de `splitMethod`.
- Documentar:
  - `equal`,
  - `manual`,
  - validación de suma exacta,
  - permiso de edición por admin o pagador.

## Riesgos y puntos a vigilar

- Inconsistencias por redondeo si frontend valida con decimales y backend con números flotantes; debe hacerse en céntimos en ambos lados.
- UX confusa si el autocompletado del resto pisa valores del usuario sin dejar claro qué campo se actualiza.
- Edición parcial de un gasto viejo si no se cargan correctamente `expense.splits` persistidos.
- Permisos ambiguos si el pagador cambia al editar: habrá que decidir si el permiso se evalúa sobre el gasto original o sobre el nuevo valor enviado; la opción más segura es evaluar contra el gasto existente antes del update.
- Compatibilidad con gastos antiguos `weights`; no se deben romper en lectura aunque el modo desaparezca de la UI.

## Verificación

### Técnica

- Revisar diagnósticos TypeScript tras ampliar tipos y payloads.
- Compilar API y web.

### Funcional

- Caso 1:
  - crear gasto `35 €` en modo manual,
  - asignar `10 + 12,50 + 12,50`,
  - comprobar que el gasto se guarda y balances cuadran.
- Caso 2:
  - introducir una suma incorrecta,
  - comprobar que frontend bloquea guardado y backend también rechaza si se fuerza petición.
- Caso 3:
  - usar “Completar resto” tras rellenar algunos miembros,
  - comprobar que el total resultante cierra exacto.
- Caso 4:
  - editar un gasto existente como admin,
  - cambiar reparto y comprobar balances recalculados.
- Caso 5:
  - editar un gasto existente como pagador,
  - comprobar que se permite.
- Caso 6:
  - intentar editar un gasto ajeno sin ser admin,
  - comprobar que se bloquea.
- Caso 7:
  - crear gasto en modo `Equitativo`,
  - comprobar que el comportamiento antiguo se mantiene intacto.

### Criterios de aceptación

- `Por pesos` desaparece de la UI de creación/edición.
- Existe un modo manual por importes por miembro.
- La suma de importes asignados debe ser exactamente igual al total del gasto.
- Se pueden crear y editar gastos con ese reparto manual.
- Admin puede editar cualquier gasto.
- El pagador del gasto puede editar su propio gasto.
- Un tercero no autorizado no puede editar gastos ajenos.
