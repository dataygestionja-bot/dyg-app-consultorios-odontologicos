## Objetivo

Mostrar el botón de WhatsApp por cada turno listado en el panel lateral del día, para enviar el recordatorio al paciente con un solo clic.

## Cambios

**Archivo único: `src/components/turnos/AgendaSemanalMatriz.tsx`**

1. Importar `WhatsAppTurnoButton` desde `./WhatsAppTurnoButton`.
2. En el listado de turnos del `Sheet` (donde hoy se muestra el `Badge` de estado y el menú de acciones), agregar el `WhatsAppTurnoButton` antes del `Badge`, pasando:
   - `telefono`: `t.paciente?.telefono ?? null`
   - `nombrePaciente`: `"<nombre> <apellido>"` del paciente (o `"Paciente"` si no hay)
   - `nombreProfesional`: `"<nombre> <apellido>"` del `detalle.prof`
   - `fecha`: `t.fecha`
   - `hora`: `t.hora_inicio`
   - `size="sm"`
3. Si el paciente no tiene teléfono, el botón ya queda deshabilitado con tooltip "Paciente sin teléfono" (lógica existente del componente, no requiere cambios).

## Sin cambios

- DB / RLS (el `telefono` ya se trae en la query existente).
- Componente `WhatsAppTurnoButton`, layout de la matriz, menú de Reprogramar/Cancelar, dialogos.
