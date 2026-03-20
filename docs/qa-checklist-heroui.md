# Checklist QA — Frontend con tema HeroUI

Revisión manual para validar el rebuild del frontend con HeroUI. Ejecutar con el entorno levantado (`docker compose up -d`) y la app accesible en **http://localhost:8080** (o el puerto configurado para frontend-prod).

---

## 1. Entorno

- [ ] Contenedores Up: `docker compose ps` — postgres, api-v1, frontend-prod (y opcional sync-worker).
- [ ] API responde: `curl -s http://localhost:8000/api/v1/health` devuelve 200.
- [ ] Frontend responde: abrir http://localhost:8080 y que cargue sin error de conexión.

---

## 2. Login

- [ ] Sin sesión: al ir a `/` o a una ruta protegida se redirige a `/login`.
- [ ] Formulario: campos Usuario y Contraseña visibles; botón "Entrar" con estilo HeroUI (primary).
- [ ] Credenciales inválidas: mensaje de error claro, sin stack ni códigos técnicos.
- [ ] Credenciales válidas: redirección a `/analisis-cartera` y menú lateral visible.
- [ ] Con sesión ya iniciada: al ir a `/login` se redirige a `/analisis-cartera`.

---

## 3. Navegación y layout

- [ ] **Header**: título "EPEM - Cartera de Cobranzas", botón toggle del menú, rol de usuario, botón tema (sol/luna), botón "Cerrar sesión".
- [ ] **Sidebar**: grupos "Análisis de Cartera" y "Sistema"; ítems: Análisis de Cartera, Análisis Anuales, Rendimiento de Cartera, Análisis Cobranzas Corte, Configuración.
- [ ] **Toggle sidebar**: en desktop y móvil el botón abre/cierra el menú; en móvil el overlay cierra el menú al hacer clic fuera.
- [ ] **Ruta activa**: el ítem del menú correspondiente a la ruta actual se ve resaltado (estilo activo).
- [ ] **Toggle tema**: cambia entre claro y oscuro; la preferencia se mantiene al recargar (localStorage).

---

## 4. Secciones de análisis

- [ ] **Análisis de Cartera** (`/analisis-cartera`): carga filtros y datos (o estado vacío); sin error 500 ni pantalla en blanco.
- [ ] **Análisis Anuales** (`/analisis-anuales`): carga correcta o estado vacío.
- [ ] **Rendimiento de Cartera** (`/rendimiento`): carga correcta o estado vacío.
- [ ] **Análisis Cobranzas Corte** (`/cobranzas-cohorte`): carga correcta o estado vacío.
- [ ] **Configuración** (`/config`): pantalla de configuración accesible; enlace desde pills de sync en el header lleva a `/config`.

---

## 5. Estados visuales (HeroUI)

- [ ] **Cargando**: en pantallas de análisis se muestra indicador de carga (p. ej. Spinner o skeleton), no solo pantalla en blanco.
- [ ] **Vacío**: cuando no hay datos se muestra mensaje contextual (ej. "No hay cartera para este período") y sugerencia si aplica.
- [ ] **Error**: si falla la API se muestra mensaje amigable y botón "Reintentar" cuando corresponda.

---

## 6. Cerrar sesión

- [ ] Al hacer clic en "Cerrar sesión" se pierde la sesión y se redirige a `/login`.
- [ ] Al volver a una ruta protegida sin sesión se redirige a `/login`.

---

## 7. Coherencia de datos (reglas AGENTS.md)

- [ ] Filtros por **gestión** (gestion_month) disponibles y coherentes en análisis de cartera y rendimiento.
- [ ] Totales o KPIs mostrados no contradicen la regla **monto_a_cobrar = monto_vencido + monto_cuota**.
- [ ] **Rendimiento**: si se muestra, usar rendimiento_monto_% y/o rendimiento_cantidad_% según definición en AGENTS.md.

---

## Resultado

- **APROBADO**: todos los ítems críticos (login, navegación, secciones, cerrar sesión) pasan.
- **APROBADO CON OBSERVACIONES**: funciona bien con detalles menores a corregir (anotar en "Observaciones").
- **RECHAZADO**: algún bloqueante (ej. pantalla en blanco, error al login, menú roto); detallar en "Bloqueantes".

**Observaciones:**  
_(anotar aquí)_

**Bloqueantes:**  
_(si aplica)_

**Fecha de revisión:** _______________  
**Revisor:** _______________
