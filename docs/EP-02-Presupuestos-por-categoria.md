# EP-02 | Presupuestos por categoría

## Metadata de la Épica
- **Key**: EP-02
- **Prioridad**: P1
- **Estado**: Propuesta
- **Descripción**: Permitir al usuario definir límites de gasto mensuales por categoría y recibir alertas visuales cuando se acerque o supere el presupuesto.

---

## HU-02.0 | Base de datos + API de Presupuestos DONE

### Metadata
- **Tipo**: Story (Habilitadora)
- **Prioridad**: P0 (Bloqueante)
- **Estimación**: 5 SP
- **Estado**: To Do
- **Componentes**: Backend, Database
- **Labels**: epic-EP-02, backend, prisma, api

### Descripción (Product Owner)
**¿Qué queremos hacer?**
Habilitar la infraestructura necesaria para gestionar presupuestos por categoría: modelo de base de datos, endpoints de API y validaciones de negocio.

**¿Qué queremos conseguir?**
Que el equipo pueda construir todas las historias de usuario de presupuestos sin bloqueos técnicos, con una base sólida y consistente.

### Implementación Técnica (Team Leader)
**Cambios a realizar:**
1. Crear modelo Prisma `Budget` en `packages/db/schema.prisma`:
   - `id` (String @id @default(cuid()))
   - `userId` (String)
   - `categoryId` (String)
   - `amount` (Float)
   - `period` (Enum: 'monthly')
   - `month` (Int: 1-12)
   - `year` (Int)
   - `createdAt` (DateTime @default(now()))
   - `updatedAt` (DateTime @updatedAt)
   - `@@unique([userId, categoryId, month, year, period])`

2. Crear rutas en `apps/api/src/routes/budgets.ts`:
   - `GET /api/v1/budgets` - Listar presupuestos del usuario
   - `POST /api/v1/budgets` - Crear presupuesto
   - `PATCH /api/v1/budgets/:id` - Editar presupuesto
   - `DELETE /api/v1/budgets/:id` - Eliminar presupuesto

3. Validaciones:
   - `amount > 0`
   - `month` entre 1 y 12
   - `year` válido (ej: 2020-2099)
   - `categoryId` existente y perteneciente al usuario
   - Unicidad por `userId + categoryId + month + year + period`

4. Respuestas de error:
   - `400` - Validación fallida
   - `404` - Recurso no encontrado
   - `409` - Presupuesto duplicado

### Criterios de Aceptación
- [ ] Se puede crear un presupuesto válido y recuperarlo por API
- [ ] No se permite duplicar presupuesto para misma categoría/mes/año/usuario
- [ ] No se aceptan montos 0 o negativos
- [ ] Los endpoints responden bajo prefijo `/api/v1`
- [ ] Tests de API cubren casos felices y de validación
- [ ] `prisma db push` aplica el esquema sin errores

### Subtareas
- [ ] Definir modelo Prisma y generar cliente
- [ ] Implementar GET /budgets con filtros
- [ ] Implementar POST /budgets con validaciones
- [ ] Implementar PATCH /budgets/:id
- [ ] Implementar DELETE /budgets/:id
- [ ] Agregar tests de integración para cada endpoint
- [ ] Documentar endpoints en Swagger/OpenAPI si aplica

### Dependencias
- Ninguna (es habilitadora)

### Definition of Done
- [ ] Schema Prisma mergeado y aplicado
- [ ] Endpoints funcionando con validaciones
- [ ] Tests pasando
- [ ] Code review aprobado
- [ ] Desplegado en ambiente de desarrollo

---

## HU-02.1 | Crear presupuesto mensual por categoría DONE

### Metadata
- **Tipo**: Story
- **Prioridad**: P1
- **Estimación**: 3 SP
- **Estado**: To Do
- **Componentes**: Frontend, Backend
- **Labels**: epic-EP-02, frontend, form

### Descripción (Product Owner)
**¿Qué queremos hacer?**
Permitir al usuario crear un presupuesto mensual para una categoría específica indicando un monto máximo.

