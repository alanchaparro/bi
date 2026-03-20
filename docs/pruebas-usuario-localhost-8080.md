# Pruebas como usuario en localhost:8080

Para el proyecto, la aplicación en producción local se sirve en **http://localhost:8080** (contenedor `frontend-prod`).

## Checklist manual (usuario)

Con `docker compose up -d` y la app en http://localhost:8080:

1. **Login**
   - [ ] Abrir http://localhost:8080 (redirige a `/login` si no hay sesión).
   - [ ] Ver título "Cartera Cobranzas", campos Usuario y Contraseña, botón "Entrar".
   - [ ] Iniciar sesión con un usuario válido (ej. `admin` / contraseña configurada).
   - [ ] Comprobar redirección al dashboard (Análisis de Cartera) y menú lateral visible.

2. **Menú**
   - [ ] Ver enlaces: Análisis de Cartera, Análisis Anuales, Rendimiento de Cartera, Análisis Cobranzas Corte, Configuración.
   - [ ] Clic en "Configuración": entra en `/config`.
   - [ ] Clic en "Análisis Anuales": entra en `/analisis-anuales`.
   - [ ] Clic en "Análisis de Cartera": vuelve a la vista principal.

3. **Filtros y datos (Análisis de Cartera)**
   - [ ] En `/analisis-cartera` se ve el título "Análisis de Cartera" y la zona de filtros (Unidad de Negocio, Supervisor, Fecha de Gestión, etc.).
   - [ ] Abrir un desplegable de filtro (ej. "Unidad de Negocio" o "Fecha de Gestión"): se abre la lista de opciones.
   - [ ] Si hay datos: se ven KPIs o gráficos; si no hay datos o la API está vacía: mensaje de vacío o carga sin errores.

4. **Cerrar sesión**
   - [ ] Clic en el botón de cerrar sesión (header): vuelve a `/login`.

## Tests E2E automatizados

Los mismos flujos se cubren con Playwright en `frontend/e2e/`:

- **Login:** `e2e/login.spec.ts` — pantalla de login, login correcto, credenciales incorrectas.
- **Menú:** `e2e/menu.spec.ts` — enlaces visibles, navegación a Configuración y Análisis Anuales.
- **Filtros y datos:** `e2e/analisis-cartera-filtros.spec.ts` — título, contenido/filtros, abrir un filtro.

Ejecución (desde `frontend/`, con Docker y app en 8080):

```bash
npm ci
npx playwright install chromium
npm run test:e2e
```

Variables opcionales: `E2E_BASE_URL` (default `http://localhost:8080`), `E2E_USERNAME`, `E2E_PASSWORD`.

### Requisitos para que pasen todos los E2E

- **App en marcha:** frontend en http://localhost:8080 y API en http://localhost:8000 (p. ej. `docker compose up -d`).
- **Usuario válido:** por defecto los tests usan **admin / admin123**. Para que el login funcione con esa contraseña:
  - En el **backend** (archivo `.env` en la raíz del proyecto) define `DEMO_ADMIN_PASSWORD=admin123` (solo con `APP_ENV=dev`).
  - Al arrancar la API en dev, el bootstrap crea o actualiza el usuario `admin` en base de datos con esa contraseña, así que no hace falta ejecutar scripts a mano.
  - Para ejecutar los tests: `E2E_USERNAME=admin E2E_PASSWORD=admin123 npm run test:e2e` (o sin variables si ya usas admin123 por defecto).
- Si la app no está levantada o el login falla, los tests que dependen del dashboard (menú, filtros, secciones) harán timeout; los de solo login (pantalla, credenciales incorrectas) pueden pasar igual.
