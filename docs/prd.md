# PRD - Plataforma de Finanzas Personales y Gastos Compartidos

## 1. Resumen del producto

La plataforma unifica finanzas personales y gastos compartidos en grupos dentro de una sola experiencia. El usuario puede registrar ingresos y egresos propios, crear grupos, dividir gastos con otras personas y visualizar en tiempo real su dinero disponible, su balance grupal y el total recuperable.

## 2. Problema a resolver

Las apps de finanzas personales y las apps de "expense splitting" suelen estar separadas. Esto genera fricción y errores porque:

- El usuario lleva doble registro (personal y grupal).
- No existe una lectura contable única de "cuanto tengo" versus "cuanto me deben".
- Las liquidaciones de grupo no siempre impactan en el saldo personal.

## 3. Objetivos

- Consolidar en un solo producto las finanzas personales y grupales.
- Reducir errores de registro y conciliacion manual.
- Aumentar claridad contable para tomar decisiones diarias de gasto.

## 4. Metricas de exito (KPIs)

- Tiempo medio para registrar un gasto personal: < 20 segundos.
- Tiempo medio para registrar un gasto grupal: < 45 segundos.
- Porcentaje de grupos con al menos una liquidacion registrada en 30 dias: > 60%.
- Retencion de usuarios activos 30 dias (WAU/MAU): objetivo >= 40%.
- Tasa de errores de API en operaciones core (transacciones, gastos, liquidaciones): < 1%.

## 5. Usuarios objetivo

- **Persona individual**: quiere controlar su dinero diario sin complejidad.
- **Organizador de grupo**: administra gastos de viajes, hogar o eventos.
- **Miembro invitado**: participa en grupos sin cuenta completa, representado por nombre.

## 6. Alcance funcional (MVP+)

### 6.1 Finanzas personales

- Alta, edicion y eliminacion de movimientos personales (ingresos y gastos).
- Vista de disponible actual.
- Historial de movimientos con origen manual o grupal.

### 6.2 Grupos y miembros

- Crear grupo con moneda por defecto EUR.
- Agregar miembros reales (usuario) e invitados (sin userId).
- Acceso a grupo por codigo.

### 6.3 Gastos compartidos

- Registrar gasto con pagador, monto y descripcion.
- Reparto de gasto en modos `equal` y `manual`.
- Calculo de balances por miembro.

### 6.4 Liquidaciones

- Registrar pagos de liquidacion entre miembros.
- Persistir historial de liquidaciones.
- Reflejar impacto de liquidaciones en balance grupal y disponible personal.

### 6.5 Integracion contable

- Todo gasto/liquidacion grupal relevante debe generar lectura consistente en finanzas personales.
- La vista de resumen debe mostrar:
  - Disponible.
  - Balance en grupos.
  - Total recuperable.

## 7. Fuera de alcance (por ahora)

- Multi-moneda avanzada con conversion en tiempo real.
- Reglas automaticas de presupuestos y alertas inteligentes.
- Integracion bancaria/open banking.
- Aplicaciones moviles nativas.
- Motor de analitica avanzada (forecasting, scoring, ML).

## 8. Requisitos no funcionales

- **Arquitectura**: monorepo npm workspace con `apps/api`, `apps/web`, `packages/db`.
- **API**: rutas bajo `/api/v1`.
- **Performance**:
  - p95 de lectura de resumen financiero < 400 ms en entorno objetivo.
  - p95 de escritura de gasto/liquidacion < 700 ms.
- **Confiabilidad**: consistencia de datos en operaciones contables criticas.
- **Seguridad**:
  - JWT para autenticacion.
  - Validacion de entrada en API.
  - No exponer secretos en repositorio.
- **Observabilidad minima**:
  - logs de errores por endpoint,
  - metricas basicas de latencia y tasa de error.

## 9. Requisitos tecnicos y restricciones

- Frontend en React + Vite + TypeScript.
- Backend en Express + TypeScript.
- PostgreSQL + Prisma (schema compartido en `packages/db/schema.prisma`).
- Desarrollo y orquestacion principal con Docker Compose.
- Para cambios de schema Prisma en entorno Docker, se requiere rebuild del stack.

## 10. Flujos principales

1. **Onboarding**
   - Usuario crea cuenta/inicia sesion y entra a dashboard.
2. **Registro personal**
   - Usuario agrega ingreso/gasto y actualiza disponible.
3. **Creacion de grupo**
   - Usuario crea grupo, agrega miembros y comparte codigo.
4. **Carga de gasto grupal**
   - Se registra gasto, se divide (`equal`/`manual`) y se recalcula balance.
5. **Liquidacion**
   - Se registra pago entre miembros y se ajustan saldos.
6. **Consulta consolidada**
   - Usuario revisa disponible, balance grupal y total.

## 11. Criterios de aceptacion de producto

- El usuario puede crear y editar movimientos personales sin errores de validacion en casos validos.
- Un gasto grupal actualizado impacta en balances de grupo y en historial unificado de movimientos.
- Una liquidacion registrada actualiza saldos de forma consistente para pagador y receptor.
- Las rutas principales responden en los SLA definidos en ambiente objetivo.
- El frontend consume correctamente `${VITE_API_URL}/api/v1` con fallback esperado.

## 12. Riesgos y mitigaciones

- **Riesgo**: inconsistencia entre operaciones personales y grupales.
  - **Mitigacion**: transacciones atomicas donde aplique y pruebas de regresion contable.
- **Riesgo**: desalineacion entre schema Prisma y API en Docker.
  - **Mitigacion**: rebuild obligatorio tras cambios de schema y checklist de despliegue.
- **Riesgo**: complejidad UX por mezclar dos dominios financieros.
  - **Mitigacion**: copy claro, jerarquia visual y onboarding guiado.

## 13. Roadmap propuesto

- **Fase 1 (actual)**: finanzas + grupos + liquidaciones persistidas.
- **Fase 2**: mejoras UX de conciliacion y reportes.
- **Fase 3**: colaboracion avanzada, notificaciones y automatizaciones.
- **Fase 4**: capacidades premium (multi-moneda, integraciones externas).

## 14. Dependencias

- Infra Docker local para desarrollo rapido.
- Base de datos PostgreSQL disponible y consistente.
- Variables de entorno minimas (`DATABASE_URL`, `JWT_SECRET`, etc.).

## 15. Definicion de listo (DoD)

Una entrega se considera lista cuando:

- Cumple criterios funcionales del modulo.
- Mantiene consistencia contable entre personal y grupos.
- Incluye actualizacion de documentacion tecnica relevante.
- Se valida manualmente en flujo end-to-end principal.