**¿Qué queremos conseguir?**
Que el usuario pueda definir límites de gasto claros para cada categoría y mes, anticipándose a sobre-gastos.

### Implementación Técnica (Team Leader)
**Cambios a realizar:**
1. Agregar sección "Presupuestos" en drawer lateral (`apps/web/src/components/Drawer.tsx` o equivalente)
2. Crear vista `/budgets/new` o modal de alta
3. Formulario con campos:
   - Selector de categoría (dropdown con categorías del usuario)
   - Input de monto (numérico, validación > 0)
   - Selector de mes/año (default: mes/año actual)
4. Consumir `POST /api/v1/budgets`
5. Manejar estados de UI:
   - Loading durante submit
   - Mensaje de éxito tras creación
   - Mensaje de error claro si hay duplicado o validación fallida
6. Redirigir o actualizar lista tras creación exitosa

### Criterios de Aceptación
- [ ] El usuario puede crear un presupuesto desde UI y verlo reflejado sin recargar manualmente
- [ ] Si existe presupuesto duplicado (misma categoría y período), se muestra error entendible
- [ ] El formulario impide monto inválido (0, negativo, no numérico)
- [ ] Mes/año por defecto = actual, editable por usuario
- [ ] Categoría es obligatoria y debe pertenecer al usuario

### Subtareas
- [ ] Agregar item "Presupuestos" en drawer lateral
- [ ] Crear componente BudgetForm
- [ ] Implementar validación de formulario
- [ ] Conectar con POST /api/v1/budgets
- [ ] Manejar estados de loading/error/success
- [ ] Actualizar lista o redirigir tras creación

### Dependencias
- HU-02.0 (Base de datos + API)

### Definition of Done
- [ ] Formulario funcional con validaciones
- [ ] Integración con API verificada
- [ ] Manejo de errores implementado
- [ ] Responsive en móvil y desktop
- [ ] Code review aprobado

---

## HU-02.2 | Vista de presupuestos con "gastado vs disponible" DONE

### Metadata
- **Tipo**: Story
- **Prioridad**: P1
- **Estimación**: 5 SP
- **Estado**: To Do
- **Componentes**: Frontend, Backend
- **Labels**: epic-EP-02, frontend, dashboard

### Descripción (Product Owner)
**¿Qué queremos hacer?**
Mostrar al usuario cuánto gastó y cuánto le queda por categoría en el mes actual.

**¿Qué queremos conseguir?**
Que el usuario tome decisiones rápidas de gasto al ver de un vistazo su estado presupuestario.

### Implementación Técnica (Team Leader)
**Cambios a realizar:**
1. Crear vista principal `/budgets` o sección en Presupuestos
2. Consultar presupuestos del período actual (`GET /api/v1/budgets?month=X&year=Y`)
3. Calcular gasto mensual por categoría:
   - Filtrar transacciones del usuario por mes/año y categoría
   - Sumar montos de transacciones de gasto
4. Para cada presupuesto mostrar:
   - Presupuesto total (amount)
   - Gastado (suma de transacciones)
   - Disponible (amount - gastado, puede ser negativo)
   - % consumido ((gastado / amount) * 100)
5. Redondeo/moneda consistente con resto de la app
6. Manejar caso: categoría sin transacciones → gastado = 0

### Criterios de Aceptación
- [ ] Para cada categoría con presupuesto, se visualizan total, gastado y disponible correctos
- [ ] El cálculo coincide con transacciones del mismo mes/año
- [ ] Si no hay transacciones, gastado = 0 y disponible = total
- [ ] Si se supera el límite, disponible se muestra negativo y estado visual de exceso
- [ ] Formato de moneda consistente con resto de la app

### Subtareas
- [ ] Crear vista principal de presupuestos
- [ ] Implementar cálculo de gasto por categoría desde transacciones
- [ ] Crear componente BudgetList/BudgetGrid
- [ ] Mostrar métricas: total, gastado, disponible, %
- [ ] Formatear montos con moneda consistente
- [ ] Manejar estado vacío (sin presupuestos creados)

