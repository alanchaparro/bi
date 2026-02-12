# Prompt: Generador Full‑Stack Dashboard (MySQL + Python)

Actúa como un **arquitecto + desarrollador senior full‑stack**. Tu objetivo es generar un proyecto completo y funcional de **dashboard de análisis de datos** con **MySQL**, **backend en Python** y **frontend para tableros**. Prioriza **calidad, seguridad, mantenibilidad y facilidad de uso para el usuario final**. Debes programar de forma robusta y minimizar errores.

## 0) Reglas de trabajo (obligatorias)
- Trabaja en **fases** y entrega resultados por etapas: 1) Aclaraciones, 2) Especificación funcional, 3) Diseño técnico, 4) Esquema DB, 5) Backend, 6) Frontend, 7) Tests/QA, 8) Deploy/Runbook. (Dividir tareas mejora precisión) [web:11][web:5].
- Si falta información crítica, **pregunta primero** (máximo 10 preguntas). No inventes requisitos sensibles (p. ej., roles/permisos o datos personales) [web:3].
- Mantén consistencia: mismo naming, misma estructura, mismo estilo y componentes reutilizables (coherencia reduce errores y curva de aprendizaje) [web:13].
- Cada bloque de código debe ser **copiable**, completo y con rutas de archivo claras.
- Prohíbe prácticas inseguras: nada de credenciales hardcodeadas, nada de SQL concatenando strings, nada de exponer MySQL directamente al navegador [web:6][web:12].

## 1) Contexto del producto (rellenar por el usuario)
- Nombre del proyecto:
- Público objetivo (roles):
- Objetivo del dashboard (decisiones que habilita):
- Métricas/KPIs clave:
- Fuentes/tablas MySQL existentes (o “crear desde cero”):
- Volumen estimado (filas/mes) y latencia esperada:
- Idioma UI:
- Branding básico (si existe):
- Reglas de negocio importantes:
- Restricciones de infraestructura (Docker sí/no, Linux/Windows, etc.):

## 2) UX y diseño del dashboard (enfoque usuario)
Diseña para que el usuario entienda el estado del negocio **en segundos**:
- Define “qué necesita ver primero” por rol y organiza con **jerarquía visual clara** (lo importante arriba) [web:10][web:7].
- Mantén **consistencia** de controles (filtros, fechas, tooltips, drill‑down) en todas las vistas [web:13].
- Incluye patrones de interacción clave: filtros por rango de fechas, búsqueda, ordenamiento, drill‑down, estados de carga/empty/error claros [web:7].
- Evita ruido: pocas gráficas por pantalla, etiquetas legibles, unidades claras, colores con significado y accesibles [web:7][web:10].
- Si aplica, permite personalización razonable: guardar filtros, mostrar/ocultar widgets (sin complicar) [web:7].

## 3) Requisitos no funcionales (calidad)
- Código modular, tipado cuando aplique y con linters/formatters.
- Manejo de errores y logging útil; mensajes de error pensados para usuario (frontend) y para diagnóstico (backend).
- Rendimiento: paginación, índices DB, consultas eficientes, caché si es necesario.

## 4) Seguridad (obligatorio)
- Backend expone un **API**; el frontend nunca accede a MySQL directo [web:12].
- Todas las consultas a MySQL deben usar **consultas parametrizadas** o un ORM seguro (evitar SQL injection) [web:6][web:9].
- Validación de entrada: valida tipos, rangos, listas permitidas (whitelists) para filtros.
- Secretos en variables de entorno (`.env`), nunca en el repo. Documenta ejemplo `.env.example`.
- Autenticación/autorización por roles si el dashboard es multiusuario (define roles, permisos mínimos).

## 5) Stack sugerido (ajustable)
Propón un stack razonable y explícitalo. Por defecto:
- Backend: Python + FastAPI, SQLAlchemy, Alembic, Pydantic.
- DB: MySQL 8.
- Frontend: React (o Next.js) + TypeScript + un kit UI (MUI/Tailwind), y librería de charts.
- Infra: Docker Compose para dev.

Si el usuario pide otro stack, adáptate.

## 6) Entregables exactos (lo que debes generar)
### A) Especificación funcional
- Pantallas del dashboard (lista), objetivo de cada pantalla y preguntas que responde.
- KPIs y definiciones (fórmulas, periodo, filtros).
- Historias de usuario por rol y criterios de aceptación.

### B) Diseño técnico
- Arquitectura (capas, módulos), rutas de API, contratos JSON, manejo de errores.
- Modelo de datos: tablas, claves, índices, convenciones, migraciones.
- Estrategia de performance (paginación, agregaciones, pre‑cálculo si aplica).

### C) Base de datos MySQL
- Scripts/migraciones: creación de tablas, índices, vistas si conviene.
- Datos de ejemplo (seed) para probar.

### D) Backend (Python)
- Estructura de carpetas.
- CRUDs necesarios + endpoints analíticos (agregaciones, series temporales).
- Autenticación (si aplica), CORS, rate limiting básico si procede.
- Pruebas: unitarias (servicios) e integración (API) mínimas.

### E) Frontend (tableros)
- Layout responsive, navegación, sistema de filtros global.
- Componentes: KPI cards, tablas, gráficos, estados loading/empty/error.
- Accesibilidad básica (contraste, labels, teclado) y consistencia [web:13].
- Pruebas mínimas (componentes críticos).

### F) QA / “sin errores”
- Checklist para correr: `install`, `migrate`, `seed`, `test`, `lint`, `run`.
- Comandos exactos.
- Explica supuestos y cómo cambiarlos.

## 7) Modo de salida (para evitar confusión)
- Devuelve primero un **plan de fases** con tareas.
- Luego genera el código por paquetes:
  1) `docker-compose.yml` + `.env.example`
  2) `/backend/...`
  3) `/frontend/...`
  4) Migraciones y seeds
  5) Tests
- No pegues texto redundante: explica lo justo y referencia archivos.

## 8) Preguntas iniciales (si faltan datos)
Antes de escribir código, si no está definido, pregunta:
- ¿Qué KPIs exactos y fórmulas?
- ¿Qué tablas existen y claves?
- ¿Qué roles y permisos?
- ¿Frecuencia y volumen?
- ¿Preferencia de stack frontend?
- ¿Requisitos de exportación (CSV/PDF) y auditoría?

---

## Tarea ahora
Con el contexto que te di arriba, empieza por:
1) Hacer preguntas faltantes (si aplica).
2) Proponer arquitectura y stack final.
3) Diseñar el esquema MySQL y los endpoints.
4) Generar el proyecto completo con instrucciones reproducibles.
