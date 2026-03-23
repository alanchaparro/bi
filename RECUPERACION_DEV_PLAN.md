# Plan de recuperacion para dev (post-incidente)

## Objetivo
Recuperar y cerrar el avance UX/UI ya consolidado, minimizando riesgo de nueva perdida de trabajo.

## Alcance de recovery
- Fuente canonica: `bugs_visual.md` (estado y evidencias por V-*).
- Estado actual esperado:
  - V-001..V-055 cerrados en codigo.
  - Si aparece un V-* abierto en `bugs_visual.md`, se atiende en esta misma rama de recovery.

## Ejecucion rapida (PowerShell)
Desde la raiz del repo:

```powershell
powershell -ExecutionPolicy Bypass -File ".\scripts\recovery_dev_execute.ps1"
```

Si no queres hacer fetch remoto:

```powershell
powershell -ExecutionPolicy Bypass -File ".\scripts\recovery_dev_execute.ps1" -NoFetch
```

## Flujo operativo que debe seguir el dev
1. Crear rama de recovery desde `master` limpio.
2. Verificar que `bugs_visual.md` sea la guia de estado.
3. Verificar runtime para los V-* cerrados recientemente (minimo V-051..V-055).
4. Si aparece drift (codigo vs registro), corregir y revalidar.
5. Actualizar `bugs_visual.md` con el estado final (sin contradicciones).
6. Commit y push de recovery.
7. Abrir PR con checklist de validacion.

## Criterios de aceptacion de recovery
- No quedan V-* abiertos en `§10`.
- `bugs_visual.md` y codigo quedan consistentes.
- Verificacion runtime documentada para V-051..V-055.
- Confirmaciones destructivas alineadas a HeroUI.

## Plantilla de PR (copiar/pegar)
Titulo sugerido:

```text
fix(frontend): recover visual ux audit state and validate runtime
```

Cuerpo sugerido:

```markdown
## Contexto
Recuperacion post-incidente por perdida de avances locales no subidos.

## Cambios
- Se verifica runtime de V-051..V-055.
- Se corrige cualquier drift detectado entre codigo y `bugs_visual.md`.
- Se sincroniza `bugs_visual.md` (`§9` y `§10`) con el estado final.

## Verificacion
- [ ] Runtime validado para V-051..V-055
- [ ] Sin drift entre codigo y `bugs_visual.md`
- [ ] `bugs_visual.md` sin drift respecto a codigo

## Riesgos
- Si la confirmacion de emergencia no queda clara, puede persistir riesgo operativo por click accidental.
```

## Regla de oro para no perder avances otra vez
- Commit pequeno cada 30-60 minutos.
- Push al remoto al cerrar cada bloque funcional.
- PR draft temprana el mismo dia.
