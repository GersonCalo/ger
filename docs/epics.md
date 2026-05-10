# Epicas de Producto

> Estructura: Epica -> Historias de Usuario -> Tareas tecnicas
> Prioridad: P0 (critico), P1 (importante), P2 (mejora)

---

## EP-01 | Mejora de experiencia movil base

**Prioridad**: P0
**Estado**: Propuesta
**Descripcion**: Optimizar la UX actual para que la app se sienta nativa en movil, reemplazar patrones web por patrones moviles y eliminar fricciones de uso diario.

### Historias de usuario

- **HU-01.1**: Como usuario, quiero un boton flotante (FAB) para crear movimientos rapidos sin tener que navegar a la pantalla de Movimientos y hacer scroll hasta el formulario.
- **HU-01.2**: Como usuario, quiero un drawer lateral (menu hamburguesa) para acceder a todas las secciones de la app sin saturar la barra de navegacion inferior.
- **HU-01.3**: Como usuario, quiero ver notificaciones tipo toast/snackbar en lugar de alerts nativos del navegador cuando se complete una accion o haya un error.
- **HU-01.4**: Como usuario, quiero que los formularios de edicion de transacciones se abran en un modal/drawer en lugar de expandirse inline en la lista.
- **HU-01.5**: Como usuario, quiero poder hacer swipe en una transaccion para ver acciones rapidas (editar, eliminar) como en apps nativas.

### Notas tecnicas

- Reemplazar `alert()` por sistema de toasts con context React
- FAB con menu expandible: movimiento, gasto grupal, liquidacion
- Drawer lateral con secciones: Inicio, Movimientos, Grupos, Presupuestos, Recurrentes, Perfil
- Bottom nav reducida a 3 items: Inicio, Movs, Grupos
- Transiciones suaves entre pantallas (react-spring o CSS)

---

## EP-02 | Presupuestos por categoria

**Prioridad**: P1
**Estado**: Propuesta
**Descripcion**: Permitir al usuario definir limites de gasto mensuales por categoria y recibir alertas visuales cuando se acerque o supere el presupuesto.

### Historias de usuario

- **HU-02.1**: Como usuario, quiero crear un presupuesto mensual para una categoria especifica indicando un monto maximo.
- **HU-02.2**: Como usuario, quiero ver en una vista de presupuestos cuanto he gastado vs cuanto tengo disponible en cada categoria este mes.
- **HU-02.3**: Como usuario, quiero ver una barra de progreso visual por categoria que cambie de color al acercarse al limite (verde -> amarillo -> rojo).
- **HU-02.4**: Como usuario, quiero recibir una notificacion push cuando haya gastado el 80% y el 100% de mi presupuesto en una categoria.
- **HU-02.5**: Como usuario, quiero editar o eliminar un presupuesto existente en cualquier momento.
- **HU-02.6**: Como usuario, quiero ver un resumen historico de como me fue con mis presupuestos en meses anteriores.

### Notas tecnicas

- Nueva tabla Prisma: `Budget` (id, userId, categoryId, amount, period: 'monthly', month, year)
- Endpoint API: `GET /budgets`, `POST /budgets`, `PATCH /budgets/:id`, `DELETE /budgets/:id`
- Nueva seccion en drawer lateral: "Presupuestos"
- Componente `BudgetCard` con barra de progreso y semafaro de colores
- Calcular gasto del mes por categoria filtrando transacciones existentes
- Notificacion push al cruzar umbrales 80% y 100%

---

## EP-03 | Gastos recurrentes

**Prioridad**: P1
**Estado**: Propuesta
**Descripcion**: Automatizar la creacion de gastos que se repiten periodicamente (alquiler, Netflix, gimnasio) para que el usuario los vea reflejados sin tener que crearlos manualmente cada mes.

### Historias de usuario

