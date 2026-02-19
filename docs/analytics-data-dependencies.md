# Dependencias de datos Analytics y configuración frontend

## Tabla `analytics_contract_snapshot`

El endpoint `POST /api/v1/analytics/brokers/summary` (Resumen Brokers) lee de la tabla `analytics_contract_snapshot`. Si la tabla está vacía, la vista Brokers mostrará "No hay datos".

### Cómo poblar la tabla (datos reales)

1. **Desde Configuración (recomendado)**  
   En la vista Configuración del frontend v1, hacer clic en "Actualizar datos desde MySQL". Esto ejecuta `query_analytics.sql` contra el MySQL legacy y carga los resultados en `analytics_contract_snapshot`. Requiere `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` en `.env`.

   **Docker:** Si la API corre en Docker y MySQL está en el host, usa `MYSQL_HOST=host.docker.internal` (Windows/Mac) o la IP del host. Con `localhost` el contenedor intentaría conectar a sí mismo y fallaría.

2. **Supervisores habilitados**  
   Los datos deben coincidir con los supervisores habilitados en Supervisores Brokers (`brokers_supervisor_scope`).

**Nota:** El script `seed_brokers_analytics.py` inserta datos de prueba (inventados). No usarlo en producción.

### Campos relevantes

- `sale_month`: formato MM/YYYY (ej. 01/2026)
- `supervisor`, `un`, `via`: usados para filtros y agrupación
- `tramo`, `close_month`: para cálculo de mora 3M

---

## Variable `VITE_API_BASE_URL`

El frontend (build de producción) usa `VITE_API_BASE_URL` en tiempo de compilación para apuntar a la API. Si no se define, se usa `http://localhost:8000/api/v1`.

### Para frontend-prod (Docker)

En `docker-compose.yml`, el build de `frontend-prod` recibe:

```yaml
args:
  VITE_API_BASE_URL: ${VITE_API_BASE_URL:-http://localhost:8000/api/v1}
```

- **Local**: Si la API está en `localhost:8000`, el valor por defecto es correcto. El usuario abre `http://localhost:8080` y el navegador hace fetch a `http://localhost:8000/api/v1`.
- **Producción**: Definir en `.env` la URL que el navegador pueda alcanzar (ej. `https://api.example.com/api/v1`). No usar rutas relativas `/api/v1` salvo que el frontend esté servido detrás del mismo proxy que la API.

### Evitar

- URLs relativas incorrectas que hagan que el fetch vaya al puerto del frontend (ej. 8080) en vez del puerto de la API (8000).
- Sobrescribir `.env` con una URL vacía o que no sea accesible desde el navegador.
