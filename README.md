# Plataforma de Finanzas Personales y Gastos Compartidos

Aplicación web que combina finanzas personales y gastos compartidos en grupos. Permite registrar movimientos propios, repartir gastos con usuarios reales o invitados y mantener una lectura clara entre dinero disponible, balance en grupos y total recuperable.

## Características
- Finanzas personales: ingresos, gastos, disponible, balance en grupos y total.
- Grupos: miembros reales o invitados, gastos, balances, liquidaciones persistidas y acceso por código.
- Integración contable: los gastos y liquidaciones de grupo impactan también en el disponible personal.
- Historial unificado: la pestaña Movimientos mezcla registros manuales con entradas automáticas originadas en grupos.
- Moneda por defecto: EUR para nuevos usuarios y grupos.
- Arquitectura contenedorizada con Docker Compose.

## Tecnologías
- Frontend: React + Vite + TypeScript.
- Backend: Node.js + Express + TypeScript.
- Base de datos: PostgreSQL.
- ORM: Prisma.
- Orquestación: Docker Compose.

## Estructura
- `apps/api`: API Express + TypeScript.
- `apps/web`: cliente React + Vite + TypeScript.
- `packages/db`: schema de Prisma compartido.
- `docker-compose.yml`: entorno de desarrollo.
- `docker-compose.prod.yml`: overlay de producción local.

## Inicio rápido con Docker
1. Requisitos: Docker Desktop con Compose habilitado.
2. Levantar el entorno reconstruyendo imágenes:

```bash
docker compose up -d --build
```

3. Comprobar servicios:
   - API: http://localhost:8080/health
   - Web: http://localhost:3000

## Desarrollo con Docker Compose Watch

Para evitar reconstruir el contenedor cada vez que modificas el frontend, puedes usar el modo watch de Docker Compose. Este sincroniza los archivos de `apps/web/` con el contenedor en tiempo real, y Vite recarga la página automáticamente.

### Iniciar en modo watch

```bash
docker compose watch
```

Esto es equivalente a `up` pero con sincronización activa. Funciona en primer plano (muestra logs) — puedes pulsar `Ctrl+C` para parar.

### Comportamiento

| Qué cambias | Qué pasa |
|---|---|
| Archivos `.tsx`, `.css`, `.ts` en `apps/web/` | Sync inmediato, Vite recarga solo |
| `package.json` en `apps/web/` | Reconstruye el contenedor automáticamente |
| Schema de Prisma | Requiere `docker compose up -d --build` para reconstruir API |

### Parar el modo watch

```bash
# Con Ctrl+C en la terminal, o en otra ventana:
docker compose down
```

### Modo clásico (sin watch)

Si prefieres el flujo tradicional:

```bash
docker compose up -d --build   # Levantar
docker compose down            # Parar
```

## Desarrollo con npm (sin Docker)

Puedes correr los servicios por separado para desarrollo local rápido:

```bash
# 1. Solo base de datos con Docker
docker compose up -d db migrate

# 2. API en modo watch (se reinicia al cambiar archivos)
npm run dev:api

# 3. Frontend Vite con HMR
npm run dev:web
```

Esto te da recarga en caliente tanto para el backend como para el frontend sin necesidad de reconstruir contenedores.

## Nota importante sobre Prisma
- El servicio `migrate` ejecuta `prisma db push` al arrancar.
- Si cambias [schema.prisma](file:///c:/Users/gerson/Documents/trae_projects/ger/packages/db/schema.prisma), usa `docker compose up -d --build` para que la imagen de la API incluya el schema y el cliente Prisma actualizados.
- En este proyecto de desarrollo el `db push` se ejecuta con `--accept-data-loss`, porque añadir constraints nuevas puede bloquear el arranque aunque la base sea correcta.
- Si quieres inspeccionar un fallo de arranque, usa:

```bash
docker compose logs migrate --tail=200
```

## Lectura contable actual
- **Disponible**: dinero real con el que cuentas ahora.
- **Balance en grupos**: lo que te deben o debes dentro de grupos.
- **Total**: disponible más el saldo positivo pendiente de cobrar en grupos.

## Producción local

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Luego accede a http://localhost.

## Documentación
- Arquitectura: `docs/arquitectura.md`
- Instalación: `docs/instalacion.md`
- Despliegue: `docs/despliegue.md`
- API: `docs/api.md`

## Enlaces de código
- API: [index.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/index.ts)
- Router API: [index.ts](file:///c:/Users/gerson/Documents/trae_projects/ger/apps/api/src/routes/index.ts)
- Schema Prisma: [schema.prisma](file:///c:/Users/gerson/Documents/trae_projects/ger/packages/db/schema.prisma)
- Compose dev: [docker-compose.yml](file:///c:/Users/gerson/Documents/trae_projects/ger/docker-compose.yml)
- Compose prod: [docker-compose.prod.yml](file:///c:/Users/gerson/Documents/trae_projects/ger/docker-compose.prod.yml)
