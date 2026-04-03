# Etapa Base
FROM node:20-alpine AS base
WORKDIR /usr/src/app

# Etapa de dependencias
FROM base AS deps
# Copiamos primero solo los package.json para aprovechar la caché de Docker
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
# Ejecutamos npm ci que es más rápido y exacto para CI/CD y Docker
RUN npm ci

# Etapa de construcción
FROM base AS build
# Copiamos los node_modules cacheados
COPY --from=deps /usr/src/app/node_modules ./node_modules
# Copiamos el resto de los archivos necesarios para construir la API
COPY package.json package-lock.json ./
COPY apps/api ./apps/api
COPY packages/db ./packages/db

# Generar cliente de Prisma
RUN cd apps/api && npx prisma generate --schema=../../packages/db/schema.prisma
# Compilar el código TypeScript
RUN npm run build --workspace=apps/api

# Etapa de runtime (Producción)
FROM base AS runtime
ENV NODE_ENV=production

# Seguridad: Crear usuario no-root
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001 -G nodejs
USER nodejs

# Copiamos los archivos construidos y los módulos
COPY --from=build --chown=nodejs:nodejs /usr/src/app/node_modules ./node_modules
COPY --from=build --chown=nodejs:nodejs /usr/src/app/apps/api ./apps/api
COPY --from=build --chown=nodejs:nodejs /usr/src/app/packages/db ./packages/db
COPY --from=build --chown=nodejs:nodejs /usr/src/app/package.json ./

EXPOSE 8080

CMD ["node", "apps/api/dist/index.js"]
