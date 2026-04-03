# Despliegue (Producción)

## Estrategia
- Se utiliza Docker para empaquetar API y Web.
- Postgres puede ser gestionado (RDS/Cloud SQL) o contenedor con volumen persistente.
- Para entornos simples, usar docker-compose.prod.yml con variables seguras.

## Variables requeridas (producción)
- DATABASE_URL: cadena de conexión a Postgres accesible desde el contenedor API.
- JWT_SECRET: secreto robusto para firmar tokens.
- Opcionales:
  - PORT (API), VITE_API_URL (Web; en prod se sirve estático y puede usar “/api” detrás de un reverse proxy).

## Despliegue en un VPS (ejemplo)
1. Copia el repositorio al servidor.
2. Define variables de entorno (por ejemplo con un archivo .env exportado en shell o un gestor de secrets).
3. Ejecuta:
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
   ```
4. Expone puertos:
   - Web: 80
   - API: 8080 (o proxied como /api tras Nginx/Traefik)

## TLS y reverse proxy
- Coloca Nginx o Traefik delante para TLS y dominios:
  - Web estática en 80/443
  - Proxy “/api” a http://api:8080
- Certificados: Let’s Encrypt (Traefik) o Certbot (Nginx).

## Postgres gestionado
- Recomendada una base gestionada (RDS, DigitalOcean, Railway) para backups/fiabilidad.
- Ajusta DATABASE_URL con el host gestionado y restringe IPs entrantes.

## Observabilidad
- Logs a stdout para integración con ELK, CloudWatch, etc.
- Recomendado añadir métricas y alertas de error (Sentry/Prometheus en fases siguientes).

## Notas
- Compose v2 ignora la clave “version:”; puedes eliminarla de docker-compose.yml para suprimir warnings.
- No guardes secretos en el repositorio; inyecta variables en el entorno del servidor.