### Dependencias
- HU-02.0 (API)
- HU-02.1 (Navegación a Presupuestos)

### Definition of Done
- [ ] Cálculos verificados contra datos reales
- [ ] Vista renderizada con datos correctos
- [ ] Formato de moneda consistente
- [ ] Estado vacío manejado
- [ ] Code review aprobado

---

## HU-02.3 | Barra de progreso con semáforo (verde/amarillo/rojo)

### Metadata
- **Tipo**: Story
- **Prioridad**: P1
- **Estimación**: 3 SP
- **Estado**: To Do
- **Componentes**: Frontend
- **Labels**: epic-EP-02, frontend, ui-component

### Descripción (Product Owner)
**¿Qué queremos hacer?**
Agregar una señal visual inmediata del estado de cada presupuesto mediante una barra de progreso con colores.

**¿Qué queremos conseguir?**
Que el usuario entienda su situación financiera de un vistazo sin necesidad de leer números detallados.

### Implementación Técnica (Team Leader)
**Cambios a realizar:**
1. Crear componente `BudgetCard` en `apps/web/src/components/BudgetCard.tsx`
2. Barra de progreso con:
   - Ancho proporcional al % consumido (max 100%)
   - Color según umbrales:
     - Verde: `< 80%`
     - Amarillo: `>= 80% y < 100%`
     - Rojo: `>= 100%`
3. Etiqueta textual de estado para accesibilidad:
   - "Dentro del presupuesto" (verde)
   - "Cerca del límite" (amarillo)
   - "Presupuesto excedido" (rojo)
4. No depender solo de color (cumplir WCAG)
5. Responsive: legible en pantallas pequeñas
6. Integrar con vista de HU-02.2

### Criterios de Aceptación
- [ ] La barra cambia de color correctamente según % consumido
- [ ] El porcentaje y estado textual se muestran correctamente
- [ ] El diseño es legible en pantallas pequeñas
- [ ] Cumple accesibilidad mínima (contraste y texto de estado)
- [ ] Barra no excede 100% visualmente aunque el % real sea mayor

### Subtareas
- [ ] Crear componente BudgetCard
- [ ] Implementar barra de progreso con colores dinámicos
- [ ] Definir umbrales de color (verde/amarillo/rojo)
- [ ] Agregar etiquetas de estado para accesibilidad
- [ ] Estilizar componente responsive
- [ ] Integrar en vista de presupuestos

### Dependencias
- HU-02.2 (Vista de presupuestos)

### Definition of Done
- [ ] Componente reutilizable creado
- [ ] Colores y umbrales verificados
- [ ] Accesibilidad verificada
- [ ] Responsive en móvil y desktop
- [ ] Code review aprobado

---

## HU-02.4 | Notificaciones push en umbrales 80% y 100%

### Metadata
- **Tipo**: Story
- **Prioridad**: P2
- **Estimación**: 8 SP
- **Estado**: To Do
- **Componentes**: Backend, Frontend, Infrastructure
- **Labels**: epic-EP-02, push-notifications, backend, frontend

### Descripción (Product Owner)
**¿Qué queremos hacer?**
Enviar alertas push al usuario cuando alcance el 80% y 100% del presupuesto en una categoría.

**¿Qué queremos conseguir?**
Que el usuario actúe antes de excederse o frene el gasto al recibir alertas oportunas.

### Implementación Técnica (Team Leader)
**Cambios a realizar:**
1. Backend - Detección de umbrales:
   - Al crear/editar transacción, verificar presupuestos del mes
   - Calcular % consumido por categoría
   - Detectar cruce de umbrales (80%, 100%)
   - Registrar notificación enviada para evitar duplicados

2. Tabla/registro de notificaciones enviadas:
   - `BudgetAlert` (id, budgetId, threshold: 80|100, sentAt)
   - O campo en `Budget`: `alert80Sent: Boolean`, `alert100Sent: Boolean`

