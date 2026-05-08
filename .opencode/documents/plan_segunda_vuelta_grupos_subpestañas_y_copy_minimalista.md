# Plan: segunda vuelta de grupos con subpestañas y copy minimalista

## Resumen

- Objetivo: refinar la pestaña de grupos para que el detalle sea más limpio, más rápido de leer y menos verboso.
- Cambios pedidos:
  - convertir el detalle de grupo en una experiencia con subpestañas,
  - reducir de forma agresiva el texto explicativo innecesario,
  - añadir una pestaña de ajustes donde se concentren acciones como añadir miembros y copiar el código del grupo.
- Decisiones confirmadas:
  - la estructura base del detalle será **Resumen / Gastos / Pagos**,
  - además existirá una pestaña de **Ajustes** para acciones del grupo,
  - el tono de copy será **muy minimalista**.

## Estado actual

### Arquitectura relevante

- La app sigue siendo una SPA sin router interno por secciones; `GroupsScreen` cuelga de la pestaña principal `groups` en [App.tsx:L64-L117](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/App.tsx#L64-L117).
- El shell global ya aporta header principal y navegación inferior, por lo que las subpestañas deben vivir dentro del contenido del detalle y no como navegación global nueva en [AppShell.tsx:L14-L33](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/components/AppShell.tsx#L14-L33).

### Estado actual de GroupsScreen

- `GroupsScreen` ya tiene una separación de alto nivel entre `list` y `detail`, gestionada por estado local `view` en [GroupsScreen.tsx:L80-L94](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/GroupsScreen.tsx#L80-L94).
- La vista de listado ya funciona como primer nivel, por lo que esta iteración debe centrarse sobre todo en la rama `view === 'detail'` en [GroupsScreen.tsx:L366-L883](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/GroupsScreen.tsx#L366-L883).
- El detalle actual sigue estando apilado en una sola columna larga con estas secciones:
  - acciones secundarias,
  - hero del grupo,
  - acceso y participantes,
  - añadir/editar gasto,
  - balances,
  - sugerencias,
  - liquidaciones,
  - gastos recientes,
  en [GroupsScreen.tsx:L377-L872](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/GroupsScreen.tsx#L377-L872).
- Esto confirma que la densidad actual no es ya un problema de layout global, sino del detalle del grupo.

### Datos disponibles para subpestañas

- `selectedGroupData` ya expone todo lo necesario para separar la UI sin tocar APIs:
  - `members`,
  - `balances`,
  - `expenses`,
  - `suggestions`,
  - `settlements`,
  en [GroupsScreen.tsx:L96-L139](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/GroupsScreen.tsx#L96-L139).
- La lógica de operaciones ya existe y puede redistribuirse visualmente:
  - añadir miembro,
  - crear gasto,
  - editar gasto,
  - crear liquidación,
  - copiar código,
  en [GroupsScreen.tsx:L214-L223](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/GroupsScreen.tsx#L214-L223) y [GroupsScreen.tsx:L456-L872](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/GroupsScreen.tsx#L456-L872).

### Patrones UI ya existentes

- El proyecto ya tiene un patrón reutilizable para navegación interna con `segmented-control` en [app.css:L350-L370](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/styles/app.css#L350-L370).
- También existe un patrón de chips si durante ejecución se necesitara una variante más compacta en [app.css:L479-L500](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/styles/app.css#L479-L500).
- `SectionCard` permite usar título sin subtítulo, así que la reducción fuerte de copy no exige cambios de componente base en [SectionCard.tsx:L10-L18](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/components/SectionCard.tsx#L10-L18).

### Copy actual sobrante

- La cabecera general de la pestaña y la intro local repiten contexto en la lista de grupos en [App.tsx:L18-L21](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/App.tsx#L18-L21) y [GroupsScreen.tsx:L234-L249](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/GroupsScreen.tsx#L234-L249).
- Dentro del detalle hay varios subtítulos largos que explican demasiado:
  - [GroupsScreen.tsx:L456-L462](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/GroupsScreen.tsx#L456-L462)
  - [GroupsScreen.tsx:L519-L521](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/GroupsScreen.tsx#L519-L521)
  - [GroupsScreen.tsx:L676-L676](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/GroupsScreen.tsx#L676-L676)
  - [GroupsScreen.tsx:L695-L695](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/GroupsScreen.tsx#L695-L695)
  - [GroupsScreen.tsx:L746-L746](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/GroupsScreen.tsx#L746-L746)
- Los estados vacíos también pueden simplificarse porque el contexto ya lo aporta la pestaña activa:
  - [GroupsScreen.tsx:L323-L329](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/GroupsScreen.tsx#L323-L329)
  - [GroupsScreen.tsx:L695-L698](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/GroupsScreen.tsx#L695-L698)
  - [GroupsScreen.tsx:L810-L818](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/GroupsScreen.tsx#L810-L818)
  - [GroupsScreen.tsx:L842-L845](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/GroupsScreen.tsx#L842-L845)

## Objetivo funcional detallado

- La lista de grupos debe ocupar menos espacio vertical y evitar duplicar contexto que ya aporta el header global.
- El detalle de grupo debe abrir mostrando una navegación interna clara por subpestañas.
- Las subpestañas del detalle deben quedar así:
  - **Resumen**: visión compacta del grupo y balances principales.
  - **Gastos**: alta/edición de gastos e historial de gastos.
  - **Pagos**: sugerencias de liquidación, formulario de pago e historial de liquidaciones.
  - **Ajustes**: miembros, añadir miembro, código del grupo y acciones auxiliares del grupo.
- El copy debe pasar a un modo muy minimalista:
  - menos subtítulos largos,
  - menos bloques introductorios,
  - más etiquetas cortas y títulos funcionales.

## Supuestos y decisiones

- No se tocará la arquitectura de datos ni el API; esta iteración es exclusivamente de organización UI y copy.
- No se añadirán nuevas rutas ni tabs globales; las subpestañas serán estado local dentro de `GroupsScreen`.
- La pestaña **Ajustes** absorberá acciones que hoy compiten con el detalle principal:
  - añadir miembros,
  - copiar código,
  - mostrar miembros del grupo,
  - mantener, si conviene, acciones secundarias relacionadas con el grupo.
- La vista de lista reducirá la intro local y mantendrá solo el mínimo texto necesario para orientar.
- El header global de la pestaña `groups` puede recortarse para no repetir el mismo mensaje que ya aparece dentro del contenido.

## Cambios propuestos

### 1) Reducir el copy global y local de la pestaña de grupos

**Archivos**

- [App.tsx](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/App.tsx)
- [GroupsScreen.tsx](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/GroupsScreen.tsx)

**Qué**

- Recortar los textos del header de la pestaña `groups`.
- Simplificar o eliminar la intro excesiva en la lista de grupos.

**Por qué**

- Ahora el usuario ve demasiado texto repetido antes de llegar a la información útil.

**Cómo**

- Dejar un subtítulo de pestaña mucho más corto en `App.tsx`.
- En la lista de grupos, sustituir el bloque introductorio por una cabecera más compacta o incluso integrarlo dentro de la card principal del listado.
- Mantener solo microcopy funcional donde aporte contexto real.

### 2) Añadir estado local de subpestaña dentro del detalle

**Archivos**

- [GroupsScreen.tsx](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/GroupsScreen.tsx)
- [types.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/types.ts) solo si hiciera falta extraer un tipo local reutilizable

**Qué**

- Añadir un estado interno para la navegación del detalle, por ejemplo:
  - `summary`,
  - `expenses`,
  - `payments`,
  - `settings`.

**Por qué**

- Hoy el detalle es lineal y obliga a recorrer demasiadas secciones.

**Cómo**

- Mantener `view: 'list' | 'detail'`.
- Añadir un segundo nivel de estado solo cuando `view === 'detail'`.
- Reiniciar la subpestaña al cambiar de grupo o al volver al listado, para evitar estados confusos.

### 3) Construir una barra de subpestañas clara y compacta

**Archivos**

- [GroupsScreen.tsx](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/GroupsScreen.tsx)
- [app.css](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/styles/app.css)

**Qué**

- Insertar una navegación interna visible justo debajo del encabezado del detalle del grupo.

**Por qué**

- El usuario debe poder saltar directamente a gastos, pagos o ajustes sin recorrer toda la pantalla.

**Cómo**

- Reutilizar `segmented-control` o derivar una variante compacta específica para subtabs.
- Mantener la barra con labels cortos: `Resumen`, `Gastos`, `Pagos`, `Ajustes`.
- Asegurar que en móvil siga siendo legible y no empuje demasiado el contenido hacia abajo.

### 4) Reorganizar el contenido actual del detalle en 4 áreas

**Archivos**

- [GroupsScreen.tsx](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/GroupsScreen.tsx)

**Qué**

- Redistribuir la UI actual según la nueva navegación interna.

**Por qué**

- Ya existe la funcionalidad, pero no la jerarquía correcta.

**Cómo**

- **Resumen**
  - mantener hero/título del grupo,
  - mantener stats principales,
  - incluir balances resumidos o la sección de balances completa si encaja mejor ahí.
- **Gastos**
  - mover aquí el formulario de añadir/editar gasto,
  - mover aquí el listado de gastos recientes,
  - mantener el reparto manual y la edición sin cambios funcionales.
- **Pagos**
  - mover aquí sugerencias de liquidación,
  - mover aquí el formulario de registrar pago,
  - mover aquí el historial de liquidaciones.
- **Ajustes**
  - mover aquí código del grupo,
  - mover aquí miembros del grupo,
  - mover aquí añadir miembro,
  - dejar aquí acciones auxiliares del grupo que hoy aparecen como “acciones secundarias”.

### 5) Reducir subtítulos y estados vacíos en modo muy minimalista

**Archivos**

- [GroupsScreen.tsx](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/screens/GroupsScreen.tsx)
- [SectionCard.tsx](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/components/SectionCard.tsx) solo si durante ejecución se quisiera ajustar el espaciado cuando no hay subtítulo
- [app.css](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/styles/app.css) si el nuevo layout necesita menos separación visual con menos copy

**Qué**

- Eliminar o reducir de forma fuerte la copy redundante.

**Por qué**

- El propio usuario percibe que el texto actual ocupa sitio valioso y no aporta tanto.

**Cómo**

- Dejar títulos cortos en `SectionCard`.
- Reservar subtítulos solo para:
  - restricciones reales,
  - estados especiales,
  - formularios donde sí aclaren una acción delicada.
- Acortar los `EmptyState` a una línea clara cuando el contexto ya lo da la pestaña.

### 6) Afinar el espaciado para que el detalle gane densidad útil sin sentirse apretado

**Archivos**

- [app.css](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/web/src/styles/app.css)

**Qué**

- Ajustar espaciados verticales y jerarquía visual una vez desaparezca parte del copy.

**Por qué**

- Si se quita texto pero se mantienen todos los márgenes actuales, el resultado puede seguir sintiéndose disperso.

**Cómo**

- Reducir margen/alto visual en:
  - intro local,
  - headers de cards,
  - toolbar del detalle,
  - separación entre bloques.
- Revisar especialmente cómo quedan:
  - la lista de grupos,
  - la cabecera del detalle,
  - la barra de subpestañas.

## Riesgos y puntos a vigilar

- Si se mueve demasiado contenido a “Ajustes”, puede quedar sobrecargada; conviene que solo agrupe acciones auxiliares y no información de uso diario.
- Si “Resumen” mantiene demasiadas cards, puede seguir pareciendo una pantalla larga; habrá que elegir bien qué se queda ahí y qué se mueve.
- Un recorte muy agresivo de copy puede hacer perder contexto en estados vacíos o restricciones de permisos, especialmente con el código de grupo para admins.
- La barra de subpestañas no debe competir visualmente con la navegación inferior ni con el toolbar del detalle.

## Verificación

### Técnica

- Revisar diagnósticos TypeScript/JSX tras reorganizar `GroupsScreen`.
- Compilar `apps/web`.

### UX / funcional

- **Lista de grupos**
  - comprobar que la parte superior usa menos espacio y menos texto,
  - comprobar que el listado sigue siendo lo primero visible.
- **Detalle con subpestañas**
  - comprobar que se puede alternar entre `Resumen`, `Gastos`, `Pagos` y `Ajustes`,
  - comprobar que cada subpestaña muestra solo el bloque relevante.
- **Gastos**
  - comprobar que alta, edición y reparto manual siguen funcionando igual.
- **Pagos**
  - comprobar que sugerencias, registro de pago e historial siguen accesibles.
- **Ajustes**
  - comprobar que añadir miembro y copiar código quedan centralizados aquí,
  - comprobar que el código sigue respetando la restricción de admin.
- **Copy**
  - comprobar que no queda texto redundante en headers, intros y cards.

### Criterios de aceptación

- El detalle de un grupo queda organizado con subpestañas.
- Existen al menos `Resumen`, `Gastos`, `Pagos` y `Ajustes`.
- El copy de la pestaña de grupos se reduce de forma visible y deja de ocupar espacio innecesario.
- Añadir miembros y copiar el código del grupo pasan a una zona de ajustes más lógica.
- La lista de grupos sigue siendo la primera vista al entrar en la pestaña.
