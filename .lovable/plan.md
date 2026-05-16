## Problema

En `Odontograma.tsx` (modo inline), al hacer clic en una opción de estado del popover, el registro se guarda pero el popover queda abierto.

## Solución

Convertir cada `Popover` por pieza en controlado, y cerrarlo dentro del handler de selección.

### Cambios en `src/components/paciente/Odontograma.tsx`

1. Extraer el render de cada pieza en modo `inline` a un pequeño subcomponente `ToothPopover` (o usar un `useState<number | null>` para la pieza abierta) que mantenga su propio estado `open`.
2. En el `onClick` de cada opción de estado:
   - `await registrarEstadoInline(n, e)`
   - `setOpen(false)` para cerrar el popover.
3. Pasar `open` y `onOpenChange` al componente `Popover`.

No se tocan otros archivos ni la lógica de guardado.
