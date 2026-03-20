# Verificación: Legacy (5000) vs Proyecto (8080) — Filtros y PostgreSQL

Guía para usar el **legacy (localhost:5000)** como referencia y comprobar que **localhost:8080** tiene los mismos datos, filtros operativos y lectura correcta de PostgreSQL.

---

## 1. Qué es cada entorno

| Puerto | Servicio | Descripción |
|--------|----------|-------------|
| **5000** | `dashboard` (legacy) | App legacy (Python). Perfil: `dev`, `prod`, `legacy`. Misma API backend si se levanta con el mismo compose. |
| **8080** | `frontend-prod` | Next.js (nuevo). Consume **API v2** en `api-v1:8000`. |
| **8000** | `api-v1` | FastAPI. Lee **PostgreSQL** para options/summary v2; sync-worker llena las tablas agg. |

Para que 8080 tenga datos equivalentes al legacy:
- **PostgreSQL** debe tener datos (sync ejecutado).
- **api-v1** debe estar arriba y accesible (desde el navegador suele ser `http://localhost:8000/api/v1` si todo corre en la misma máquina).

---

## 2. Levantar entorno completo (legacy + nuevo + API)

```bash
# Con legacy (5000) y nuevo (8080) y API (8000)
docker compose --profile prod --profile legacy up -d postgres api-v1 dashboard frontend-prod
```

O sin legacy, solo nuevo + API:

```bash
docker compose --profile prod up -d postgres api-v1 frontend-prod
```

Comprobar que la API responde:

```bash
curl -s http://localhost:8000/api/v1/health | head -5
```

---

## 3. Verificar que PostgreSQL alimenta la API (smoke v2)

Desde la raíz del proyecto, con la API en marcha:

**Dentro del contenedor** (usa las variables de entorno del compose, credenciales de `.env`):

```bash
docker compose --profile prod exec api-v1 python /app/scripts/smoke_analytics_v2.py
```

**Desde el host** (API en localhost:8000; las credenciales deben ser las de tu entorno, p. ej. las que usas para entrar en 8080):

```bash
cd c:\desarrollos\bi-clone-nuevo
set API_V1_BASE=http://localhost:8000/api/v1
set DEMO_ADMIN_USER=admin
set DEMO_ADMIN_PASSWORD=tu_password_admin
python scripts/smoke_analytics_v2.py
```

Si el login devuelve 401, revisa que `DEMO_ADMIN_USER` y `DEMO_ADMIN_PASSWORD` coincidan con los configurados en el sistema (bootstrap o Config > Usuarios).

El script hace login y llama a:
- `POST /api/v1/analytics/portfolio-corte-v2/options`
- `POST /api/v1/analytics/portfolio-corte-v2/summary`
- `POST /api/v1/analytics/rendimiento-v2/options`
- `POST /api/v1/analytics/rendimiento-v2/summary`
- `POST /api/v1/analytics/cobranzas-cohorte-v2/options`
- `POST /api/v1/analytics/anuales-v2/options`

Comprueba que la respuesta es 200 y que las estructuras tienen `options` / `kpis` / etc. según el endpoint. Si falla login o algún POST, el script devuelve distinto de 0.

---

## 4. Checklist manual: filtros en 8080

Hacer con usuario logueado en **http://localhost:8080**.

### Análisis de Cartera
- [ ] La página carga sin error.
- [ ] Los filtros muestran opciones (Mes de Gestión, UN, Tramo, Categoría, etc.) — si la BD tiene datos, no deben aparecer “Sin opciones” en todos.
- [ ] “Aplicar filtros” aplica y los KPIs/tablas se actualizan.
- [ ] “Limpiar” y “Restablecer” dejan los filtros en estado coherente.
- [ ] Los chips de filtros activos se muestran y se pueden quitar.

### Rendimiento de Cartera
- [ ] Filtros visibles (Mes de Gestión, UN, Vía Cobro, etc.).
- [ ] Aplicar filtros actualiza resumen y gráficos.
- [ ] Limpiar / Restablecer funcionan.

### Análisis Anuales
- [ ] Filtros cargan; aplicar filtros actualiza la tabla/resumen.

### Cobranzas Cohorte
- [ ] Mes/Año de Cobro, UN, Vía, etc. cargan; aplicar y “Cargar más” (si aplica) funcionan.

### Configuración
- [ ] Pestañas (Usuarios, Negocio, Importaciones, Programación) cambian de contenido sin error.

Si en legacy (5000) ves datos en una sección y en 8080 esa misma sección sale vacía o “Sin opciones”, revisar:
- Que **api-v1** esté usando la misma base que el legacy (mismo `POSTGRES_*` en `.env`).
- Que el **sync** haya corrido (tablas `cartera_corte_agg`, `analytics_rendimiento_agg`, etc. con datos).

---

## 5. Comparar comportamiento con legacy (5000)

- **Legacy (5000):** Sirve como referencia de qué filtros existen y qué datos se ven por sección.
- **8080:** Debe ofrecer las mismas secciones (Cartera, Rendimiento, Anuales, Cohorte, Config) y que los filtros llamen a la API v2 y muestren lo que devuelve PostgreSQL (options + summary).
- Si el legacy usa otra API o otro origen de datos, las diferencias deben estar documentadas; en el setup estándar, ambos pueden usar la misma API (8000) y la misma BD.

---

## 6. Si los filtros salen vacíos en 8080

1. **Comprobar API:**  
   `curl -s -X POST http://localhost:8000/api/v1/analytics/portfolio-corte-v2/options -H "Content-Type: application/json" -H "Authorization: Bearer <TOKEN>" -d "{}"`  
   (sustituir `<TOKEN>` por el de login). Debe devolver JSON con `options` (uns, gestion_months, etc.).

2. **Comprobar BD:**  
   Conectar a PostgreSQL y revisar que existan filas en tablas como `cartera_corte_agg`, `analytics_rendimiento_agg`, `mv_options_cartera` (o las que use el backend). Si están vacías, ejecutar sync.

3. **Comprobar URL del frontend:**  
   En la app en 8080, en Config > Negocio (o en la UI de configuración) suele mostrarse la “Base URL” de la API. Debe ser la que llega a api-v1 (p. ej. `http://localhost:8000/api/v1` cuando se usa todo en local).

---

## 7. Resumen

- **Legacy (5000)** = referencia de flujo y filtros.
- **8080** = front nuevo; datos y filtros vienen de **PostgreSQL** vía **api-v1 (8000)** y endpoints v2.
- **Verificación automática:** `scripts/smoke_analytics_v2.py` (login + options/summary v2).
- **Verificación manual:** checklist anterior en cada sección con usuario logueado en 8080.
