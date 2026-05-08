# Plan: Implementación de Categorías (Globales, Personales y de Grupo)

## Resumen
El objetivo es implementar un sistema de categorías estructurado para ingresos y gastos. Esto permitirá en el futuro realizar análisis y gráficos precisos.
El sistema soportará:
1. **Categorías Globales**: Predefinidas y disponibles para todos.
2. **Categorías Personales**: Creadas por cada usuario para su uso personal.
3. **Categorías de Grupo**: Creadas dentro de un grupo y compartidas por todos sus miembros para los gastos compartidos.

Se utilizará una única tabla `Category` en la base de datos para manejar los tres tipos de categorías mediante la combinación de los campos `userId` y `groupId`.

## Análisis del Estado Actual
- **Base de Datos (`schema.prisma`)**:
  - `PersonalTransaction` tiene un campo `category String?` (texto libre).
  - `GroupExpense` tiene `description String?` pero carece de un campo de categoría formal.
  - No existe un modelo `Category`.
- **Backend (`apps/api`)**:
  - `personalLedgerSync.ts` infiere la categoría de un gasto de grupo usando `buildExpenseCategory(description)` que devuelve la descripción o "Gasto compartido".
- **Frontend (`apps/web`)**:
  - `TransactionsScreen.tsx` permite escribir la categoría como texto libre (`<input type="text" ... />`).
  - `GroupsScreen.tsx` no tiene selector de categoría al añadir un gasto.

## Cambios Propuestos

### 1. Base de Datos (Prisma)
- **Modificar `packages/db/schema.prisma`**:
  - Añadir el modelo `Category`:
    - `id String @id @default(uuid())`
    - `name String`
    - `type String` (income, expense)
    - `color String?` (opcional, para futuros gráficos)
    - `icon String?` (opcional)
    - `userId String?` (relación con `User`)
    - `groupId String?` (relación con `Group`)
    - Constraints: `@@unique([name, userId, groupId])` (para evitar duplicados exactos en el mismo ámbito).
  - Actualizar `PersonalTransaction`:
    - Cambiar `category String?` a `categoryId String?` (relación con `Category`).
    - *Migración*: Como estamos en fase temprana, podemos permitir data-loss o mapear el string existente a IDs.
  - Actualizar `GroupExpense`:
    - Añadir `categoryId String?` (relación con `Category`).

### 2. Backend API (`apps/api`)
- **Crear `src/routes/categories.ts`**:
  - `GET /categories` (Devuelve globales + personales del usuario).
  - `POST /categories` (Crea categoría personal).
  - `GET /groups/:id/categories` (Devuelve globales + categorías del grupo).
  - `POST /groups/:id/categories` (Crea categoría de grupo, requiere ser admin/miembro).
- **Modificar `src/routes/transactions.ts`**:
  - Validar `categoryId` en el body al crear transacciones manuales.
  - Incluir la relación `category { id, name, color, icon }` al devolver transacciones.
- **Modificar `src/routes/groups.ts`**:
  - Validar `categoryId` al crear/editar `GroupExpense`.
  - Incluir la relación `category` al devolver gastos de grupo.
- **Modificar `src/lib/personalLedgerSync.ts`**:
  - Al sincronizar un gasto de grupo, copiar su `categoryId` a la `PersonalTransaction` generada, en lugar de usar el string `description`.

### 3. Frontend Web (`apps/web`)
- **Tipos (`src/types.ts`)**:
  - Añadir interfaz `Category`.
  - Actualizar `Transaction` y `GroupExpense` para incluir `category: Category | null`.
- **API Client (`src/lib/api.ts` y `useFinanceApp.ts`)**:
  - Añadir llamadas para obtener y crear categorías (globales/personales/grupo).
- **Pantalla de Transacciones (`TransactionsScreen.tsx`)**:
  - Cambiar el input de texto libre de categoría por un componente de selección (Select o modal) que muestre la lista combinada (Globales + Personales).
  - Botón/opción para "Añadir nueva categoría".
- **Pantalla de Grupos (`GroupsScreen.tsx`)**:
  - Añadir el selector de categoría en el formulario de "Añadir/Editar gasto".
  - Las opciones del selector deben ser (Globales + Categorías del grupo).
  - Mostrar la categoría en la lista de historial de gastos del grupo.

## Decisiones y Asunciones
- **Tabla Unificada**: Se asume el uso de una tabla `Category` con `userId` y `groupId` opcionales.
  - Global: `userId` = null, `groupId` = null.
  - Personal: `userId` = <id>, `groupId` = null.
  - Grupo: `userId` = null, `groupId` = <id>.
- **Migración de Datos**: Dado que actualmente `PersonalTransaction.category` es un string libre, el cambio a `categoryId` relacional requerirá limpiar la base de datos local (data-loss) o ejecutar un script de migración complejo. Asumimos `db push --accept-data-loss` localmente para simplificar, ya que es un entorno de desarrollo.

## Pasos de Verificación
1. Crear una transacción personal y asignarle una nueva categoría creada al vuelo.
2. Comprobar que en la lista de transacciones aparece la categoría correctamente.
3. Crear un gasto de grupo y asignarle una nueva categoría de grupo.
4. Comprobar que el gasto de grupo se refleja en el balance y que la transacción personal sincronizada tiene la misma categoría.
5. Comprobar que otro usuario en el mismo grupo ve y puede usar la categoría del grupo, pero no ve la categoría personal del creador.