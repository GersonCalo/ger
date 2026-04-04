# Plan: sincronización automática entre dispositivos para grupos y dashboard

## Resumen

- Objetivo: evitar que un gasto o una liquidación añadidos desde un dispositivo obliguen a refrescar manualmente en los demás.
- Alcance aprobado para esta fase:
  - refresco automático en la pestaña de grupos,
  - refresco automático del dashboard,
  - activación tanto al volver al foco como mediante polling periódico.
- Preferencias confirmadas:
  - polling cada 10 segundos,
  - pausar el polling cuando la pestaña no está visible,
  - forzar refresh al recuperar foco/visibilidad.
- Fuera de alcance:
  - tiempo real por WebSocket o SSE,
  - refresco automático de toda la app,
  - sincronización de movimientos personales fuera del impacto necesario en el dashboard.

## Estado actual

### Dónde vive hoy la sincronización

- El estado cliente se centraliza en [useFinanceApp.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/hooks/useFinanceApp.ts).
- La sesión inicial ya carga `me`, `transactions`, `groups` y `balance` en paralelo en [useFinanceApp.ts:L153-L203](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/hooks/useFinanceApp.ts#L153-L203).
- El detalle del grupo seleccionado se obtiene con `refreshSelectedGroup()` mediante `GET /groups/:id/balances` y, si procede, `GET /groups/:id/join-code` en [useFinanceApp.ts:L122-L151](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/hooks/useFinanceApp.ts#L122-L151).
- El refresco actual ocurre solo tras acciones locales del usuario, por ejemplo al crear gasto, crear liquidación, confirmar liquidación, crear grupo o unirse por código en [useFinanceApp.ts:L313-L460](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/hooks/useFinanceApp.ts#L313-L460).

### Por qué falla entre dispositivos

- No existe hoy ningún mecanismo push ni polling:
  - no hay WebSocket,
  - no hay SSE,
  - no hay `setInterval`,
  - no hay refetch por visibilidad/foco.
- La pestaña de grupos depende de que el propio dispositivo dispare `refreshGroups()` o `refreshSelectedGroup()`.
- El dashboard depende de `balanceSummary`, que solo se refresca durante carga de sesión o después de acciones locales, según [useFinanceApp.ts:L89-L99](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/hooks/useFinanceApp.ts#L89-L99) y [useFinanceApp.ts:L463-L471](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/hooks/useFinanceApp.ts#L463-L471).
- El montaje de pantallas en [App.tsx:L91-L135](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/App.tsx#L91-L135) no añade ningún ciclo de refresco al cambiar entre tabs.

### Endpoints ya disponibles y reutilizables

- `GET /groups` y `GET /groups/:id/balances` ya ofrecen los datos necesarios para refrescar grupos y gastos desde [groups.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/routes/groups.ts).
- `GET /balance` ya ofrece el saldo consolidado del dashboard desde [transactions.ts:L8-L13](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/routes/transactions.ts#L8-L13).
- No hace falta cambiar contrato backend para resolver este problema; el hueco está en la estrategia cliente de refresco.

## Decisiones y supuestos

- Se implementará sincronización “casi en tiempo real” con polling ligero, no push server-side.
- El polling solo corre si:
  - hay usuario autenticado,
  - la pestaña está visible,
  - y la app está en una vista relevante (`groups` o `home`).
- Al recuperar foco o visibilidad se hará refresh inmediato sin esperar a los 10 segundos.
- La pestaña `groups` refrescará:
  - lista de grupos,
  - detalle del grupo seleccionado,
  - balances,
  - gastos,
  - liquidaciones,
  - código de grupo si corresponde.
- La pestaña `home` refrescará el balance consolidado y, si conviene para la UI, la lista de grupos usada en el radar.
- No se tocará la semántica de cálculo de balances ni los endpoints de negocio ya implementados.

## Cambios propuestos

### 1) Añadir un coordinador de auto-refresh en el hook principal

**Archivo**

- [useFinanceApp.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/hooks/useFinanceApp.ts)

**Qué**

- Incorporar uno o varios `useEffect` para:
  - iniciar polling cada 10 segundos,
  - limpiar timers correctamente,
  - pausar cuando `document.visibilityState !== 'visible'`,
  - relanzar refresh al evento `visibilitychange`,
  - relanzar refresh al volver el foco de ventana.

**Por qué**

- Este hook ya es la fuente única de verdad del estado remoto.
- Evita repartir lógica de sincronización por pantallas individuales.

**Cómo**

- Crear una función de refresco compuesta para grupos:
  - `refreshGroups()`,
  - `refreshSelectedGroup(selectedGroupId)` si existe grupo seleccionado,
  - `refreshBalance()` cuando el tab activo sea `groups` o `home`.
- Crear una función más ligera para `home`:
  - `refreshBalance()`,
  - y opcionalmente `refreshGroups()` si el dashboard depende de resumen/listado actualizados.
- El polling deberá evitar duplicados:
  - no lanzar múltiples intervalos,
  - no dejar refrescos colgando al cambiar de tab o cerrar sesión,
  - no hacer trabajo cuando no hay token.

### 2) Definir política de refresco por contexto

**Archivo**

- [useFinanceApp.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/hooks/useFinanceApp.ts)

**Qué**

- Separar explícitamente qué se refresca según el tab activo:
  - `groups`: grupos + detalle del grupo seleccionado + balance,
  - `home`: balance y datos mínimos de grupos necesarios para el resumen visual.

**Por qué**

- Reduce peticiones innecesarias cuando el usuario no está en una vista que las necesita.
- Mantiene el dashboard alineado con los cambios de grupos, que ahora afectan el saldo consolidado.

**Cómo**

- Reutilizar las funciones ya existentes (`refreshGroups`, `refreshSelectedGroup`, `refreshBalance`) en vez de duplicar llamadas API.
- Asegurar que el refresco del dashboard no dependa de visitar antes la pestaña Grupos.

### 3) Hacer robusto el refresco al volver al foco

**Archivo**

- [useFinanceApp.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/hooks/useFinanceApp.ts)

**Qué**

- Suscribirse a `window.focus` y `document.visibilitychange`.
- Disparar un refresh inmediato cuando:
  - la app vuelve al frente,
  - la pestaña deja de estar oculta.

**Por qué**

- Cubre el caso móvil y multi-dispositivo más común:
  - un usuario cambia de app o dispositivo,
  - vuelve después,
  - y debe ver los cambios al instante.

**Cómo**

- Añadir guards para evitar refrescos si:
  - no hay sesión,
  - la pestaña sigue oculta,
  - o la vista activa no requiere sincronización automática.

### 4) Revisar carga, flags y errores para no degradar UX

**Archivo**

- [useFinanceApp.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/hooks/useFinanceApp.ts)

**Qué**

- Ajustar el uso de `groupsBusy`, `dataBusy` y errores para que el polling no produzca parpadeos ni mensajes innecesarios.

**Por qué**

- El estado actual marca busy al hacer refresh manual; si se reutiliza igual para polling, la interfaz puede parecer “ocupada” constantemente.

**Cómo**

- Diferenciar entre:
  - refresh interactivo del usuario,
  - refresh silencioso de sincronización.
- Mantener el último estado válido si un refetch silencioso falla.
- Evitar sobrescribir errores de usuario con fallos transitorios del polling.

### 5) Revisar el impacto visual en Home y Grupos

**Archivos**

- [App.tsx](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/App.tsx)
- [GroupsScreen.tsx](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/GroupsScreen.tsx)
- [DashboardScreen.tsx](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/DashboardScreen.tsx)

**Qué**

- Verificar que las pantallas soportan datos entrantes refrescados sin interacción manual.

**Por qué**

- El problema reportado se manifiesta en UI, no solo en estado interno.

**Cómo**

- Confirmar que:
  - la lista de gastos se repinta al cambiar `selectedGroupData`,
  - el dashboard se actualiza al cambiar `balanceSummary`,
  - no hay dependencia oculta de un reload completo de página.
- Solo tocar estas pantallas si hiciera falta adaptar props o feedback visual mínimo; no se planean cambios funcionales grandes en ellas.

### 6) Documentar el comportamiento de sincronización

**Archivo**

- [docs/api.md](file:///c:/Users/gerson/Documents/trae_projects/ger/docs/api.md)

**Qué**

- Añadir una nota breve indicando que el frontend hace refetch periódico y por foco para mantener grupos y saldo consolidados.

**Por qué**

- Deja claro que la consistencia entre dispositivos, en esta fase, es por refetch cliente sobre endpoints HTTP existentes.

## Riesgos y puntos a vigilar

- Polling demasiado “ruidoso” si se lanza a la vez con refreshes manuales.
- Doble llamada al seleccionar grupo y al mismo tiempo dispararse el ciclo automático.
- Pantalla marcada como busy de forma continua si no se separa refresh silencioso de refresh interactivo.
- Refrescos al recuperar foco que se acumulen si no se limpia bien el intervalo.

## Verificación

### Técnica

- Revisar TypeScript y diagnósticos del proyecto tras los cambios.
- Compilar la web para confirmar que la lógica nueva no rompe el bundle.

### Funcional

- Caso 1:
  - abrir grupo en dispositivo A y B,
  - añadir gasto en A,
  - comprobar que B lo ve sin refresh manual antes o justo al siguiente ciclo de 10 s.
- Caso 2:
  - dejar B en segundo plano,
  - añadir gasto en A,
  - volver a B,
  - comprobar refresh inmediato al recuperar foco.
- Caso 3:
  - con la app en `home`,
  - modificar gasto compartido desde otro dispositivo,
  - comprobar que el saldo consolidado se actualiza sin reload manual.

### Criterios de aceptación

- La pestaña Grupos deja de requerir refresh manual para ver gastos añadidos desde otro dispositivo.
- El dashboard refleja automáticamente los cambios de saldo consolidado derivados de grupos.
- El polling se ejecuta cada 10 s solo mientras la pestaña está visible.
- Al recuperar foco o visibilidad, el refresh ocurre inmediatamente.
- No aparecen errores espurios ni loaders permanentes por el auto-refresh.
