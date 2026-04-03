# Plataforma de Finanzas Personales y Gastos Compartidos

Aplicación web que combina gestión de finanzas personales con administración de gastos compartidos en grupos. Incluye soporte para participantes reales (usuarios) y participantes “invitados/falsos” en grupos, con reparto equitativo o por pesos.

## Características
- Finanzas personales: ingresos, gastos y saldo consolidado.
- Grupos: miembros reales o invitados, gastos, reparto y balances.
- Repartos: equitativo o por porcentajes/pesos.
- Arquitectura contenedorizada con Docker para despliegue en cualquier proveedor.

## Tecnologías
- Frontend: React + Vite + TypeScript.
- Backend: Node.js + Express + TypeScript.
- Base de datos: PostgreSQL.
- ORM: Prisma.
- Orquestación: Docker Compose.

## Estructura del repositorio
- apps/
  - api/ (Express + TS)
  - web/ (React + Vite + TS)
- packages/
  - db/ (Prisma schema)
- docker-compose.yml (desarrollo)
- docker-compose.prod.yml (producción)

## Inicio rápido (Docker)
1. Requisitos: Docker y Docker Compose.
2. Construir imágenes:
   ```bash
   docker compose build
   ```
3. Levantar entorno de desarrollo:
   ```bash
   docker compose up -d
   ```
4. Comprobar:
   - API: http://localhost:8080/health
   - Web (dev): http://localhost:3000

Para producción local:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```
Luego accede a http://localhost.

## Documentación
- Arquitectura: docs/arquitectura.md
- Instalación (local/dev): docs/instalacion.md
- Despliegue (prod): docs/despliegue.md
- API (endpoints): docs/api.md

## Enlaces de código
- API: [src/index.ts](file:///c:/Users/gerson.calo/Documents/trae_projects/ger/apps/api/src/index.ts)
- Schema Prisma: [schema.prisma](file:///c:/Users/gerson.calo/Documents/trae_projects/ger/packages/db/schema.prisma)
- Compose (dev): [docker-compose.yml](file:///c:/Users/gerson.calo/Documents/trae_projects/ger/docker-compose.yml)
- Compose (prod): [docker-compose.prod.yml](file:///c:/Users/gerson.calo/Documents/trae_projects/ger/docker-compose.prod.yml)

