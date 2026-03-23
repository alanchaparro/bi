# Frontend – Next.js + React + HeroUI v3

Stack: **Next.js 15** (App Router), **React 19**, **TypeScript**, **Tailwind CSS v4**, **HeroUI v3** (componentes UI).

## Desarrollo

```bash
npm install
npm run dev
```

La app se sirve en **http://localhost:3000** (Next.js). La página raíz redirige a `/login` o `/analisis-cartera` según el estado de sesión.

## Build

```bash
npm run build
npm run start
```

## Rutas (App Router)

| Ruta | Descripción |
|------|-------------|
| `/` | Redirección según auth |
| `/login` | Inicio de sesión |
| `/analisis-cartera` | Análisis de Cartera |
| `/analisis-anuales` | Análisis Anuales |
| `/rendimiento` | Rendimiento de Cartera |
| `/cobranzas-cohorte` | Análisis Cobranzas Corte |
| `/config` | Configuración (sync, usuarios, etc.) |

## Variables de entorno

Crear `.env.local` (o usar `.env.example` como referencia):

- `NEXT_PUBLIC_API_BASE_URL` – URL base de la API (default: `http://localhost:8000/api/v1`)

Opcionales: `NEXT_PUBLIC_USE_FRONTEND_PERF_TELEMETRY`, `NEXT_PUBLIC_APP_VERSION`.

## Tipos OpenAPI

```bash
npm run generate:types
```

Genera `src/shared/api-types.ts` desde `../docs/openapi-v1.json` (requiere `openapi-typescript` en devDependencies si se usa).

## Tests

- **Typecheck:** `npm run typecheck`
- **E2E (Playwright):** por defecto los tests apuntan a **http://localhost:8080** (frontend en Docker). Desde `frontend/`:
  - `npm ci` (incluye `@playwright/test`)
  - `npx playwright install chromium`
  - Con Docker levantado (`docker compose up -d`): `npm run test:e2e`
  - Para otro origen: `E2E_BASE_URL=http://localhost:3000 npm run test:e2e`
  - Usuario/contraseña E2E: `E2E_USERNAME` / `E2E_PASSWORD` (default: `admin` / `admin123`). En el backend define `DEMO_ADMIN_PASSWORD=admin123` en `.env` (solo `APP_ENV=dev`) para que el login funcione.

## Estructura relevante

- `src/app/` – App Router: `layout.tsx`, `page.tsx`, `login/`, `(dashboard)/` (rutas protegidas).
- `src/components/layout/DashboardLayout.tsx` – Layout con sidebar, header, tema y estado de sync.
- `src/config/routes.ts` – Definición de rutas y ítems del menú.
- `src/modules/` – Vistas por módulo (analisisCartera, config, etc.); siguen usando estilos en `src/index.css` para compatibilidad.
- `src/shared/` – API, contratos, formatters, `env.ts` (variables Next/Vite).

## Referencias visuales

- Estándar visual analytics: [docs/frontend-visual-standard.md](C:/desarrollos/bi-clone-nuevo/docs/frontend-visual-standard.md)
- Checklist de revisión visual para PRs: [docs/frontend-visual-pr-checklist.md](C:/desarrollos/bi-clone-nuevo/docs/frontend-visual-pr-checklist.md)

## Objetivo

Frontend listo para uso con Next.js y HeroUI v3: login y shell (sidebar + header) en HeroUI; vistas de análisis y configuración conservan la lógica existente y pueden migrarse a HeroUI de forma gradual.
