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

## Objetivo
Scaffold de migración para módulos Brokers sin romper el frontend legacy.
