# EP-01 | Mejora de experiencia móvil base

**Prioridad**: P0
**Estado**: Propuesta
**Descripción**: Optimizar la UX actual para que la app se sienta nativa en móvil, reemplazar patrones web por patrones móviles y eliminar fricciones de uso diario.

---

## HD-01.1 | FAB de acciones rápidas 

### Parte Product Owner (qué se quiere hacer)
- Como usuario móvil, quiero un botón flotante persistente para crear acciones frecuentes sin cambiar de pantalla ni hacer scroll largo.
- El FAB debe abrir un menú con: `Movimiento`, `Gasto grupal`, `Liquidación`.
- Debe estar visible en pantallas principales donde tenga sentido de creación.

### Criterios de Aceptación PO
- Desde cualquier pantalla principal definida, el usuario puede abrir el menú FAB en 1 toque.
- Cada opción del menú lleva al flujo correcto con contexto preservado.
- El FAB no tapa contenido crítico ni bloquea navegación.

### Parte Team Leader (qué hay que hacer)
- Implementar componente `FAB` reutilizable con menú expandible (speed dial).
- Integrar con router/estado global para navegación contextual.
- Definir visibilidad por ruta (permitidas/prohibidas) para evitar ruido en pantallas de detalle o formularios abiertos.
- Agregar animación suave de apertura/cierre (CSS o librería ya aceptada por proyecto).

### Criterios Técnicos TL
- Tiempo de respuesta del botón < 100ms percibidos.
- Área táctil mínima 44x44 px por opción.
- Accesibilidad: `aria-label`, foco por teclado, contraste AA.
- Comportamiento consistente en iOS/Android viewport.

---

## HD-01.2 | Drawer lateral + simplificación de bottom nav 

### Parte Product Owner (qué se quiere hacer)
- Como usuario, quiero acceder a todas las secciones desde un menú hamburguesa para no saturar la barra inferior.
- Secciones en drawer: `Inicio`, `Movimientos`, `Grupos`, `Presupuestos`, `Recurrentes`, `Perfil`.
- Bottom nav queda en 3 ítems: `Inicio`, `Movs`, `Grupos`.

### Criterios de Aceptación PO
- El usuario puede llegar a cualquier sección en máximo 2 interacciones.
- La navegación inferior se mantiene limpia y comprensible.
- Se mantiene feedback visual de sección activa.

### Parte Team Leader (qué hay que hacer)
- Crear layout de navegación móvil con `TopBar + menú hamburguesa + Drawer`.
- Refactor de `BottomNav` a 3 tabs, sincronizada con ruta activa.
- Centralizar configuración de navegación en una sola fuente (array/config) para evitar duplicación.
- Agregar transición de apertura/cierre del drawer y cierre por gesto/tap fuera.

### Criterios Técnicos TL
- Estado de navegación no se rompe al volver/adelante del navegador.
- Drawer accesible: trap de foco, cierre con `Esc`, bloqueo de scroll de fondo.
- No regressions de rutas existentes (deep links válidos).
- Rendimiento: sin jank perceptible al abrir/cerrar drawer.

---

## HD-01.3 | Sistema de toasts/snackbars (reemplazo de `alert()`) 

### Parte Product Owner (qué se quiere hacer)
- Como usuario, quiero mensajes no intrusivos para éxito/error en lugar de alertas del navegador que cortan el flujo.
- Los mensajes deben ser claros, breves y con tipo visual (`success`, `error`, `info`).

### Criterios de Aceptación PO
- Ninguna acción de negocio usa `alert()` nativo.
- Los errores y éxitos relevantes muestran toast consistente.
- El usuario puede descartar manualmente mensajes cuando aplique.

### Parte Team Leader (qué hay que hacer)
- Implementar `ToastProvider` con contexto React y hook (`useToast`).
- Definir API estándar: `showToast({ type, message, duration, action? })`.
- Migrar llamados actuales de `alert()` y puntos de feedback críticos.
- Establecer lineamientos de copy (máx. longitud, tono y severidad).

### Criterios Técnicos TL
- Cola de toasts con límite de visibles simultáneos.
- Auto-dismiss configurable y pausa en hover/touch hold si aplica.
- Test unitarios del provider + smoke test de flujos críticos.
- Estilo consistente con design tokens del proyecto.

---

## HD-01.4 | Edición de transacciones en modal/drawer 

### Parte Product Owner (qué se quiere hacer)
- Como usuario, quiero editar una transacción en modal/drawer para no romper la lectura de la lista con formularios inline.
- El flujo debe sentirse enfocado y reversible.

### Criterios de Aceptación PO
- Al tocar "editar", se abre modal/drawer con datos precargados.
- Guardar actualiza la lista y cierra el modal con feedback visual.
- Cancelar no altera datos ni posición de scroll de la lista.

### Parte Team Leader (qué hay que hacer)
- Reemplazar expansión inline por componente de edición desacoplado (`TransactionEditSheet` / `Modal`).
- Cargar estado inicial desde item seleccionado y manejar dirty state.
- Implementar confirmación al cerrar si hay cambios sin guardar.
- Sincronizar cierre/guardado con refresco optimista o invalidación de cache.

### Criterios Técnicos TL
- Persistencia de scroll en lista al cerrar modal.
- Validaciones de formulario reutilizadas con creación/edición.
- Manejo robusto de errores API (toast + rollback si optimista).
- Accesibilidad de modal: foco inicial, retorno de foco al elemento invocador.

---

## HD-01.5 | Swipe en transacciones para acciones rápidas

### Parte Product Owner (qué se quiere hacer)
- Como usuario, quiero deslizar una transacción para revelar `Editar` / `Eliminar` y actuar más rápido, como en apps nativas.
- Debe ser intuitivo y evitar acciones accidentales.

### Criterios de Aceptación PO
- Swipe revela acciones sin navegar a otra pantalla.
- Acción de eliminar requiere confirmación.
- Interacción funciona de forma fluida en móviles táctiles.

### Parte Team Leader (qué hay que hacer)
- Implementar celda swipeable en lista de transacciones con umbral configurable.
- Soportar una sola fila abierta a la vez.
- Integrar acciones con flujos existentes (editar abre modal/drawer, eliminar confirma y ejecuta).
- Definir fallback desktop (botones visibles o menú contextual) para no romper web.

### Criterios Técnicos TL
- Gestos no interfieren con scroll vertical.
- Animaciones a 60fps percibidos en dispositivos objetivo.
- Confirmación de eliminación obligatoria + manejo de error con recuperación visual.
- Pruebas E2E básicas de gesto y acciones principales.

---

## Criterios transversales de la épica (Definition of Done EP-01)

- No quedan `alert()` nativos en flujos de negocio móviles.
- Navegación móvil consistente: Drawer + BottomNav simplificada.
- Transiciones suaves y coherentes entre pantallas/componentes.
- Accesibilidad mínima garantizada (foco, labels, contraste, táctil).
- QA móvil en al menos 2 breakpoints y 2 navegadores móviles.
- Documentación breve de patrones UI móviles en el repositorio.
