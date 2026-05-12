# Patrones UI Móviles

## Objetivo y alcance
Documentación de referencia para diseño, QA y desarrollo sobre los patrones de interacción móvil de la app. Cualquier discrepancia entre este documento y la implementación debe reportarse como bug de documentación.

## Fuente de verdad y última validación
| Aspecto | Referencia |
|---|---|
| Componentes | `apps/web/src/components/transactions/SwipeableTransactionRow.tsx`, `apps/web/src/components/ui/Drawer.tsx`, `apps/web/src/components/ui/FAB.tsx`, `apps/web/src/components/ui/Modal.tsx` |
| Estilos | `apps/web/src/styles/app.css` |
| Rutas | `apps/web/src/routes/AppRoutes.tsx`, `apps/web/src/routes/DashboardLayout.tsx` |
| Lógica de visibilidad FAB | `apps/web/src/lib/fabVisibility.ts` |
| Navegación | `apps/web/src/lib/navigation.tsx` |
| Pruebas unitarias | `apps/web/src/components/transactions/SwipeableTransactionRow.test.tsx`, `apps/web/src/components/ui/Drawer.test.tsx` |
| Pruebas E2E | `e2e/swipe-transactions.spec.ts`, `e2e/mobile-critical-flows.spec.ts`, `e2e/drawer-swipe.spec.ts`, `e2e/touch-targets-accessibility.spec.ts` |
| Docs QA | `docs/HD-01.8-checklist-accesibilidad.md`, `docs/HD-01.9-qa-mobile-cross-browser.md` |
| Última validación | 2026-05-12 |

---

## Patrón 1: Swipeable Row (HD-01.5)

Patrón para revelar acciones rápidas en listas mediante deslizamiento horizontal.

### Implementación
- Componente: `SwipeableTransactionRow`
- Ubicación: `apps/web/src/components/transactions/`
- Gestos: Pointer Events con `touch-action: pan-y`

### Thresholds y Reglas
| Parámetro | Valor | Propósito |
|-----------|-------|-----------|
| `SWIPE_THRESHOLD_RATIO` | 0.25 | Fracción del ancho de acciones para activar apertura |
| `VERTICAL_LOCK_THRESHOLD` | 10px | Bloquea swipe si movimiento vertical predomina |

### Reglas Anti-Accidente
1. **Puntero grueso (coarse)**: El gesto solo se activa en `pointer: coarse`. En desktop (`pointer: fine`) el swipe no se activa.
2. **Eje vertical**: Si `abs(dy) > VERTICAL_LOCK_THRESHOLD` y `abs(dy) > abs(dx)`, se desactiva el swipe y permite scroll normal.
3. **Umbral de activación**: Solo abre si el desplazamiento horizontal supera el 25% del ancho de acciones (`actionsWidth * SWIPE_THRESHOLD_RATIO`).
4. **Una sola fila abierta**: El estado `openSwipeRowId` en el padre garantiza que solo una fila esté abierta a la vez.

### Fallback Desktop
- **Gating por puntero**: `matchMedia('(pointer: coarse)')` desactiva el gesto en puntero fino (`apps/web/src/components/transactions/SwipeableTransactionRow.tsx:37`).
- **Media query**: `@media (hover: hover) and (pointer: fine)` oculta `.swipeable-row__actions` y desactiva transform/transition del contenido (`apps/web/src/styles/app.css:2277`).
- **Acciones visibles**: En desktop, los botones Editar/Eliminar se muestran siempre en `.list-actions` dentro de cada fila (`apps/web/src/screens/TransactionsScreen.tsx:526`).

### Accesibilidad
- `aria-label` en botones de acción ("Editar movimiento", "Eliminar movimiento")
- Confirmación de eliminación obligatoria vía modal
- Foco gestionado por componente `Modal` (trap de foco, retorno al cerrar)

