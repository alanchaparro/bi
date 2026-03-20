# Por qué sigo viendo el front anterior — frontend-prod

## Causa

El servicio **`frontend-prod`** en Docker **no monta el código** como volumen. La app se **mete dentro de la imagen** en el `build`. Por tanto:

- Si **no** has vuelto a construir la imagen después de los cambios de HeroUI, el contenedor sigue usando una **imagen vieja** (con el front anterior).
- El “problema” es el **build**: hay que **reconstruir la imagen** y luego **recrear el contenedor** con esa imagen nueva.

## Qué hacer (en la raíz del repo)

```bash
# 1. Reconstruir la imagen (incluye npm ci + next build con tu código actual)
docker compose build --no-cache frontend-prod

# 2. Recrear y levantar el contenedor con la nueva imagen
docker compose up -d frontend-prod
```

Después abre **http://localhost:8080** (o el puerto de `FRONTEND_PROD_PORT`). Deberías ver el front con HeroUI (header, sidebar, login con Card, etc.).

## Si usas solo el front en local (sin Docker)

Si en realidad estás viendo la app con `npm run dev` en el frontend (puerto 3000), ese proceso **sí** usa el código actual del disco. En ese caso no es un tema de build/contenedor: asegúrate de estar en la carpeta `frontend`, con los últimos cambios guardados, y de recargar el navegador (o hacer un hard refresh: Ctrl+Shift+R).

## Resumen

| Dónde ves la app | “Sigo viendo el front anterior” |
|------------------|----------------------------------|
| **http://localhost:8080** (contenedor) | Reconstruir imagen y recrear contenedor: `docker compose build --no-cache frontend-prod` y `docker compose up -d frontend-prod`. |
| **http://localhost:3000** (npm run dev) | Código en disco; refrescar o reiniciar `npm run dev`. |
