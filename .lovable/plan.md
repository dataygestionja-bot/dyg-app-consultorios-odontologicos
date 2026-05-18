## Eliminar el módulo "Recetas registradas"

El módulo aparece en la pantalla de **Ver atención** (`/atenciones/:id/ver`) como tarjeta "Recetas registradas / Recetas emitidas en plataformas externas".

### Cambios

1. **`src/pages/AtencionDetalle.tsx`**
   - Quitar el import de `RecetasExternasSection`.
   - Quitar el bloque `<RecetasExternasSection ... />` (línea ~275).

2. **Archivos a eliminar** (ya no se usan en ningún lado):
   - `src/components/integraciones/RecetasExternasSection.tsx`
   - `src/components/integraciones/RecetaExternaDialog.tsx`

### Lo que NO se toca

- La tabla `recetas_externas` y el bucket `recetas-externas` en el backend se mantienen (no se borran datos).
- El permiso `recetas_externas` en `src/lib/permissions.ts` se mantiene por compatibilidad.
- El **Historial de recetas externas** en la ficha del paciente (`PacienteForm` → `HistorialRecetasExternas`) **se mantiene**, ya que es una vista de solo lectura distinta.

### A confirmar

¿Querés que también elimine el **Historial de recetas externas** dentro de la ficha del paciente, o lo dejamos como vista de consulta?
