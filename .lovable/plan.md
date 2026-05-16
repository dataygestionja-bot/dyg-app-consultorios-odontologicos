## Compactar "Prácticas realizadas"

Reducir espacios verticales del card sin cambiar funcionalidad.

### Cambios en `src/pages/AtencionForm.tsx` (card de Prácticas)

1. `CardHeader`: agregar `py-3` para reducir alto.
2. `CardContent`: cambiar `space-y-4` → `space-y-3` y agregar `pt-0`.
3. Eliminar `<Table>` (overkill para una sola columna). Reemplazar por una lista compacta:
   - Label "Prestación" pequeño una sola vez.
   - Cada fila: `flex gap-2 items-center` con Select + botón "+" + botón papelera, sin padding extra de TableCell.
4. Bloques Diagnóstico / Indicaciones / Próxima visita:
   - `space-y-2` → `space-y-1`.
   - Textareas `rows={2}` (ya está) — ok.
5. Próxima visita: mantener `max-w-xs`.

### Resultado
Card más denso (~40% menos alto), sin perder legibilidad ni cambiar lógica.