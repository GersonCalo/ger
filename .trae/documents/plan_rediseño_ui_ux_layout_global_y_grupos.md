# Plan: rediseño UI/UX global con navegación inferior fija y experiencia de grupos separada

## Resumen

- Objetivo: rediseñar la experiencia web completa con una dirección visual **claro editorial**, más minimalista y elegante, mejorando tanto el layout global como la usabilidad de todas las pantallas.
- Problemas a resolver:
  - la navegación inferior no se percibe siempre fija porque hoy está integrada dentro del contenedor principal y puede obligar a hacer scroll para recuperar contexto,
  - el estilo visual actual es más ornamental que minimalista,
  - la pantalla de grupos concentra demasiadas acciones en una sola vista y resulta poco amable.
- Decisiones confirmadas:
  - el rediseño cubre **todo el producto**,
  - la navegación inferior debe ser prioritaria en móvil y resolverse de forma **responsive libre** en pantallas grandes,
  - la experiencia de grupos será **lista y detalle**,
  - crear grupo y unirse por código vivirán en un **menú secundario** dentro de la vista principal de grupos.

## Estado actual

### Arquitectura del frontend

- La app no usa router real; navega por `activeTab` + `window.location.hash` en [useFinanceApp.ts:L15-L73](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/hooks/useFinanceApp.ts#L15-L73).
- El render principal ocurre en [App.tsx:L28-L141](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/App.tsx#L28-L141), que cambia pantalla según `activeTab`.
- El contenedor principal compartido es [AppShell.tsx:L13-L30](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/components/AppShell.tsx#L13-L30).

### Layout y navegación

- La navegación inferior ya existe en [BottomNav.tsx:L8-L62](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/components/BottomNav.tsx#L8-L62), con 4 pestañas: inicio, movimientos, grupos y perfil.
- Visualmente está colocada con `position: absolute` dentro del contenedor `.app-shell__phone` en [app.css:L614-L664](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/styles/app.css#L614-L664), no como una barra verdaderamente anclada al viewport de la app.
- El contenido compensa la barra añadiendo `padding-bottom` artificial en [app.css:L133-L135](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/styles/app.css#L133-L135).
- Los estados de carga y autenticación no reutilizan por completo el shell principal; repiten layout manual en [App.tsx:L31-L81](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/App.tsx#L31-L81).

### Sistema visual actual

- El CSS global está centralizado en [app.css](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/styles/app.css).
- La estética actual usa:
  - fondos con gradiente radial,
  - ambient blobs,
  - glassmorphism,
  - sombras marcadas,
  - tipografía display serif,
  en [app.css:L1-L245](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/styles/app.css#L1-L245).
- Los bloques reutilizables existentes son [SectionCard.tsx:L3-L23](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/components/SectionCard.tsx#L3-L23), [StatCard.tsx:L1-L12](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/components/StatCard.tsx#L1-L12) y [EmptyState.tsx:L1-L19](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/components/EmptyState.tsx#L1-L19).

### Estructura actual de pantallas

- **Auth**: mezcla hero de marketing y formulario en [AuthScreen.tsx:L19-L160](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/AuthScreen.tsx#L19-L160).
- **Dashboard**: combina balance, accesos rápidos, actividad reciente y un spotlight de grupos en [DashboardScreen.tsx:L35-L129](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/DashboardScreen.tsx#L35-L129).
- **Movimientos**: junta formulario de creación y listado en [TransactionsScreen.tsx:L42-L191](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/TransactionsScreen.tsx#L42-L191).
- **Perfil**: muestra cuenta, estado técnico y logout en [ProfileScreen.tsx:L12-L62](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/ProfileScreen.tsx#L12-L62).
- **Grupos**: hoy es una mega-pantalla con onboarding, selector, detalle, miembros, gastos, balances, liquidaciones y formularios todo junto en [GroupsScreen.tsx:L225-L755](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/GroupsScreen.tsx#L225-L755).

### Estado actual de grupos

- La pantalla de grupos ya maneja mucha lógica local:
  - alta/edición de gasto,
  - reparto manual,
  - selección de miembro pagador,
  - liquidaciones,
  - edición de gastos,
  en [GroupsScreen.tsx:L80-L223](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/GroupsScreen.tsx#L80-L223).
- Esto confirma que el problema no es solo visual, sino también de densidad funcional y jerarquía de información.

## Objetivo funcional detallado

- La navegación principal debe permanecer siempre accesible desde la parte inferior en móvil, sin depender del final del scroll.
- El layout debe pasar a una estética clara editorial:
  - más aire,
  - menos ornamento,
  - superficies limpias,
  - tipografía refinada,
  - jerarquía visual más calmada.
- La vista de grupos debe dividirse en dos niveles:
  - **nivel 1**: listado de grupos en los que participa el usuario,
  - **nivel 2**: detalle de un grupo concreto con sus datos y acciones.
- Crear grupo y unirse por código no deben competir con el listado principal; irán dentro de una acción secundaria o menú secundario.

## Supuestos y decisiones

- No se introducirá router completo salvo que durante ejecución resulte claramente necesario; el plan parte de mantener navegación por estado y hash, porque es la arquitectura actual y permite separar vistas sin migración grande.
- La bottom nav se resolverá como pieza estructural fija del shell en móvil; en escritorio se adaptará visualmente para integrarse mejor sin perder acceso inmediato.
- La separación de grupos se implementará dentro de la pestaña `groups`, no como una pestaña adicional nueva.
- El detalle de grupo reutilizará la lógica existente de datos y operaciones, pero redistribuida en componentes o secciones más focalizadas.
- El rediseño del resto de pantallas será consistente con la nueva dirección visual, sin cambiar la lógica de negocio.
- La UX de grupos priorizará primero descubrimiento y navegación, luego gestión avanzada.

## Cambios propuestos

### 1) Rehacer el shell global y la navegación inferior

**Archivos**

- [App.tsx](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/App.tsx)
- [AppShell.tsx](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/components/AppShell.tsx)
- [BottomNav.tsx](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/components/BottomNav.tsx)
- [app.css](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/styles/app.css)

**Qué**

- Convertir la navegación inferior en una pieza estructural fija y siempre accesible en móvil.
- Unificar el layout de boot, auth y app autenticada con una misma gramática visual.

**Por qué**

- Ahora la barra está encapsulada dentro del “teléfono” y la experiencia no transmite persistencia real.
- El shell actual añade demasiado ornamento para el objetivo de minimalismo elegante.

**Cómo**

- Replantear `.app-shell`, `.app-shell__phone`, `.app-content` y `.bottom-nav`.
- Mover la nav a un comportamiento fijo/sticky según breakpoint, con `safe-area` y padding de contenido coherente.
- Reducir los encabezados verbosos y hacerlos más funcionales.
- Hacer que los estados de boot y auth compartan estructura base con el resto de la app.

### 2) Redefinir el lenguaje visual completo en clave “claro editorial”

**Archivos**

- [app.css](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/styles/app.css)
- [SectionCard.tsx](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/components/SectionCard.tsx)
- [StatCard.tsx](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/components/StatCard.tsx)
- [EmptyState.tsx](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/components/EmptyState.tsx)

**Qué**

- Sustituir la estética actual por un sistema más sobrio y limpio.

**Por qué**

- El usuario pide una experiencia minimalista y elegante a nivel de proyecto, no un ajuste puntual.

**Cómo**

- Revisar tokens visuales:
  - paleta,
  - tipografía,
  - radios,
  - sombras,
  - bordes,
  - espacios,
  - pesos visuales.
- Reducir:
  - gradientes decorativos,
  - blur excesivo,
  - sombras profundas,
  - bloques hero demasiado pesados.
- Reforzar:
  - contraste tipográfico,
  - respiración,
  - separación de niveles,
  - consistencia entre listas, cards y formularios.

### 3) Reorganizar la pestaña de grupos en flujo lista → detalle

**Archivos**

- [GroupsScreen.tsx](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/GroupsScreen.tsx)
- [useFinanceApp.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/hooks/useFinanceApp.ts)
- [types.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/types.ts) solo si hace falta nuevo estado tipado

**Qué**

- Dividir la experiencia de grupos en dos vistas dentro de la misma pestaña:
  - lista principal de grupos,
  - detalle del grupo seleccionado.

**Por qué**

- Hoy la pantalla de grupos es el principal cuello de botella de UX.
- El usuario quiere que el primer vistazo muestre solo los grupos y entrar después a ver más datos o añadir gastos.

**Cómo**

- Reestructurar `GroupsScreen` para que el estado principal sea el listado.
- La selección de un grupo abrirá un detalle centrado en ese grupo.
- En la lista:
  - mostrar tarjetas limpias con nombre, miembros y señales útiles,
  - incluir acceso a crear/unirse desde un menú secundario.
- En el detalle:
  - priorizar resumen del grupo,
  - balances,
  - gastos recientes,
  - acciones clave como añadir gasto y gestionar liquidaciones.

### 4) Separar dentro del detalle de grupo la información de las acciones

**Archivos**

- [GroupsScreen.tsx](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/GroupsScreen.tsx)
- Posibles componentes nuevos si al ejecutar conviene extraer:
  - cards de grupo,
  - header de detalle,
  - panel de acciones,
  - listas de gastos/balances.

**Qué**

- Dejar de mostrar todo seguido en una misma columna sin jerarquía.

**Por qué**

- Aunque exista vista detalle, seguirá siendo poco usable si se mantienen todos los bloques juntos al mismo nivel.

**Cómo**

- Estructurar el detalle en bloques más claros, por ejemplo:
  - resumen superior,
  - miembros y código,
  - balances y sugerencias,
  - gastos,
  - formularios y acciones.
- Valorar formularios colapsables o acciones contextuales para reducir ruido visual.
- Mantener la lógica actual de gastos, edición y liquidaciones, pero con prioridad visual mejor resuelta.

### 5) Rediseñar Home, Movimientos, Perfil y Auth para que hablen el mismo idioma visual

**Archivos**

- [AuthScreen.tsx](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/AuthScreen.tsx)
- [DashboardScreen.tsx](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/DashboardScreen.tsx)
- [TransactionsScreen.tsx](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/TransactionsScreen.tsx)
- [ProfileScreen.tsx](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/ProfileScreen.tsx)

**Qué**

- Adaptar todas las pantallas al nuevo sistema visual y a una mejor jerarquía.

**Por qué**

- El usuario ha pedido una mejora global del proyecto, no solo de grupos.

**Cómo**

- **Auth**: eliminar exceso de hero promocional y convertirlo en acceso más refinado y claro.
- **Home**: simplificar dashboard, reforzar lectura de saldo y acciones prioritarias.
- **Movimientos**: clarificar relación entre captura y listado; mantener rapidez pero con más orden.
- **Perfil**: convertirlo en una vista más limpia y menos técnica en primera lectura, dejando el estado técnico como secundario.

### 6) Mantener la arquitectura actual sin mezclar lógica y rediseño innecesariamente

**Archivos**

- [App.tsx](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/App.tsx)
- [useFinanceApp.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/hooks/useFinanceApp.ts)

**Qué**

- Conservar la estructura de datos y refresco actual salvo donde haga falta para soportar la nueva vista lista/detalle de grupos.

**Por qué**

- El problema pedido es de UI/UX y organización, no de negocio o API.

**Cómo**

- Reusar:
  - `activeTab`,
  - `selectedGroupId`,
  - refreshes,
  - operaciones CRUD ya existentes.
- Limitar cambios de estado a lo necesario para navegar mejor entre lista y detalle.

## Riesgos y puntos a vigilar

- El CSS global es grande y centralizado; un rediseño fuerte puede romper estilos compartidos si no se hace con criterio por capas.
- La separación lista/detalle de grupos puede introducir demasiada lógica condicional en un único archivo si no se factoriza lo suficiente.
- La bottom nav fija debe respetar `safe-area` y no tapar formularios o CTA en pantallas pequeñas.
- Un header demasiado reducido puede hacer perder contexto si no se equilibra bien con títulos de pantalla y acciones.
- En desktop, la adaptación “responsive libre” debe evitar una barra inferior torpe o sobredimensionada.

## Verificación

### Técnica

- Revisar diagnósticos TypeScript y JSX tras la reorganización.
- Compilar `apps/web`.
- Verificar que la navegación inferior no tapa contenido interactivo.

### UX / funcional

- **Navegación**
  - comprobar que la barra inferior permanece accesible en móvil durante toda la navegación,
  - comprobar que el comportamiento en desktop es coherente con el nuevo layout.
- **Pantalla de grupos**
  - comprobar que al entrar en la pestaña se ve primero el listado de grupos,
  - comprobar que al seleccionar un grupo se accede al detalle,
  - comprobar que desde detalle siguen funcionando alta de gasto, edición y liquidaciones,
  - comprobar que crear/unirse está accesible pero no invade la vista principal.
- **Consistencia visual**
  - revisar Home, Movimientos, Perfil y Auth con el nuevo sistema visual,
  - comprobar jerarquía tipográfica, espaciado y legibilidad.
- **Responsive**
  - validar móvil pequeño,
  - validar ancho intermedio,
  - validar escritorio.

### Criterios de aceptación

- La navegación inferior queda siempre accesible en móvil sin depender del scroll final.
- La estética general pasa a ser más minimalista, clara y elegante.
- La pestaña de grupos se divide en lista principal y detalle.
- La vista inicial de grupos muestra primero los grupos del usuario, no todas las acciones avanzadas a la vez.
- Crear grupo y unirse por código quedan accesibles desde una acción secundaria.
- El resto de pantallas se alinean visualmente con el nuevo sistema de diseño.
