FROM node:20-alpine AS build
WORKDIR /usr/src/app/apps/web
COPY apps/web/package.json apps/web/tsconfig.json apps/web/vite.config.ts ./ 
COPY apps/web/index.html ./index.html
COPY apps/web/src ./src
RUN npm install && npm run build

FROM nginx:alpine
COPY --from=build /usr/src/app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx","-g","daemon off;"]
