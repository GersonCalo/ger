# EP-07 | Refactor de arquitectura frontend

**Prioridad**: P1
**Estado**: Propuesta
**Descripcion**: Mejorar la estructura del frontend para que sea mas mantenible y escale bien al añadir nuevas funcionalidades.

---

## HU-07.1 | Separar `useFinanceApp` en hooks modulares  DONE ✅

### Como Product Owner

**Que se quiere conseguir:**

Actualmente toda la lógica de estado de la app vive en un único hook de ~1000 líneas que mezcla autenticación, transacciones, grupos, categorías, balance, tema, push notifications y auto-refresh. Esto hace que:

- Cualquier cambio en un dominio puede romper otro sin querer
- Es difícil entender qué hace cada parte del código
- Añadir nuevas funcionalidades (presupuestos, recurrentes) será cada vez más doloroso
- Los componentes reciben props que no necesitan porque el hook expone todo junto

El objetivo es que cada dominio tenga su propio hook independiente, con su estado, sus acciones y sus efectos aislados. Así cuando un desarrollador trabaje en presupuestos no tenga que tocar el hook de grupos, y viceversa.

### Como Team Leader

**Cambios técnicos a realizar:**

1. **Crear `src/hooks/useAuth.ts`** — extraer de `useFinanceApp`:
   - Estado: `token`, `user`, `booting`, `authBusy`, `authError`, `health`
   - Acciones: `login`, `register`, `logout`, `loadSession`, `onAuthSuccess`
   - Efectos: check de health al montar, theme listener, push subscription al login
   - Exportar: `{ isAuthenticated, user, token, booting, authBusy, authError, health, login, register, logout }`

2. **Crear `src/hooks/useTransactions.ts`** — extraer:
   - Estado: `transactions`, `dataBusy`, `transactionError`, `transactionFilters`, `txNextCursor`, `txHasMore`, `txLoadingMore`, `balanceSummary`
   - Acciones: `createTransaction`, `updateTransaction`, `deleteTransaction`, `refreshTransactions`, `applyTransactionFilters`, `loadMoreTransactions`, `exportTransactionsCsv`, `refreshBalance`
   - Exportar: `{ transactions, dataBusy, transactionError, balanceSummary, filters, hasMore, loadingMore, createTransaction, updateTransaction, deleteTransaction, refreshTransactions, applyFilters, loadMore, exportCsv, dashboardSummary }`

3. **Crear `src/hooks/useGroups.ts`** — extraer:
   - Estado: `groups`, `selectedGroupId`, `selectedGroupData`, `selectedGroupJoinCode`, `groupsBusy`, `groupsError`
   - Acciones: `createGroup`, `addGroupExpense`, `updateGroupExpense`, `addGroupMember`, `deleteGroupMember`, `joinGroupByCode`, `createSettlement`, `confirmSettlement`, `refreshGroups`, `refreshSelectedGroup`
   - Exportar: `{ groups, selectedGroupId, selectedGroupData, selectedGroupJoinCode, groupsBusy, groupsError, setSelectedGroupId, createGroup, addGroupExpense, updateGroupExpense, addGroupMember, deleteGroupMember, joinGroupByCode, createSettlement, confirmSettlement }`

4. **Crear `src/hooks/useCategories.ts`** — extraer:
   - Estado: `categories`, `categoriesBusy`
   - Acciones: `createCategory`, `updateCategory`, `deleteCategory`, `createGroupCategory`, `updateGroupCategory`, `deleteGroupCategory`, `refreshCategories`
   - Exportar: `{ categories, categoriesBusy, createCategory, updateCategory, deleteCategory, createGroupCategory, updateGroupCategory, deleteGroupCategory, refreshCategories }`

5. **Crear `src/hooks/useAutoRefresh.ts`** — extraer la lógica de polling:
   - Recibir `token`, `activeTab`, `booting`, y las funciones refresh como params
   - Gestionar interval, visibilitychange, focus listeners
   - Exportar: nada visual, solo efectos secundarios

6. **Crear `src/hooks/useNavigation.ts`** — extraer:
   - Estado: `activeTab`
   - Acciones: `setActiveTab` (con sync a hash)
   - Efectos: hashchange listener
   - Exportar: `{ activeTab, setActiveTab }`

