

## Permitir editar turno completo (paciente, profesional, fecha, hora, motivo, estado)

Hoy el diálogo "Editar turno" en `src/pages/Turnos.tsx` solo permite cambiar **estado** y **motivo**. El usuario necesita reasignar el turno a otro paciente, cambiar profesional, fecha u hora.

### Cambios en `src/pages/Turnos.tsx`

**1. Ampliar el estado del diálogo de edición**
Agregar al estado local del diálogo: `paciente_id`, `profesional_id`, `fecha`, `hora_inicio`, `hora_fin`. Precargarlos desde el turno seleccionado en `abrirTurno()`.

**2. Nuevos campos en el diálogo "Editar turno"**
- **Paciente**: Select buscable (Combobox con `Command`) listando `pacientes` activos — `apellido, nombre — DNI`. Reusar el patrón ya usado en "Nuevo turno".
- **Profesional**: Select con `profesionales` activos.
- **Fecha**: Input `type="date"`.
- **Hora inicio / Hora fin**: Inputs `type="time"`. Al cambiar `hora_inicio`, autocompletar `hora_fin` sumando la duración original del turno (mantiene la duración salvo edición manual).
- **Motivo**: Textarea (ya existe). Obligatorio.
- **Estado**: Select limitado a estados manuales: `reservado`, `confirmado`, `cancelado`, `ausente`, `reprogramado`. Si el turno está en estado gestionado por sistema (`atendido`, `en_atencion`, `pendiente_cierre`), mostrarlo deshabilitado con nota *"Estado gestionado por el sistema"* y bloquear edición de paciente/profesional/fecha/hora.

**3. Validaciones en `guardar()`**
- Campos obligatorios: paciente, profesional, fecha, hora_inicio, hora_fin, motivo (`.trim() !== ""`).
- `hora_fin > hora_inicio`.
- **Chequeo de superposición**: antes del UPDATE, consultar `turnos` con el mismo `profesional_id` y `fecha`, estado activo (`reservado`, `confirmado`, `en_atencion`), excluyendo el `id` del turno actual, y verificar que no haya solapamiento con `[hora_inicio, hora_fin)`. Si hay choque → `toast.error("El profesional ya tiene un turno en ese horario")`.
- Manejo amigable de errores del trigger `validar_turno_atendido` (mensaje claro si llegara a dispararse).

**4. UPDATE a Supabase**
```typescript
await supabase.from("turnos").update({
  paciente_id, profesional_id, fecha,
  hora_inicio, hora_fin, motivo_consulta: motivo.trim(),
  estado,
}).eq("id", turnoId);
```
Tras éxito: `toast.success("Turno actualizado")`, cerrar diálogo y refrescar la grilla.

**5. UX**
- Título del diálogo: "Editar turno".
- Botón secundario "Cancelar turno" (si estado actual no es terminal): cambia estado a `cancelado` con un solo click + confirmación.
- Mantener los permisos existentes (`canEdit`): admin/recepción editan todo; profesional solo los suyos.

### Lo que NO se toca
- Triggers ni esquema de BD.
- Diálogo "Nuevo turno".
- Lógica de Atenciones.
- Estados gestionados por sistema (siguen bloqueados para edición manual).

### Resultado
Recepción puede reasignar un turno a otro paciente, moverlo de horario, cambiar profesional o motivo desde el mismo diálogo, con validación de superposición y respeto de las reglas de negocio existentes.