3. Push notifications:
   - Usar sistema existente de push (Web Push API)
   - Payload:
     - Título: "Presupuesto [Categoría]"
     - Mensaje: "Alcanzaste el 80% de tu presupuesto" o "Superaste tu presupuesto"
     - Deeplink: `/budgets`

4. Frontend:
   - Solicitar permiso de notificaciones si no otorgado
   - Manejar caso sin push habilitado (fallback a notificación in-app)

5. Edge cases:
   - Reset de alertas al cambiar de mes
   - No reenviar mismo umbral para misma categoría/mes

### Criterios de Aceptación
- [ ] Se envía push al cruzar 80% por primera vez en el mes
- [ ] Se envía push al cruzar 100% por primera vez en el mes
- [ ] No se reenvía repetidamente el mismo umbral para la misma categoría/mes
- [ ] El mensaje identifica claramente categoría y porcentaje alcanzado
- [ ] Alertas se resetean al iniciar nuevo mes
- [ ] Flujo no se rompe si usuario no habilitó push

### Subtareas
- [ ] Implementar lógica de detección de umbrales en creación/edición de transacción
- [ ] Crear registro de alertas enviadas (modelo o campos)
- [ ] Integrar con sistema de push notifications existente
- [ ] Definir payload de notificación (título, mensaje, deeplink)
- [ ] Implementar reset de alertas por mes
- [ ] Manejar fallback si push no habilitado
- [ ] Tests de integración para flujo de alertas

### Dependencias
- HU-02.0 (API de presupuestos)
- HU-02.2 (Cálculo de gasto por categoría)
- Sistema de push notifications existente (si ya existe)

### Definition of Done
- [ ] Lógica de detección implementada y testeada
- [ ] Push notifications funcionando
- [ ] Prevención de duplicados verificada
- [ ] Reset mensual funcionando
- [ ] Fallback para sin push implementado
- [ ] Code review aprobado

---

## HU-02.5 | Editar y eliminar presupuesto

### Metadata
- **Tipo**: Story
- **Prioridad**: P2
- **Estimación**: 3 SP
- **Estado**: To Do
- **Componentes**: Frontend, Backend
- **Labels**: epic-EP-02, frontend, crud

### Descripción (Product Owner)
**¿Qué queremos hacer?**
Permitir al usuario editar o eliminar presupuestos existentes.

**¿Qué queremos conseguir?**
Que el usuario mantenga sus límites actualizados según cambios en su realidad financiera.

### Implementación Técnica (Team Leader)
**Cambios a realizar:**
1. UI - Acciones por tarjeta de presupuesto:
   - Botón editar (abre formulario pre-cargado)
   - Botón eliminar (con confirmación modal)

2. Editar:
   - Reutilizar componente BudgetForm de HU-02.1
   - Precargar datos existentes
   - Consumir `PATCH /api/v1/budgets/:id`
   - Validar duplicados al editar (excluyendo propio ID)

3. Eliminar:
   - Modal de confirmación: "¿Estás seguro de eliminar este presupuesto?"
   - Consumir `DELETE /api/v1/budgets/:id`
   - Eliminar de UI tras confirmación

4. Refrescar indicadores tras editar/eliminar

### Criterios de Aceptación
- [ ] El usuario puede editar un presupuesto y ver cambios reflejados inmediatamente
- [ ] El usuario puede eliminar un presupuesto con confirmación previa
- [ ] Se respeta validación de duplicados al editar
- [ ] Tras editar/eliminar, la lista e indicadores quedan consistentes
- [ ] Mensajes de confirmación claros para ambas acciones

### Subtareas
- [ ] Agregar botones editar/eliminar en BudgetCard
- [ ] Implementar modal de confirmación para eliminar
- [ ] Reutilizar BudgetForm para edición con datos precargados
- [ ] Conectar con PATCH /api/v1/budgets/:id
- [ ] Conectar con DELETE /api/v1/budgets/:id
- [ ] Refrescar lista tras acciones
- [ ] Validar duplicados al editar

### Dependencias
- HU-02.1 (Formulario de creación)
- HU-02.2 (Vista de presupuestos)
- HU-02.0 (API endpoints)

