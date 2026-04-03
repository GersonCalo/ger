# Etapa Base
FROM node:20-alpine AS base
WORKDIR /usr/src/app

# Etapa de dependencias
FROM base AS deps
# Copiamos primero solo los package.json para aprovechar la caché de Docker
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
# Usar npm ci
RUN npm ci

# Etapa de construcción
FROM base AS build
# Copiamos los node_modules cacheados
COPY --from=deps /usr/src/app/node_modules ./node_modules
# Copiamos archivos de frontend
COPY package.json package-lock.json ./
COPY apps/web ./apps/web

# Construir aplicación Vite
RUN npm run build --workspace=apps/web

# Etapa de runtime en Nginx (Producción)
FROM nginx:alpine AS runtime
# Remover la configuración por defecto de nginx
RUN rm -rf /usr/share/nginx/html/*

# Copiar archivos compilados
COPY --from=build /usr/src/app/apps/web/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
