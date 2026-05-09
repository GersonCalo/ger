# PRD para ingenieria - Historias de usuario y prioridades

## 1. Objetivo de este documento

Este documento traduce el PRD funcional a un backlog ejecutable para el equipo de ingenieria.
Incluye historias de usuario priorizadas en P0, P1 y P2, con criterios de aceptacion orientados a implementacion.

## 2. Convenciones

- Prioridad:
  - P0: obligatorio para release base (MVP operativo).
  - P1: importante para mejorar adopcion y calidad de uso.
  - P2: diferible para iteraciones futuras.
- Formato de historia:
  - Como [rol], quiero [accion], para [beneficio].
- Referencias tecnicas actuales:
  - API base: `/api/v1`.
  - Frontend API URL: `${VITE_API_URL}/api/v1` con fallback local.
  - Split soportado por API: `equal` y `manual`.

## 3. Epics

- E1: Autenticacion y sesion.
- E2: Finanzas personales.
- E3: Grupos y miembros.
- E4: Gastos compartidos y balances.
- E5: Liquidaciones y conciliacion.
- E6: Observabilidad, seguridad y calidad.

## 4. Backlog priorizado

## P0 - Must Have

### E1 - Autenticacion y sesion

#### US-P0-001 - Registro de usuario

Como persona nueva, quiero crear una cuenta con email y password, para empezar a usar la plataforma.

Criterios de aceptacion:

1. El endpoint de registro crea usuario con email unico.
2. Password se almacena hasheado, nunca en texto plano.
3. Al registrarme recibo sesion valida (token de acceso y refresh o equivalente del sistema actual).
4. Si el email ya existe, la API responde error controlado (4xx) con mensaje claro.

#### US-P0-002 - Login y sesion activa

Como usuario registrado, quiero iniciar sesion, para acceder a mis datos personales y de grupo.

Criterios de aceptacion:

1. Login correcto devuelve credenciales validas.
2. Login incorrecto devuelve error 401 o equivalente.
3. Rutas protegidas rechazan requests sin token valido.

### E2 - Finanzas personales

#### US-P0-003 - Crear movimiento personal

Como usuario, quiero registrar ingresos y gastos, para controlar mi dinero disponible.

Criterios de aceptacion:

1. Puedo crear movimiento con tipo (`income` o `expense`), monto, fecha y descripcion opcional.
2. El movimiento se persiste y aparece en historial del usuario autenticado.
3. El disponible se recalcula despues de cada alta.

#### US-P0-004 - Editar y eliminar movimiento personal

Como usuario, quiero corregir o borrar movimientos, para mantener mi informacion contable correcta.

Criterios de aceptacion:

1. Solo el duenio puede editar/eliminar su movimiento.
2. Al editar/eliminar se actualiza el disponible correctamente.
3. La API devuelve 404 si el movimiento no existe para ese usuario.

#### US-P0-005 - Ver resumen personal

Como usuario, quiero ver disponible, balance en grupos y total, para entender mi posicion financiera real.

Criterios de aceptacion:

1. El endpoint de resumen devuelve los 3 campos con consistencia numerica.
2. El frontend muestra los tres valores en una vista unica.
3. El total respeta la regla contable definida por producto.

### E3 - Grupos y miembros

#### US-P0-006 - Crear grupo

Como usuario, quiero crear un grupo, para compartir gastos con otras personas.

Criterios de aceptacion:

1. Puedo crear grupo con nombre y moneda (default EUR si no envio valor).
2. El creador queda asociado al grupo como miembro real.
3. El grupo queda accesible desde el listado de grupos del usuario.

#### US-P0-007 - Agregar miembros reales e invitados

Como organizador, quiero agregar miembros con cuenta o invitados por nombre, para representar a todos los participantes.

Criterios de aceptacion:

1. Se permite miembro real (con userId) y miembro invitado (sin userId).
2. Invitado requiere displayName no vacio.
3. El listado de miembros se devuelve ordenado de forma estable.

#### US-P0-008 - Acceso por codigo de grupo

Como usuario, quiero unirme a un grupo por codigo, para entrar rapido sin invitacion manual.

Criterios de aceptacion:

1. Existe endpoint de join por codigo.
2. Codigo invalido devuelve 404 o 400 con mensaje claro.
3. Si ya pertenezco al grupo, la operacion es idempotente (no duplica membresia).

### E4 - Gastos compartidos y balances

#### US-P0-009 - Registrar gasto grupal con split equal/manual

Como miembro de grupo, quiero cargar un gasto y repartirlo, para reflejar deudas y creditos del grupo.

Criterios de aceptacion:

1. El gasto requiere: grupo, pagador, monto > 0 y participantes del split.
2. Split `equal` distribuye montos de forma consistente (con regla de redondeo definida).
3. Split `manual` valida que la suma repartida sea igual al monto total.
4. Si se envia split no soportado (ej. `weights`), responde error 4xx.

#### US-P0-010 - Recalculo de balances por miembro

Como miembro de grupo, quiero ver balances actualizados, para saber cuanto debo o me deben.

Criterios de aceptacion:

1. Cada alta/edicion/eliminacion de gasto recalcula balance del grupo.
2. El endpoint de balance devuelve valor por miembro.
3. La suma algebraica de balances del grupo debe ser 0 (dentro de tolerancia de redondeo).

#### US-P0-011 - Integracion con historial unificado

Como usuario, quiero que los eventos grupales relevantes aparezcan en movimientos, para tener trazabilidad completa.