7. **Reescribir `useFinanceApp.ts`** como orquestador thin que compose los hooks:
   ```ts
   export const useFinanceApp = () => {
     const auth = useAuth();
     const transactions = useTransactions({ token: auth.token });
     const groups = useGroups({ token: auth.token, user: auth.user });
     const categories = useCategories({ token: auth.token });
     const navigation = useNavigation();
     useAutoRefresh({ token: auth.token, activeTab: navigation.activeTab, ... });

     return { ...auth, ...transactions, ...groups, ...categories, ...navigation };
   };
   ```

8. **Eliminar todos los `// @ts-ignore`** del hook actual — hay al menos 8 usos de `@ts-ignore` que indican que los tipos no están bien definidos.

**Criterios de aceptación:**

- [ ] `useFinanceApp.ts` tiene menos de 80 líneas (solo composición de hooks)
- [ ] Cada hook nuevo tiene su propio archivo en `src/hooks/`
- [ ] Ningún `@ts-ignore` queda en los hooks
- [ ] `App.tsx` y todos los screens funcionan exactamente igual que antes (sin cambios visibles para el usuario)
- [ ] Los screens reciben las mismas props que antes (la API pública de `useFinanceApp` no cambia)
- [ ] El hook `useCategories` maneja correctamente la respuesta de la API `{ categories: [...] }` sin necesidad de `@ts-ignore`
- [ ] Los efectos de auto-refresh solo se activan cuando `token` existe y la tab es `home` o `groups`
- [ ] El logout limpia correctamente el estado de todos los hooks hijos

---

## HU-07.2 | Sistema de routing con React Router DONE ✅

### Como Product Owner

**Que se quiere conseguir:**

Ahora mismo la navegación se hace con hash (`#home`, `#transactions`, `#groups`, `#profile`) gestionado a mano con `window.location.hash`. Esto funciona pero tiene problemas:

- No se pueden tener URLs con parámetros (ej: `/groups/abc123/expenses/xyz789`)
- No se puede navegar con `useNavigate()` ni usar `Link` components
- Cuando añadamos nuevas pantallas (presupuestos, recurrentes) el sistema de hash se va a quedar corto
- No se puede hacer navegación programática compleja (redirects, guards de auth, etc.)

El objetivo es migrar a React Router v6 para tener un sistema de routing profesional que permita URLs limpias, parámetros, nesting, y protección de rutas.

### Como Team Leader

**Cambios técnicos a realizar:**

1. **Instalar dependencia:**
   ```
   npm install react-router-dom@6
   ```

2. **Crear `src/routes/AppRoutes.tsx`:**
   ```tsx
   <Routes>
     <Route element={<ProtectedRoute />}>
       <Route path="/" element={<DashboardLayout />}>
         <Route index element={<DashboardScreen />} />
         <Route path="transactions" element={<TransactionsScreen />} />
         <Route path="groups" element={<GroupsScreen />} />
         <Route path="groups/:groupId" element={<GroupDetailScreen />} />
         <Route path="profile" element={<ProfileScreen />} />
       </Route>
     </Route>
     <Route path="/auth" element={<AuthScreen />} />
   </Routes>
   ```

3. **Crear `src/routes/ProtectedRoute.tsx`:**
   - Verificar `isAuthenticated` del hook de auth
   - Si no autenticado → redirect a `/auth`
   - Si autenticado → renderizar `Outlet`

4. **Crear `src/routes/DashboardLayout.tsx`:**
   - Envolver con `AppShell`
   - La bottom nav usa `useNavigate()` + `useLocation()` en lugar de hash

5. **Modificar `App.tsx`:**
   - Eliminar toda la lógica de tabs condicionales
   - Reemplazar con `<BrowserRouter>` + `<AppRoutes />`
   - El boot screen y auth screen se manejan dentro del routing

6. **Actualizar `BottomNav.tsx`:**
   - Reemplazar `onChange(tab)` por `navigate(`/${tab}`)`
   - Detectar tab activa con `useLocation().pathname`

7. **Migrar `useNavigation` para usar `useNavigate` + `useLocation`** en lugar de hash manual.

**Criterios de aceptación:**

- [ ] `react-router-dom@6` instalado y configurado en `main.tsx` con `<BrowserRouter>`
- [ ] Las rutas `/`, `/transactions`, `/groups`, `/profile` funcionan correctamente
- [ ] La bottom nav refleja la ruta actual y navega correctamente
- [ ] Si el usuario no está autenticado y va a `/` → redirect a `/auth`
- [ ] Si el usuario está autenticado y va a `/auth` → redirect a `/`
- [ ] El boot/loading screen se muestra mientras se carga la sesión antes de renderizar rutas
- [ ] La URL en la barra del navegador refleja la sección activa
- [ ] El botón "atrás" del navegador funciona correctamente entre secciones
- [ ] No hay referencias a `window.location.hash` en el código
- [ ] El header de `AppShell` muestra el título correcto según la ruta activa

