# Frontend v1 (React + TS)

## Dev
```bash
npm install
npm run dev
```

## Tipos OpenAPI
```bash
npm run generate:types
```
Genera `src/shared/api-types.ts` desde `../docs/openapi-v1.json`.

## Variables
- `VITE_API_BASE_URL` (default `http://localhost:8000/api/v1`)

## Tests
```bash
npm run test
```
Cobertura incluye el menú de navegación: el componente `AppNav` (enlaces por sección, ítem activo con `aria-current`) y la integración en `App` (todas las secciones de `NAV_SECTIONS` presentes en el DOM con el `id` correcto). Vitest + jsdom + React Testing Library.

## E2E (Playwright)
Primera vez: instalar navegador Chromium (desde `frontend/`):
```bash
npx playwright install chromium
```
Ejecutar E2E:
```bash
npm run test:e2e
```
Playwright arranca la API (`docker compose --profile dev up api-v1` desde la raíz) y el front (`npm run dev`) si no están en marcha; con `reuseExistingServer` puede reutilizar servidores ya levantados. El test: login con `admin`/`change_me_demo_admin_password` (o `E2E_USERNAME`/`E2E_PASSWORD`), clic en "Comisiones" y comprueba que la sección `#comisiones` está visible en viewport.

## Objetivo
Scaffold de migración para módulos Brokers sin romper el frontend legacy.