- **HU-03.1**: Como usuario, quiero crear un gasto recurrente indicando monto, categoria, frecuencia (mensual, semanal, anual) y fecha de inicio.
- **HU-03.2**: Como usuario, quiero ver una lista de todos mis gastos recurrentes activos con su proxima fecha de ejecucion.
- **HU-03.3**: Como usuario, quiero que el sistema genere automaticamente la transaccion correspondiente cuando llegue la fecha de un gasto recurrente.
- **HU-03.4**: Como usuario, quiero poder pausar, reanudar o eliminar un gasto recurrente sin afectar las transacciones ya generadas.
- **HU-03.5**: Como usuario, quiero recibir una notificacion push un dia antes de que se ejecute un gasto recurrente para poder revisarlo.
- **HU-03.6**: Como usuario, quiero ver en el dashboard una seccion de "Proximos gastos del mes" con los recurrentes que me esperan.
- **HU-03.7**: Como usuario, quiero poder editar un gasto recurrente (monto, categoria, fecha) y decidir si los cambios aplican solo a esta ocurrencia o a todas las futuras.

### Notas tecnicas

- Nueva tabla Prisma: `RecurringExpense` (id, userId, categoryId, amount, note, frequency: 'weekly' | 'monthly' | 'yearly', startDate, nextOccurrence, status: 'active' | 'paused' | 'cancelled', applyChangesTo: 'this' | 'future')
- Job/scheduler en el backend que ejecute cada dia a medianoche las recurrencias pendientes
- Endpoint API: `GET /recurring`, `POST /recurring`, `PATCH /recurring/:id`, `DELETE /recurring/:id`, `POST /recurring/:id/pause`, `POST /recurring/:id/resume`
- Nueva seccion en drawer: "Recurrentes"
- Widget en dashboard: "Proximos este mes"
- Notificacion push 24h antes de ejecucion
- Las transacciones generadas tendran `sourceType: 'recurring'` y `locked: true`

---

## EP-04 | Dashboard mejorado y analitica basica

**Prioridad**: P1
**Estado**: Propuesta
**Descripcion**: Enriquecer el dashboard con mas informacion contextual, graficos de tendencias y insights que ayuden al usuario a entender sus habitos de gasto.

### Historias de usuario

- **HU-04.1**: Como usuario, quiero ver un grafico de linea con la evolucion de mi balance en los ultimos 30/90/365 dias.
- **HU-04.2**: Como usuario, quiero ver un grafico de dona con la distribucion de mis gastos por categoria en el mes actual.
- **HU-04.3**: Como usuario, quiero ver tarjetas de resumen con: gasto medio diario, categoria con mas gasto este mes, y comparativa con el mes anterior.
- **HU-04.4**: Como usuario, quiero poder filtrar el dashboard por rango de fechas personalizado.
- **HU-04.5**: Como usuario, quiero ver una seccion de "Insights" con mensajes automaticos como "Gastaste un 20% mas en comida este mes" o "Tu gasto recurrente representa el 60% de tus gastos".

### Notas tecnicas

- Reutilizar y mejorar componente `BalanceChart` existente
- Añadir libreria de graficos ligera (recharts o chart.js)
- Nuevos endpoints de agregacion: `GET /stats/summary`, `GET /stats/by-category`, `GET /stats/trend`
- Seccion de insights con logica de deteccion de patrones simple
- Cache de estadisticas para no recalcular en cada carga

---

## EP-05 | Mejoras de gestion de grupos

**Prioridad**: P2
**Estado**: Propuesta
**Descripcion**: Mejorar la experiencia de gestion de grupos existentes con funcionalidades que reduzcan la friccion en el dia a dia.

### Historias de usuario

- **HU-05.1**: Como usuario, quiero poder archivar un grupo que ya no uso activo sin eliminarlo (para consultar historico).
- **HU-05.2**: Como usuario, quiero ver un resumen rapido de mi balance en cada grupo directamente en la lista de grupos (cuanto debo/me deben).
- **HU-05.3**: Como usuario, quiero poder duplicar un gasto recurrente dentro de un grupo (ej: "Supermercado" que se repite cada semana).
- **HU-05.4**: Como usuario, quiero recibir una notificacion push cuando alguien añada un gasto a un grupo del que formo parte (ya implementado, verificar que funciona).
- **HU-05.5**: Como usuario, quiero poder buscar y filtrar gastos dentro de un grupo por categoria, miembro o fecha.
- **HU-05.6**: Como usuario, quiero ver un grafico de evolucion de gastos del grupo a lo largo del tiempo.

