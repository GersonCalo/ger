# Etapa de build
FROM node:20-alpine AS build
WORKDIR /usr/src/app
COPY apps/api/package.json apps/api/tsconfig.json ./apps/api/
COPY apps/api/src ./apps/api/src
COPY packages/db/schema.prisma ./packages/db/schema.prisma
RUN cd apps/api && npm install
# Generar Prisma client copiando schema dentro del paquete api
RUN mkdir -p apps/api/prisma
RUN cp packages/db/schema.prisma apps/api/prisma/schema.prisma
RUN cd apps/api && npx prisma generate --schema=./prisma/schema.prisma
RUN cd apps/api && npm run build

# Etapa de runtime
FROM node:20-alpine AS runtime
WORKDIR /usr/src/app
ENV NODE_ENV=production
COPY --from=build /usr/src/app/apps/api/dist ./apps/api/dist
COPY --from=build /usr/src/app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /usr/src/app/apps/api/prisma ./apps/api/prisma
EXPOSE 8080
CMD ["node", "apps/api/dist/index.js"]
