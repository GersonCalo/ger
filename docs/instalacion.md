# Instalación (Desarrollo Local)

## Requisitos
- Docker y Docker Compose
- Opcional: Node.js 20+ si deseas ejecutar servicios fuera de Docker

## Variables de entorno
- API:
  - PORT: puerto de escucha (por defecto 8080)
  - DATABASE_URL: cadena de conexión a Postgres (compose la inyecta)
  - JWT_SECRET: secreto para firmar JWT (compose define uno para dev)
- DB:
  - POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD

## Pasos
1. Construye las imágenes:
   ```bash
   docker compose build
   ```
2. Levanta el entorno:
   ```bash
   docker compose up -d
   ```
3. Verifica:
   - API: http://localhost:8080/health
   - Web (dev): http://localhost:3000

## Operaciones con Prisma
- Generar cliente (en contenedor de build ya se genera):  
  ```bash
  docker compose run --rm api npx prisma generate --schema /usr/src/app/apps/api/prisma/schema.prisma
  ```
- Sincronizar esquema con DB (el servicio migrate ya lo hace al levantar):
  ```bash
  docker compose run --rm migrate
  ```

## Desarrollo de frontend sin Docker (opcional)
1. Instala dependencias en apps/web:
   ```bash
   cd apps/web && npm install
   ```
2. Arranca Vite:
   ```bash
   npm run dev
   ```
3. Asegúrate de apuntar a la API (VITE_API_URL) si usas variables de entorno.

