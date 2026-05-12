# EP-01 | Historias pendientes (Gap Analysis)

## HD-01.6 | Visibilidad contextual del FAB por ruta y estado de pantalla

### Parte Product Owner (qué se quiere conseguir y para qué)
- Como usuario móvil, quiero que el FAB aparezca solo cuando realmente puedo crear algo, para evitar distracciones y toques accidentales.
- Quiero que en pantallas de detalle, edición o formularios abiertos el FAB no compita con la tarea actual.
- Esto busca mejorar foco, claridad de navegación y sensación de app nativa.

### Parte Team Leader (qué hay que hacer y criterios)
- Crear una matriz explícita de visibilidad del FAB por ruta y contexto UI (ej. modal abierto, pantalla de detalle, flujo crítico).
- Reemplazar la regla genérica actual por una política centralizada y testeable (`allowedRoutes`, `blockedRoutes`, `blockedStates`).
- Asegurar que al abrir formularios/modales que ya cumplen función de creación, el FAB se oculte automáticamente.
- Criterios técnicos:
  - Comportamiento determinístico por ruta/contexto (sin casos ambiguos).
  - Tests unitarios para la función de visibilidad y smoke de navegación.
  - Sin regressions en accesos rápidos (`Movimiento`, `Gasto grupal`, `Liquidación`).
  - Tiempo de respuesta visual al mostrar/ocultar sin jank perceptible.

---

## HD-01.7 | Cierre del Drawer con gesto + hardening de accesibilidad

### Parte Product Owner (qué se quiere conseguir y para qué)
- Como usuario móvil, quiero poder cerrar el menú lateral con gesto (swipe), para usar la app de forma más natural con una mano.
- Quiero que el drawer se comporte como en apps nativas y no solo con tap fuera o botón.
- Esto reduce fricción y hace la navegación más fluida.

### Parte Team Leader (qué hay que hacer y criterios)
- Implementar cierre del Drawer por gesto horizontal (umbral configurable + cancelación si predomina scroll vertical).
- Mantener cierre por `Esc`, tap fuera y botón de navegación como fallback.
- Validar que el focus trap, el bloqueo de scroll y el retorno de foco no se rompan con el gesto.
- Criterios técnicos:
  - Gesto compatible con iOS/Android viewport.
  - Sin interferencia con scroll vertical del contenido.
  - Animaciones de apertura/cierre fluidas (sin saltos perceptibles).
  - Tests de interacción (unit/integration o E2E) para tap + gesto + teclado.

---

## HD-01.8 | Ajuste de targets táctiles y accesibilidad mínima AA

### Parte Product Owner (qué se quiere conseguir y para qué)
- Como usuario móvil, quiero que todos los controles clave sean fáciles de tocar y accesibles, para evitar errores y fatiga.
- Quiero consistencia en tamaño táctil y foco visible en toda la experiencia móvil.
- Esto mejora usabilidad y reduce fricción diaria.

### Parte Team Leader (qué hay que hacer y criterios)
- Auditar controles interactivos críticos (header, navegación, drawer, modal, toasts, acciones de lista).
- Normalizar tamaño mínimo táctil a 44x44 px en elementos primarios/secundarios.
- Verificar y ajustar contraste/focus-visible en componentes móviles.
- Criterios técnicos:
  - Checklist de accesibilidad mínima completado por componente.
  - Todos los botones críticos cumplen 44x44 px mínimos.
  - Foco visible y navegación por teclado en overlays (Drawer/Modal/Toast action).
  - Evidencia de validación en 2 breakpoints móviles.

---

## HD-01.9 | QA móvil cross-browser (2 breakpoints + 2 navegadores móviles)

### Parte Product Owner (qué se quiere conseguir y para qué)
- Como equipo de producto, queremos validar la UX móvil en más de un navegador para evitar inconsistencias en producción.
- Necesitamos evidencia objetiva de que los flujos clave funcionan en móviles reales/simulados.
- Esto reduce riesgos de release en EP-01.

### Parte Team Leader (qué hay que hacer y criterios)
- Extender la estrategia E2E para cubrir al menos:
  - 2 breakpoints móviles representativos.
  - 2 navegadores móviles (ej. Chrome Android + Safari iOS/WebKit).
- Ejecutar casos críticos: navegación Drawer/BottomNav, FAB, swipe editar/eliminar, modal edición, toasts.
- Criterios técnicos:
  - Suite E2E estable sin flaky crítico.
  - Reporte de ejecución por navegador y viewport.
  - Bugs detectados con severidad y estado.
  - Criterio de salida: flujos críticos en verde en ambos navegadores móviles.

---

## HD-01.10 | Robustez del motor de Toasts + smoke tests de feedback crítico

### Parte Product Owner (qué se quiere conseguir y para qué)
- Como usuario, quiero que los mensajes de feedback sean confiables y consistentes, sin comportamientos raros de duración o desaparición.
- Quiero que errores y éxitos siempre se comuniquen de forma clara durante acciones de negocio.
- Esto mejora confianza y continuidad de uso.

### Parte Team Leader (qué hay que hacer y criterios)
- Fortalecer la gestión de timers (pause/resume en hover/touch hold) para evitar inconsistencias en la cuenta regresiva.
- Agregar smoke tests de flujos críticos que disparan toasts (crear, editar, eliminar, errores API).
- Validar límite de simultáneos, cola y cierre manual bajo carga de eventos.
- Criterios técnicos:
  - Lógica de timers determinística y testeada.
  - Cobertura de casos borde (toasts en ráfaga, interacción rápida, acciones con CTA).
  - Sin regresión visual en estilos y severidades.
  - Copy alineado a lineamientos definidos.

---

## HD-01.11 | Alineación y mantenimiento de documentación de patrones móviles

**Estado**: Completado
**Fecha**: 2026-05-12

### Parte Product Owner (qué se quiere conseguir y para qué)
- Como equipo, queremos documentación confiable y actualizada para que diseño, QA y dev trabajen con la misma verdad.
- Queremos evitar desalineaciones entre lo que se documenta y lo que realmente hace la app.
- Esto acelera onboarding, reduce retrabajo y errores de validación.

### Parte Team Leader (qué hay que hacer y criterios)
- Revisar y corregir documentación de patrones móviles para que refleje implementación real (umbrales, reglas de gesto, fallback desktop, criterios QA).
- Añadir sección de "fuente de verdad" y fecha de última validación.
- Vincular cada patrón a componentes/rutas concretas.
- Criterios técnicos:
  - Documentación sin contradicciones con código actual.
  - Checklist de QA mobile incorporado y usable por testing.
  - Cambios documentales revisados por FE + QA.
  - Trazabilidad clara entre historia, implementación y evidencia de pruebas.

### Evidencia de cumplimiento
- `docs/mobile-ui-patterns.md` actualizado con:
  - Umbrales corregidos (`SWIPE_THRESHOLD_RATIO` 0.25, `VERTICAL_LOCK_THRESHOLD` 10px, eliminación de `VELOCITY_THRESHOLD` inexistente).
  - Sección "Fuente de verdad y última validación" con referencias a componentes, estilos, rutas y pruebas.
  - 3 patrones documentados: Swipeable Row, Drawer Swipe Close, FAB Contextual.
  - Checklists QA accionables con precondición + acción + resultado esperado.
  - Matriz de trazabilidad Historia → Componente → Ruta → Prueba → Evidencia.
  - Registro de revisión FE/QA.