### Checklist de QA Móvil
| # | Precondición | Acción | Resultado esperado |
|---|---|---|---|
| Q1 | App abierta en viewport 375x667 con ≥1 transacción | Swipe horizontal lento en una fila | Se revelan botones Editar/Eliminar |
| Q2 | Fila con acciones visibles | Tap en "Editar" | Se abre modal de edición con datos precargados |
| Q3 | Fila con acciones visibles | Tap en "Eliminar" | Se abre modal de confirmación "Eliminar movimiento" |
| Q4 | Dos filas abiertas secuencialmente | Swipe en fila A, luego swipe en fila B | Solo fila B queda abierta |
| Q5 | Swipe vertical sobre fila | Deslizar verticalmente | Scroll normal, sin apertura de acciones |
| Q6 | Viewport desktop 1280x800 | Navegar a /transactions | Botones Editar/Eliminar visibles sin swipe |
| Q7 | Modal de confirmación abierto | Tap en "Cancelar" | Modal cierra, fila permanece en lista |
| Q8 | Modal de confirmación abierto | Tap en "Eliminar" | Toast éxito/error, fila removida o error visible |
| Q9 | Error en eliminación (mock API 500) | Intentar eliminar | Toast error visible, lista usable |

**Viewports mínimos**: 375x667 (iPhone SE), 414x896 (iPhone 11/12), 360x740 (Galaxy S9+).
**Navegadores**: Chrome Mobile (Android), Safari Mobile (iOS).

---

## Patrón 2: Drawer Swipe Close (HD-01.7)

Cierre del drawer de navegación mediante gesto horizontal de arrastre.

### Implementación
- Componente: `Drawer` (`apps/web/src/components/ui/Drawer.tsx`)
- Uso: `AppShell` (`apps/web/src/components/AppShell.tsx:75`)
- Gestos: Pointer Events, activado solo en `pointer: coarse`

### Thresholds y Reglas
| Parámetro | Valor | Propósito |
|-----------|-------|-----------|
| `DEFAULT_SWIPE_CLOSE_THRESHOLD` | 72px | Desplazamiento mínimo para cerrar |
| `DEFAULT_VERTICAL_LOCK_THRESHOLD` | 12px | Bloquea gesto si scroll vertical predomina |

### Reglas de Gesto
1. **Puntero grueso (coarse)**: El gesto solo se activa en `pointer: coarse`. En desktop no aplica.
2. **Dirección**: Solo arrastre en dirección opuesta al lado del drawer cierra (drawer `left` → arrastre izquierda).
3. **Umbral de cierre**: Si `abs(dragOffset) > closeThreshold`, se cierra; si no, vuelve a posición original.
4. **Lock vertical**: Si `abs(dy) > 12px` y `abs(dy) > abs(dx)`, se cancela el gesto.

### Mecanismos de Cierre (todos válidos)
| Mecanismo | Implementación |
|---|---|
| Swipe gesture | `Drawer.tsx:148-164` (`commitSwipe`) |
| Tecla Escape | `Drawer.tsx:108-113` (`handleKeyDown`) |
| Tap en backdrop | `Drawer.tsx:99-106` (`handleBackdropClick`) |
| Click en item de navegación | `Drawer.tsx:263-266` (`onItemClick`) |

### Accesibilidad
- `role="dialog"` + `aria-modal="true"` en panel.
- `aria-labelledby` apunta al título del drawer.
- Focus trap con Tab/Shift+Tab (`Drawer.tsx:115-134`).
- Retorno de foco al elemento previo al cerrar (`Drawer.tsx:85-87`).
- Bloqueo de scroll de fondo al abrir (`document.body.style.overflow = 'hidden'`).

### Checklist de QA Móvil
| # | Precondición | Acción | Resultado esperado |
|---|---|---|---|
| D1 | App abierta en viewport móvil | Tap en botón menú (hamburguesa) | Drawer visible con navegación |
| D2 | Drawer abierto | Swipe horizontal hacia la izquierda | Drawer se cierra |
| D3 | Drawer abierto | Swipe corto (< 72px) | Drawer vuelve a posición abierta |
| D4 | Drawer abierto | Swipe vertical | Drawer permanece abierto, scroll funciona |
| D5 | Drawer abierto | Tecla Escape | Drawer se cierra |
| D6 | Drawer abierto | Tap fuera del panel (backdrop) | Drawer se cierra |
| D7 | Drawer abierto | Tap en item de navegación | Drawer se cierra, navega a sección |
| D8 | Drawer abierto | Tabulación con teclado | Foco atrapado dentro del drawer |
| D9 | Drawer cerrado tras abrir | Verificar foco | Foco retorna al botón menú |

---

## Patrón 3: FAB Contextual (HD-01.1 / HD-01.6)

Botón flotante de acciones rápidas con visibilidad condicional por ruta y estado UI.

