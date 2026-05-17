## Cambios al odontograma

### 1. Leyenda más pequeña y debajo del odontograma

En `src/components/paciente/Odontograma.tsx`:

- Mover la `Card` de la leyenda para que se renderice **después** de la `Card` del odontograma.
- Quitar la `Card` envolvente y usar una fila compacta (`flex flex-wrap gap-x-3 gap-y-1`) con tipografía `text-[11px]` y dots `h-2 w-2`, alineada con padding chico.
- Mantener los mismos estados (`DIENTE_ESTADOS_SELECCIONABLES`).

### 2. Click en una pieza → solo opciones de estado

Reescribir `src/components/paciente/odontograma/PiezaDentalDialog.tsx` para que cuando se abra desde una atención (con `profesionalId` y `pacienteId` del turno), muestre **solo los botones de acción** (Sano, Caries, Obturación, etc.) en formato grilla con su color, sin tabs, sin selector de fecha, sin selector de profesional y sin observaciones.

Flujo:
- Header: `Pieza {FDI}` + chip con el último estado registrado (si existe).
- Grilla de botones (2–3 columnas), cada botón con el dot de color + label.
- Al hacer click en un botón → `insert` directo en `odontograma_registros` con:
  - `paciente_id` = paciente del turno
  - `profesional_id` = profesional del turno (prop `profesionalId`)
  - `fecha` = `fechaAtencion` del turno (o ahora si no viene)
  - `estado` = el seleccionado
  - `observaciones` = `null`
- Toast de confirmación → cierra el diálogo → refresca registros.
- Link "Ver historial" debajo: abre un segundo modal (o expande inline) con la tabla de historial de esa pieza, sin formulario.

Cuando NO hay contexto de turno (vista del paciente, `mode="full"` sin `profesionalId`):
- Se muestra el mismo grid de botones pero usa el profesional del usuario logueado (`userId` → `profesionales.user_id`) como fallback. Si no se puede resolver, se muestra un mensaje breve indicando que no hay profesional asociado y se deshabilitan los botones.

### 3. Datos linkeados al profesional y paciente del turno

En `src/pages/AtencionForm.tsx` ya se pasa `pacienteId`, `profesionalId` y `fechaAtencion` al `<Odontograma>` (sección de la atención). Verificar y, si falta, pasarlos correctamente.

En `Odontograma.tsx`, propagar esos tres props al `<PiezaDentalDialog>` (hoy solo recibe `pacienteId`, `profesionales`, `userId`).

### 4. Limpieza

- Eliminar el botón "Agregar registro" y el `AgregarRegistroDialog` del componente cuando `mode === "inline"` (ya está oculto, pero ahora también desde la vista del paciente queda redundante). Confirmar antes de borrar el dialog completo o solo ocultarlo.
- No tocar el resto del flujo de atención ni la migración.

### Archivos afectados

- `src/components/paciente/Odontograma.tsx` (mover leyenda, achicar, pasar props nuevos al diálogo)
- `src/components/paciente/odontograma/PiezaDentalDialog.tsx` (rediseño: grid de botones de estado, ver historial aparte)
- `src/pages/AtencionForm.tsx` (verificar que ya envía `profesionalId` y `fechaAtencion` al `<Odontograma>`; ajustar si falta)

### Una duda rápida antes de implementar

¿Querés que el botón **"Agregar registro"** del modo paciente (fuera de una atención) también desaparezca, dejando como única forma de registrar el click sobre la pieza? ¿O lo mantenemos para casos sin profesional logueado?