Criterios de aceptacion:

1. Gastos/liquidaciones de grupo que impactan al usuario aparecen en historial unificado.
2. Cada item indica origen (`manual` o `group`).
3. No hay duplicados de eventos por reintentos de frontend.

### E5 - Liquidaciones y conciliacion

#### US-P0-012 - Registrar liquidacion entre miembros

Como miembro, quiero registrar un pago de liquidacion, para cerrar deudas del grupo.

Criterios de aceptacion:

1. La liquidacion persiste pagador, receptor, monto y fecha.
2. Monto debe ser > 0 y miembros deben pertenecer al mismo grupo.
3. La operacion actualiza balances del grupo de forma consistente.

#### US-P0-013 - Impacto de liquidaciones en disponible personal

Como usuario, quiero que una liquidacion actualice mi disponible personal, para mantener coherencia contable global.

Criterios de aceptacion:

1. Si pago una liquidacion, mi disponible disminuye.
2. Si cobro una liquidacion, mi disponible aumenta.
3. El ajuste aparece en historial unificado con metadatos del grupo.

### E6 - Observabilidad, seguridad y calidad

#### US-P0-014 - Validacion y errores de API

Como equipo de producto, queremos errores de validacion consistentes, para reducir tickets y facilitar debug.

Criterios de aceptacion:

1. Endpoints core responden 4xx en datos invalidos y 5xx en fallos internos.
2. Errores incluyen codigo y mensaje legible.
3. Inputs se validan antes de tocar base de datos.

#### US-P0-015 - Salud y configuracion minima

Como equipo tecnico, queremos endpoints de salud/config y env minima valida, para operar local y desplegar sin sorpresas.

Criterios de aceptacion:

1. `GET /health` responde OK (o redireccion temporal vigente hacia `/api/v1/health`).
2. `DATABASE_URL` es obligatorio al iniciar API.
3. Faltantes criticos de env detienen arranque con mensaje claro.

## P1 - Should Have

#### US-P1-001 - Edicion de gastos grupales

Como miembro autorizado, quiero editar gastos, para corregir errores de carga.

Criterios de aceptacion:

1. Solo actores autorizados pueden editar.
2. Al editar, se recalculan splits y balances.
3. Se conserva historial de cambios basico (updatedAt y actor).

#### US-P1-002 - Eliminacion de gastos grupales

Como miembro autorizado, quiero eliminar gastos invalidos, para limpiar el estado del grupo.

Criterios de aceptacion:

1. Al eliminar, balances se recalculan correctamente.
2. La eliminacion no rompe liquidaciones ya persistidas; si aplica, rechaza con regla de negocio clara.

#### US-P1-003 - Filtros en historial unificado

Como usuario, quiero filtrar por fecha, tipo y origen, para auditar mis movimientos rapido.

Criterios de aceptacion:

1. Filtros por rango de fechas, ingreso/gasto y origen.
2. Paginacion estable en API y frontend.

#### US-P1-004 - Mejoras de UX de conciliacion

Como usuario, quiero ver sugerencias simples de "a quien pagar", para cerrar deudas con menos pasos.

Criterios de aceptacion:

1. Vista de balances muestra pares de pago sugeridos.
2. Las sugerencias son consistentes con el balance neto calculado.

#### US-P1-005 - Proteccion contra operaciones duplicadas

Como equipo tecnico, queremos idempotencia en acciones criticas, para evitar dobles cargos por retries.

Criterios de aceptacion:

1. Crear gasto y crear liquidacion aceptan clave de idempotencia.
2. Reintentos con misma clave no crean registros duplicados.

## P2 - Could Have

#### US-P2-001 - Soporte multi-moneda avanzado

Como usuario viajero, quiero manejar grupos en distintas monedas con conversion, para tener lectura consolidada.

Criterios de aceptacion:

1. Se permite moneda por grupo y conversion configurable.
2. El resumen personal explicita tipo de cambio aplicado.

#### US-P2-002 - Notificaciones de eventos de grupo

Como miembro, quiero notificaciones de nuevos gastos/liquidaciones, para mantenerme al dia.

Criterios de aceptacion:

1. Evento de gasto o liquidacion genera notificacion in-app.
2. Usuario puede marcar notificacion como leida.

#### US-P2-003 - Exportacion de movimientos

Como usuario, quiero exportar movimientos a CSV, para analisis externo.

Criterios de aceptacion:

1. Exporta historial filtrado en formato CSV.
2. Incluye columnas minimas: fecha, tipo, monto, origen, descripcion.

## 5. Checklist tecnico de salida por prioridad

### Definicion de Done para P0

1. Historias P0 implementadas con criterios de aceptacion cumplidos.
2. Verificacion manual end-to-end de flujos core:
   - crear movimiento personal,
   - crear grupo,
   - registrar gasto,
   - registrar liquidacion,
   - validar resumen consolidado.
3. Documentacion tecnica actualizada en `docs/`.
4. Sin secretos en commits ni archivos de configuracion versionados.

### Definicion de Done para P1/P2

1. Cumplimiento de criterios de aceptacion de cada historia.
2. Sin regresiones en flujos P0.
3. Documentacion incremental por feature.

## 6. Orden recomendado de implementacion

1. E1 Autenticacion base.
2. E2 Finanzas personales.
3. E3 Grupos y miembros.
4. E4 Gastos y balances.
5. E5 Liquidaciones e integracion contable.
6. E6 Observabilidad y endurecimiento.