### Implementación
- Componente: `FAB` (`apps/web/src/components/ui/FAB.tsx`)
- Política de visibilidad: `apps/web/src/lib/fabVisibility.ts`
- Integración: `apps/web/src/routes/DashboardLayout.tsx:64-117`

### Matriz de Visibilidad por Ruta
| Ruta | Visible | Razón |
|---|---|---|
| `/` | Sí | Ruta permitida |
| `/transactions` | Sí | Ruta permitida |
| `/groups` | Sí | Ruta permitida |
| `/groups/:groupId` | No | Ruta bloqueada (detalle) |
| `/budgets` | No | Ruta bloqueada |
| `/recurring` | No | Ruta bloqueada |
| `/profile` | No | Ruta bloqueada |
| `/auth` | No | Ruta bloqueada |
| Cualquier otra | No | Fallback seguro |

### Bloqueos por Estado UI (precedencia sobre ruta)
| Estado | Efecto |
|---|---|
| `isQuickGroupExpenseModalOpen` | Oculta FAB |
| `isTransactionCreateOpen` | Oculta FAB |
| `isTransactionEditOpen` | Oculta FAB |
| `isTransactionDeleteConfirmOpen` | Oculta FAB |
| `isGroupFormOpen` | Oculta FAB |
| `isGroupExpenseEditing` | Oculta FAB |

### Acciones del FAB
| ID | Label | Acción |
|---|---|---|
| `new-transaction` | Movimiento | Navega a `/transactions` con modal crear |
| `new-group-expense` | Gasto grupal | Abre `QuickGroupExpenseModal` |
| `new-settlement` | Liquidación | Navega a pagos del grupo seleccionado |

### Checklist de QA Móvil
| # | Precondición | Acción | Resultado esperado |
|---|---|---|---|
| F1 | Ruta `/` | Verificar FAB | FAB visible |
| F2 | Ruta `/transactions` | Verificar FAB | FAB visible |
| F3 | Ruta `/profile` | Verificar FAB | FAB oculto |
| F4 | Ruta `/groups/:id` | Verificar FAB | FAB oculto |
| F5 | FAB visible | Tap en FAB | Speed dial abre con 3 acciones |
| F6 | Speed dial abierto | Tap fuera del FAB | Speed dial se cierra |
| F7 | Speed dial abierto | Tecla Escape | Speed dial se cierra, foco retorna al FAB |
| F8 | Modal crear transacción abierto | Verificar FAB | FAB oculto |
| F9 | Modal edición transacción abierto | Verificar FAB | FAB oculto |

---

## Matriz de Trazabilidad

| Historia | Patrón | Componente(s) | Ruta(s) | Prueba Unitaria | Prueba E2E | Evidencia QA |
|---|---|---|---|---|---|---|
| HD-01.5 | Swipeable Row | `SwipeableTransactionRow.tsx` | `/transactions` | `SwipeableTransactionRow.test.tsx` | `swipe-transactions.spec.ts`, `mobile-critical-flows.spec.ts` | `HD-01.9-qa-mobile-cross-browser.md` |
| HD-01.7 | Drawer Swipe Close | `Drawer.tsx`, `AppShell.tsx` | Todas | `Drawer.test.tsx` | `drawer-swipe.spec.ts`, `mobile-critical-flows.spec.ts` | `HD-01.8-checklist-accesibilidad.md`, `HD-01.9-qa-mobile-cross-browser.md` |
| HD-01.1 / HD-01.6 | FAB Contextual | `FAB.tsx`, `DashboardLayout.tsx`, `fabVisibility.ts` | `/`, `/transactions`, `/groups`, `/profile`, `/groups/:id` | `fabVisibility.test.ts` | `mobile-critical-flows.spec.ts` | `HD-01.8-checklist-accesibilidad.md`, `HD-01.9-qa-mobile-cross-browser.md` |
| HD-01.8 | Accesibilidad mínima | `Modal.tsx`, `Drawer.tsx`, `app.css` | Todas | `Drawer.test.tsx`, `Toast.test.tsx` | `touch-targets-accessibility.spec.ts` | `HD-01.8-checklist-accesibilidad.md` |

---

## Registro de Revisión FE/QA

| Fecha | Revisor (FE) | Revisor (QA) | Cambios | Estado |
|---|---|---|---|---|
| 2026-05-12 | — | — | Creación inicial con corrección de umbrales, adición de Drawer + FAB, checklist QA accionable, trazabilidad | Pendiente |
