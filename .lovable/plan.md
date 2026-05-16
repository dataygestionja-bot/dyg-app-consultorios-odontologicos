## Auto-agendar próxima visita con selección de slot

Convertir "Próxima visita sugerida" en un selector de fecha + horarios libres del profesional, y crear el turno automáticamente al guardar la atención.

### UX en `AtencionForm.tsx`

Reemplazar el bloque actual (solo `<input type="date">`) por:

1. **Fecha** (igual que hoy).
2. Al elegir fecha, debajo aparece una grilla de botones con los **slots libres** del profesional asignado a la atención, para ese día.
   - Si no hay horarios cargados o no hay slots libres → mensaje "Sin disponibilidad ese día".
   - Botón seleccionado se resalta (variante primary).
3. Checkbox opcional **"No agendar turno"** por si el profesional solo quiere dejar la fecha sugerida sin reservar.

### Lógica de slots (cliente)

Reutilizar la misma fórmula que `NuevoTurnoDialog`:

- Cargar `horarios_profesional` del `form.profesional_id` filtrados por `dia_semana` de la fecha elegida y `activo=true`.
- Cargar `turnos` del profesional ese día (estados no cancelados) para descontar ocupados.
- Generar slots `[hora_inicio, hora_fin]` cada `duracion_slot_min` y filtrar los que se solapan con turnos existentes.

Se reactiva cada vez que cambien `proxima_visita_sugerida` o `profesional_id`.

### Guardado

En `guardar()`, después de insertar la atención:

- Si hay `proxima_visita_sugerida` + slot elegido + no marcaron "No agendar":
  - Insertar en `turnos`:
    - `paciente_id`, `profesional_id` (los de la atención)
    - `fecha` = próxima visita
    - `hora_inicio` / `hora_fin` = slot elegido
    - `motivo_consulta` = "Control / Próxima visita"
    - `estado` = `reservado`
    - `origen` = `interno`
  - Toast: "Atención guardada y próximo turno reservado el dd/mm/yyyy a las HH:mm".

Si falla la creación del turno, mostrar warning pero no revertir la atención.

### Cambios de archivos

- `src/pages/AtencionForm.tsx`: nueva UI, estados `slotsProximos`, `slotElegido`, `agendarProximo`, queries a `horarios_profesional` + `turnos`, e insert de turno tras guardar.

Sin cambios de schema.