### Definition of Done
- [ ] Edición funcionando con validaciones
- [ ] Eliminación con confirmación
- [ ] Lista se actualiza tras cambios
- [ ] Code review aprobado

---

## HU-02.6 | Resumen histórico mensual de desempeño

### Metadata
- **Tipo**: Story
- **Prioridad**: P2
- **Estimación**: 5 SP
- **Estado**: To Do
- **Componentes**: Frontend, Backend
- **Labels**: epic-EP-02, frontend, reports

### Descripción (Product Owner)
**¿Qué queremos hacer?**
Permitir al usuario revisar meses anteriores para ver cómo se comportó respecto a sus presupuestos.

**¿Qué queremos conseguir?**
Que el usuario identifique patrones de gasto y mejore su planificación financiera.

### Implementación Técnica (Team Leader)
**Cambios a realizar:**
1. Backend - Endpoint o query para histórico:
   - `GET /api/v1/budgets/history?from=YYYY-MM&to=YYYY-MM`
   - O reutilizar `GET /budgets` con filtros de rango
   - Incluir gasto real calculado por mes/categoría

2. Frontend - Vista histórica:
   - Selector de período (mes/año o rango)
   - Navegación mes a mes (flechas < >)
   - Por categoría mostrar:
     - Presupuesto
     - Gastado real
     - Variación (gastado - presupuesto, con signo)
     - Estado final: "Dentro" o "Excedido"

3. Performance:
   - Limitar rango máximo (ej: 12 meses)
   - Paginación o lazy loading si necesario
   - Caché de datos históricos si aplica

4. UI:
   - Tabla o cards por mes
   - Indicador visual de sobre/infra presupuesto
   - Exportar o compartir (opcional, futuro)

### Criterios de Aceptación
- [ ] El usuario puede navegar meses anteriores y ver datos correctos
- [ ] Cada categoría muestra comparación presupuesto vs gasto real del período
- [ ] Se identifica claramente si terminó por debajo o por encima del límite
- [ ] La carga de histórico es performante y estable
- [ ] Rango máximo de consulta definido (ej: 12 meses)

### Subtareas
- [ ] Implementar endpoint/query para histórico
- [ ] Crear vista de historico con selector de período
- [ ] Implementar navegación mes a mes
- [ ] Mostrar comparación presupuesto vs gasto real
- [ ] Agregar indicador visual de estado final
- [ ] Optimizar performance para rangos grandes
- [ ] Limitar rango máximo de consulta

### Dependencias
- HU-02.2 (Cálculo de gasto por categoría)
- HU-02.0 (API)

### Definition of Done
- [ ] Histórico funcionando con datos correctos
- [ ] Navegación por meses implementada
- [ ] Performance verificada
- [ ] Code review aprobado

---

## Orden de Implementación Recomendado

| Orden | Historia | Prioridad | SP | Dependencias |
|-------|----------|-----------|----|--------------|
| 1 | HU-02.0 | P0 | 5 | Ninguna |
| 2 | HU-02.1 | P1 | 3 | HU-02.0 |
| 3 | HU-02.2 | P1 | 5 | HU-02.0, HU-02.1 |
| 4 | HU-02.3 | P1 | 3 | HU-02.2 |
| 5 | HU-02.5 | P2 | 3 | HU-02.0, HU-02.1, HU-02.2 |
| 6 | HU-02.4 | P2 | 8 | HU-02.0, HU-02.2 |
| 7 | HU-02.6 | P2 | 5 | HU-02.0, HU-02.2 |

**Total estimado**: 32 Story Points

---

## Riesgos y Consideraciones

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Duplicación de presupuestos | Alto | Restricción de unicidad en BD + validación en API |
| Cálculo incorrecto de gasto | Alto | Tests exhaustivos con casos edge |
| Notificaciones duplicadas | Medio | Registro de alertas enviadas por umbral/mes |
| Performance en histórico | Medio | Limitar rango, paginar, cachear |
| Push no habilitado | Bajo | Fallback a notificación in-app |
