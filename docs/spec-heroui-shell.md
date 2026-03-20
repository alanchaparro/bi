# Spec de diseño — Shell con tema HeroUI

## Objetivo
Layout (header, sidebar, contenido) y página de login con **tema HeroUI**: componentes y variantes de HeroUI, tokens del sistema, sin estilos custom que contradigan el tema.

## Componentes HeroUI a usar

### Header (app bar)
- **HeroUI Header** como contenedor semántico del app bar.
- **Botón toggle sidebar**: `Button` variant="ghost" size="md" isIconOnly.
- **Título**: texto "EPEM - Cartera de Cobranzas" con tipografía del tema.
- **Pills de sync/schedule**: enlaces a `/config` con estilos de estado (ok, warn, error, info); mantener lógica actual.
- **Rol de usuario**: texto secundario.
- **Toggle tema**: `Button` variant="ghost" isIconOnly (ícono sol/luna).
- **Cerrar sesión**: `Button` variant="outline" size="sm".

### Sidebar
- Contenedor: `aside` con fondo y borde usando tokens (--sidebar-bg, --sidebar-border).
- **Navegación**: enlaces con `Link` de Next.js; estilo activo con tokens (--sidebar-active-bg, --color-primary).
- **Grupos**: "Análisis de Cartera" y "Sistema"; etiqueta de grupo en mayúsculas, tamaño xs, color muted.
- **Ítems**: icono + label; altura mínima 44px; hover y activo con transición.
- **Botón cerrar (móvil)**: `Button` variant="ghost" isIconOnly.
- En móvil: overlay que cierra el sidebar al hacer clic fuera; sidebar deslizable.

### Botones (reglas generales)
- Acción principal (ej. Entrar en login): variant="primary" size="md".
- Acciones de barra (tema, toggle): variant="ghost" isIconOnly size="md".
- Cerrar sesión: variant="outline" size="sm".
- Dentro de tablas/filtros: size="sm" según contexto.

### Login
- Contenedor: `Card` de HeroUI, max-width 28rem.
- Campos: `Input` con label vía `Label`; variant por defecto del tema.
- Botón enviar: `Button` variant="primary" fullWidth.
- Estados: disabled durante loading; mensaje de error con color danger.

### Contenido principal
- Área bajo el header y al lado del sidebar; padding consistente; contenedor con max-width según tokens (--container-max).
- Animación de entrada de página: opcional, suave (page-enter).

## Tokens que se mantienen (compatibilidad)
- --header-height, --sidebar-width, --container-max, --touch-min.
- --color-primary, --color-text, --color-text-muted, --color-error.
- --sidebar-bg, --sidebar-border, --sidebar-active-bg, --sidebar-hover-bg.
- Pills: --success, --color-state-warn, --color-state-error, --color-state-info.

## Estados visuales
- **Loading (auth)**: texto "Cargando..." centrado.
- **Sidebar**: ítem activo según pathname; hover en ítems.
- **Login**: error bajo el formulario; botón deshabilitado si falta usuario/contraseña o está enviando.

## Accesibilidad
- aria-label en botones de icono (toggle sidebar, tema, cerrar).
- aria-current="page" en el ítem de navegación activo.
- Labels asociados a inputs en login.