---

## HU-07.3 | Componentes UI reutilizables (Modal, Drawer, Toast, FAB) 

### Como Product Owner

**Que se quiere conseguir:**

Ahora mismo cada screen implementa sus propios formularios inline, usa `alert()` para errores, y no hay componentes reutilizables de UI. Cuando añadamos presupuestos, recurrentes y nuevas pantallas, vamos a necesitar:

- Modales para crear/editar cosas sin salir de la pantalla actual
- Un sistema de notificaciones (toasts) para feedback de acciones
- Un botón flotante (FAB) para acciones rápidas
- Un drawer lateral para navegación cuando crezca el menú

El objetivo es crear una librería interna de componentes base en `src/components/ui/` que sean consistentes, accesibles y reutilizables en toda la app. Así cada nueva pantalla se construye con piezas ya probadas.

### Como Team Leader

**Cambios técnicos a realizar:**

1. **Crear `src/components/ui/Toast.tsx` + `src/hooks/useToast.ts`:**
   - Context provider `<ToastProvider>` que envuelve la app
   - Hook `useToast()` con método `toast({ message, type: 'success' | 'error' | 'info', duration?: number })`
   - Componente visual: contenedor fixed en bottom-center, animación slide-up, auto-dismiss
   - Soporte para múltiples toasts en cola (stack)
   - Reemplazar todos los `alert()` en screens por `toast()`

2. **Crear `src/components/ui/Modal.tsx`:**
   - Overlay con backdrop oscuro semi-transparente
   - Panel centrado con animación fade+scale
   - Props: `isOpen`, `onClose`, `title`, `children`, `size?: 'sm' | 'md' | 'lg'`
   - Cerrar con Escape, click en backdrop, o botón X
   - Focus trap dentro del modal
   - Prevenir scroll del body cuando está abierto

3. **Crear `src/components/ui/Drawer.tsx`:**
   - Panel que se desliza desde la derecha (o izquierda para nav drawer)
   - Props: `isOpen`, `onClose`, `side?: 'left' | 'right' | 'bottom'`, `children`
   - Backdrop clicable para cerrar
   - Para nav drawer: lista de items con icono + label

4. **Crear `src/components/ui/FAB.tsx`:**
   - Botón circular fixed en bottom-right (por encima de la bottom nav)
   - Props: `icon`, `onClick`, `label?`
   - Variante expandible: al hacer click muestra menú de acciones
   - Animación de apertura con spring

5. **Crear `src/components/ui/EmptyState.tsx` (refactor del existente):**
   - El componente actual está bien, moverlo a `ui/` y añadir props opcionales: `icon`, `actionLabel`, `onAction`

6. **Añadir CSS en `app.css`** para cada componente con las variables del design system existente.

7. **Reemplazar usos actuales:**
   - `alert()` en `TransactionsScreen.tsx` → `toast()`
   - `alert()` en `GroupsScreen.tsx` → `toast()`
   - Formulario inline de nueva transacción → preparar para abrir en Modal (no migrar aún, solo dejar preparado)

**Criterios de aceptación:**

- [ ] Carpeta `src/components/ui/` existe con: `Toast.tsx`, `Modal.tsx`, `Drawer.tsx`, `FAB.tsx`
- [ ] `ToastProvider` envuelve la app en `App.tsx` o `main.tsx`
- [ ] Todos los `alert()` de `TransactionsScreen` y `GroupsScreen` reemplazados por `toast()`
- [ ] El toast muestra mensajes de éxito con color verde y errores con color rojo
- [ ] El modal se abre/cierra correctamente, cierra con Escape y click en backdrop
- [ ] El drawer se desliza suavemente y cierra con backdrop
- [ ] El FAB se posiciona correctamente sobre la bottom nav sin tapar contenido
- [ ] Los componentes son accesibles: roles ARIA, focus management, keyboard navigation
- [ ] Los componentes funcionan en modo claro y oscuro
- [ ] No hay regressions visuales en las pantallas existentes

---

## HU-07.4 | Tests unitarios de funciones críticas DONE ✅

### Como Product Owner

