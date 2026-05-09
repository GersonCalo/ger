# Plan de acción: faltantes vs PRD de ingeniería (GER)

Este documento prioriza lo que falta por completar según `docs/prd-ingenieria.md` y las decisiones acordadas:

- Solo se pueden **editar/eliminar transacciones manuales** (`locked=false`).
- Paginación del historial por **cursor**.
- Idempotencia como **campo en el body**.

## 1) P0-004: Editar y eliminar movimiento personal

### Objetivo (Product Owner)
Como usuario, quiero corregir o borrar movimientos personales que registré mal, para que mi información contable sea correcta y mi disponible/resumen se actualice automáticamente.

### Trabajo en el proyecto (Ingeniería)

Backend (API):

1. Implementar `PATCH /api/v1/transactions/:id` para editar transacciones personales.
2. Implementar `DELETE /api/v1/transactions/:id` para eliminar transacciones personales.
3. Reglas:
4. Solo permitir operar sobre transacciones del usuario autenticado.
5. Prohibir editar/eliminar transacciones `locked=true` (sincronizadas desde grupos).
6. Validar y normalizar `amount`, `occurredAt`, `note`, `categoryId` según contrato actual.
7. Responder 404 si no existe o no pertenece al usuario.

Frontend (Web):

1. En `TransactionsScreen`, agregar acciones de editar/eliminar solo cuando `locked=false`.
2. Refrescar balance e historial al confirmar la operación.

### Criterios de aceptación

1. Un usuario solo puede editar/eliminar sus transacciones manuales.
2. Si `locked=true`, la API responde 4xx con error claro y la UI no ofrece la acción.
3. Tras editar/eliminar, `GET /balance` y `GET /transactions` reflejan el cambio.
4. Si el id no existe, devuelve 404.

## 2) P0-014: Validación y errores de API consistentes

### Objetivo (Product Owner)
Como equipo, quiero que los errores de validación sean consistentes y legibles, para reducir confusión del usuario y facilitar el soporte/debug.

### Trabajo en el proyecto (Ingeniería)

Backend (API):

1. Definir un contrato uniforme de error (shape y campos mínimos).
2. Unificar el formato de errores devueltos por:
3. Validaciones Zod (`safeParse`).
4. Reglas de negocio (permisos, recursos inexistentes, montos inválidos, etc.).
5. Alinear `errorHandler` con los returns manuales para que no existan dos formatos diferentes.

Frontend (Web):

1. Asegurar que el cliente muestre `message` de manera uniforme para 4xx.

### Criterios de aceptación

1. Los endpoints core devuelven el mismo shape de error en 4xx.
2. Errores de validación incluyen un código/identificador consistente y `details` cuando aplique.
3. Errores 5xx no filtran información sensible en producción.

## 3) P1-003: Filtros + paginación por cursor en historial unificado

### Objetivo (Product Owner)
Como usuario, quiero filtrar mi historial por fecha, tipo y origen, y cargarlo por páginas sin duplicados, para auditar mis movimientos rápido.

### Trabajo en el proyecto (Ingeniería)

Backend (API):

1. Extender `GET /api/v1/transactions` con filtros:
2. `from` / `to` (fecha-hora ISO) opcionales.
3. `type=income|expense` opcional.
4. origen (por ejemplo `origin=manual|group` o `sourceType`), opcional.
5. Implementar paginación por cursor:
6. Request: `cursor` (id/occurredAt) + `limit`.
7. Response: `nextCursor` + `hasMore`.
8. Mantener orden estable (ej. `occurredAt desc, id desc`).

Frontend (Web):

1. UI de filtros en `TransactionsScreen`.
2. “Cargar más” usando `nextCursor`.
3. Mantener filtros aplicados al paginar.

### Criterios de aceptación

1. Los filtros funcionan combinados (fecha + tipo + origen).
2. Paginación estable: no duplica ni omite elementos al cargar más.
3. API no devuelve todo por defecto (usa límite razonable).

## 4) P1-005: Idempotencia en acciones críticas (gasto y liquidación)

### Objetivo (Product Owner)
Como usuario, si la app reintenta una creación por mala conexión, no quiero terminar con gastos o liquidaciones duplicadas.

### Trabajo en el proyecto (Ingeniería)

Backend (API):

1. Agregar campo `idempotencyKey` en el body para:
2. `POST /api/v1/groups/:id/expenses`
3. `POST /api/v1/groups/:id/settlements`
4. Persistir y validar idempotencia (por usuario + endpoint + key):
5. Si llega una request con la misma key, devolver el mismo resultado sin crear un registro nuevo.
6. Si la misma key viene con payload distinto, devolver conflicto (409 recomendado).

Frontend (Web):

1. Generar `idempotencyKey` por intento de creación y reutilizarla en retries.

### Criterios de aceptación

1. Dos requests iguales con la misma `idempotencyKey` crean 1 solo registro.
2. La segunda request devuelve la misma entidad (o respuesta equivalente) sin duplicar.
3. Misma key con payload distinto devuelve 409 (o error claro) y no crea nada.

## 5) P2-003: Exportación CSV de movimientos

### Objetivo (Product Owner)
Como usuario, quiero exportar mi historial filtrado a CSV, para analizarlo fuera de la app.

### Trabajo en el proyecto (Ingeniería)

Backend (API):

1. Crear endpoint de export (ej. `GET /api/v1/transactions/export.csv`) que acepte los mismos filtros.
2. Responder `text/csv` con columnas mínimas: fecha, tipo, monto, origen, descripción, grupo.

Frontend (Web):

1. Botón “Exportar CSV” que descargue el archivo respetando filtros.

### Criterios de aceptación

1. El CSV respeta filtros.
2. El archivo abre correctamente en Excel/Sheets.
3. Incluye columnas mínimas acordadas.

## 6) P2-001: Multi-moneda avanzada (conversión)

### Objetivo (Product Owner)
Como usuario con grupos en distintas monedas, quiero ver un consolidado con tipo de cambio aplicado, para entender mi posición total en una moneda base.

### Trabajo en el proyecto (Ingeniería)

1. Definir alcance (FX manual vs FX automático; moneda base del usuario).
2. Definir modelo (tasas guardadas/snapshot, fecha de aplicación).
3. Ajustar cálculo y UI del resumen para explicitar tipo de cambio.

### Criterios de aceptación

1. El resumen personal explicita moneda base y tipo de cambio usado.
2. El total consolidado es consistente.
3. No rompe flujos P0.
