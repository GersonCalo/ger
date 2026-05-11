# Patrones UI Móviles

## Swipeable Row (HD-01.5)

Patrón para revelar acciones rápidas en listas mediante deslizamiento horizontal.

### Implementación
- Componente: `SwipeableTransactionRow`
- Ubicación: `apps/web/src/components/transactions/`
- Gestos: Pointer Events con `touch-action: pan-y`

### Thresholds y Reglas
| Parámetro | Valor | Propósito |
|-----------|-------|-----------|
| `SWIPE_THRESHOLD_RATIO` | 0.35 | Fracción del ancho de acciones para activar apertura |
| `VELOCITY_THRESHOLD` | 0.3 px/ms | Velocidad mínima para swipe rápido |
| `VERTICAL_LOCK_THRESHOLD` | 8px | Bloquea swipe si movimiento vertical predomina |

### Reglas Anti-Accidente
1. **Eje vertical优先**: Si `abs(dy) > abs(dx)` y `abs(dy) > 8px`, se desactiva el swipe y permite scroll normal.
2. **Umbral de activación**: Solo abre si el desplazamiento horizontal supera el 35% del ancho de acciones.
3. **Velocidad**: Un swipe rápido (alta velocidad) con desplazamiento moderado también activa.
4. **Una sola fila abierta**: El estado `openSwipeRowId` en el padre garantiza que solo una fila esté abierta a la vez.

### Fallback Desktop
- Media query: `@media (hover: hover) and (pointer: fine)`
- En desktop: las acciones se muestran siempre visibles en `.list-actions`
- En móvil: las acciones están ocultas detrás del swipe

### Accesibilidad
- `aria-label` en botones de acción ("Editar movimiento", "Eliminar movimiento")
- Confirmación de eliminación obligatoria vía modal
- Foco gestionado por componente `Modal` (trap de foco, retorno al cerrar)

### Checklist de QA Móvil
- [ ] Probado en viewport 375x667 (iPhone SE)
- [ ] Probado en viewport 414x896 (iPhone 11/12)
- [ ] Chrome Mobile (Android)
- [ ] Safari Mobile (iOS)
- [ ] Swipe horizontal revela acciones sin interferir con scroll vertical
- [ ] Solo una fila puede estar abierta a la vez
- [ ] Tap en "Editar" abre modal de edición
- [ ] Tap en "Eliminar" abre modal de confirmación
- [ ] Error en eliminación muestra toast y mantiene lista usable
- [ ] En desktop, botones siempre visibles (sin swipe necesario)
