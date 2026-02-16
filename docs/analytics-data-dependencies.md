# Dependencias de datos Analytics y configuración frontend

## Tabla `analytics_contract_snapshot`

El endpoint `POST /api/v1/analytics/brokers/summary` (Resumen Brokers) lee de la tabla `analytics_contract_snapshot`. Si la tabla está vacía, la vista Brokers mostrará "No hay datos".

### Cómo poblar la tabla

1. **Script de seed (desarrollo/pruebas)**  
   Ejecutar desde la raíz del proyecto:
   ```powershell
   python scripts/seed_brokers_analytics.py
   ```
   Inserta filas de prueba con supervisores FVBROKEREAS, FVBROKEREASCDE, UN MEDICINA ESTETICA, vía COBRADOR, meses 01/2026, 02/2026, 12/2025. Si la tabla ya tiene datos, el script no inserta nada.

2. **ETL desde legacy**  
   Si existe un sistema legacy que alimenta la snapshot, configurar el ETL para que sincronice los datos hacia `analytics_contract_snapshot`.

3. **Supervisores habilitados**  
   Los datos deben coincidir con los supervisores habilitados en Supervisores Brokers (`brokers_supervisor_scope`). Si el scope restringe a FVBROKEREAS y FVBROKEREASCDE, las filas en la snapshot deben usar esos mismos nombres.

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