### Notas tecnicas

- Campo `archivedAt` en tabla `Group`
- Badge de balance en `group-card` de la lista
- Gastos recurrentes de grupo: nueva tabla `RecurringGroupExpense`
- Filtros avanzados en la vista de gastos de grupo
- Grafico de tendencia por grupo

---

## EP-06 | Instalacion como PWA y modo offline

**Prioridad**: P2
**Estado**: Propuesta
**Descripcion**: Convertir la web app en una Progressive Web App instalable que funcione parcialmente sin conexion y se sienta como una app nativa.

### Historias de usuario

- **HU-06.1**: Como usuario, quiero poder instalar la app en mi pantalla de inicio desde el navegador.
- **HU-06.2**: Como usuario, quiero poder ver mis datos cacheados cuando no tengo conexion a internet.
- **HU-06.3**: Como usuario, quiero poder crear un movimiento sin conexion y que se sincronice automaticamente cuando recupere la conexion.
- **HU-06.4**: Como usuario, quiero que la app tenga un splash screen y se abra sin la barra del navegador (standalone mode).

### Notas tecnicas

- Service Worker con estrategia cache-first para assets, network-first para datos
- `manifest.json` con iconos, colores y display: standalone
- Cola de acciones pendientes en localStorage/IndexedDB
- Deteccion de estado de red y UI de "sin conexion"
- Sincronizacion en background al recuperar conexion

---

## EP-07 | Refactor de arquitectura frontend

**Prioridad**: P1
**Estado**: Propuesta
**Descripcion**: Mejorar la estructura del frontend para que sea mas mantenible y escale bien al añadir nuevas funcionalidades.

### Historias de usuario

- **HU-07.1**: Como desarrollador, quiero separar el hook monolitico `useFinanceApp` en hooks modulares por dominio (auth, transactions, groups, budgets, recurring).
- **HU-07.2**: Como desarrollador, quiero un sistema de routing con React Router para poder tener URLs compartibles por pantalla.
- **HU-07.3**: Como desarrollador, quiero componentes reutilizables de UI (Modal, Drawer, Toast, FAB) en una carpeta `ui/` compartida.
- **HU-07.4**: Como desarrollador, quiero tests basicos de las funciones criticas de calculo de balances y repartos.

### Notas tecnicas

- Introducir React Router para navegacion por URL
- Extraer hooks: `useAuth`, `useTransactions`, `useGroups`, `useBudgets`, `useRecurring`
- Crear carpeta `src/components/ui/` con componentes base
- Añadir Vitest o Jest para tests unitarios de `lib/groups.ts` y `lib/userBalance.ts`
- Migrar formularios inline a componentes de modal/drawer reutilizables

---

## Resumen de prioridades

| Epica | Prioridad | Impacto | Esfuerzo |
|-------|-----------|---------|----------|
| EP-01 Mejora UX movil | P0 | Alto | Medio |
| EP-07 Refactor frontend | P1 | Alto | Medio |
| EP-02 Presupuestos | P1 | Alto | Medio |
| EP-03 Recurrentes | P1 | Alto | Alto |
| EP-04 Dashboard/analitica | P1 | Medio | Medio |
| EP-05 Mejoras grupos | P2 | Medio | Bajo |
| EP-06 PWA/offline | P2 | Alto | Alto |

### Orden recomendado de ejecucion

1. **EP-07** primero (refactor) - sienta las bases para todo lo demas
2. **EP-01** despues (UX movil) - mejora inmediata para el usuario
3. **EP-02** presupuestos - nueva funcionalidad de mayor valor
4. **EP-03** recurrentes - complementa presupuestos
5. **EP-04** dashboard - aprovecha datos existentes
6. **EP-05** grupos - mejoras incrementales
7. **EP-06** PWA - cierre para experiencia nativa