**Que se quiere conseguir:**

Las funciones de cálculo de balances de grupo, repartos de gastos, y balances personales son el corazón contable de la app. Si un cambio introduce un error en estos cálculos, los usuarios verán saldos incorrectos, repartos mal hechos, y liquidaciones erróneas.

Ahora mismo no hay ningún test. Un desarrollador puede cambiar una función de reparto sin saber que está rompiendo el cierre de céntimos o el cálculo de netos.

El objetivo es tener tests automatizados que verifiquen que los cálculos core son correctos, para que cualquier refactor o cambio futuro pueda validarse ejecutando los tests en segundos.

### Como Team Leader

**Cambios técnicos a realizar:**

1. **Instalar Vitest:**
   ```
   npm install -D vitest
   ```
   - Configurar `vitest.config.ts` en `apps/web/`
   - Añadir script `"test": "vitest"` y `"test:run": "vitest run"` en `package.json`

2. **Testear `apps/web/src/lib/groups.ts`** — crear `groups.test.ts`:
   - `summarizeTransactions()`:
     - Grupo sin gastos → `{ total: 0, count: 0 }`
     - Grupo con 3 gastos → total suma correcta, count = 3
   - Funciones de cálculo de balances (las que exporta el módulo):
     - Test con 2 miembros, 1 gasto equitativo → cada uno debe la mitad
     - Test con 3 miembros, 1 gasto manual con montos distintos → netos correctos
     - Test con liquidaciones confirmadas → reducen el neto correctamente
     - Test con liquidaciones cancelled → no afectan al balance
     - Test de cierre de céntimos: reparto de 10.00 entre 3 → no perder céntimos

3. **Testear `apps/api/src/lib/groupBalances.ts`** — crear `groupBalances.test.ts` en el API:
   - `calculateGroupBalances()`:
     - Escenario básico: 2 miembros, 1 gasto de 100€ pagado por A → A: +50, B: -50
     - Escenario con 3 miembros y reparto equitativo de 99.99€ → cierre correcto a 2 decimales
     - Escenario con múltiples gastos y una liquidación → netos finales correctos
     - Escenario con `splitMethod: 'manual'` → respeta los montos exactos
   - `calculateSettlementSuggestions()`:
     - Sugiere el pago mínimo para saldar deudas
     - No sugiere pagos entre miembros que ya están al día

4. **Testear `apps/api/src/lib/userBalance.ts`** — crear `userBalance.test.ts`:
   - `calculateUserBalance()`:
     - Usuario sin transacciones → todos los valores a 0
     - Usuario con 1 ingreso de 1000 y 1 gasto de 300 → personalBalance = 700
     - Usuario con grupo donde le deben 50 → groupNet = 50, totalBalance = 750
     - Transacciones locked no afectan al cálculo manual

5. **Estructura de tests:**
   ```
   apps/web/src/lib/groups.test.ts
   apps/api/src/lib/groupBalances.test.ts
   apps/api/src/lib/userBalance.test.ts
   ```

**Criterios de aceptación:**

- [ ] `vitest` instalado y configurado en `apps/web`
- [ ] Script `npm run test` funciona en el workspace
- [ ] Al menos 10 tests en `groups.test.ts` cubriendo summarizeTransactions y cálculos de grupo
- [ ] Al menos 8 tests en `groupBalances.test.ts` cubriendo calculateGroupBalances y suggestions
- [ ] Al menos 5 tests en `userBalance.test.ts` cubriendo calculateUserBalance
- [ ] Todos los tests pasan en verde (`vitest run`)
- [ ] Los tests cubren el edge case de reparto de céntimos (10€ entre 3 personas)
- [ ] Los tests cubren liquidaciones confirmed vs cancelled
- [ ] Los tests cubren el caso de grupo vacío y usuario sin transacciones
- [ ] Coverage mínimo del 80% en los archivos `lib/` testeados

---

## Resumen de la epica EP-07

| Historia | Esfuerzo | Dependencias |
|----------|----------|-------------|
| HU-07.1 Separar hooks | Alto | Ninguna |
| HU-07.2 React Router | Medio | HU-07.1 (para usar useNavigation limpio) |
| HU-07.3 Componentes UI | Medio | Ninguna |
| HU-07.4 Tests | Bajo | HU-07.1 (los hooks separados son más testeables) |

**Orden recomendado**: HU-07.1 → HU-07.4 → HU-07.3 → HU-07.2
