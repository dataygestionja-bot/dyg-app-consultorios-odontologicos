## Evitar turnos duplicados al agendar próxima visita

Cuando se guarda (o edita) una atención con "Próxima visita sugerida" + slot, en lugar de insertar siempre, primero buscar un turno existente y actualizarlo si corresponde.

### Cambios en `AtencionForm.tsx` → `guardar()`

Reemplazar el bloque actual que sólo se ejecuta cuando `!isEdit`. El nuevo flujo se ejecuta siempre que haya fecha + slot + paciente + profesional + `agendarProximo`:

1. Consultar:
   ```ts
   supabase.from("turnos")
     .select("id, hora_inicio, hora_fin, estado")
     .eq("paciente_id", form.paciente_id)
     .eq("fecha", form.proxima_visita_sugerida)
     .eq("motivo_consulta", "Control / Próxima visita")
     .not("estado", "in", "(cancelado,rechazado)")
     .order("created_at", { ascending: false })
     .limit(1)
   ```
2. Si existe → `update` de `profesional_id`, `hora_inicio`, `hora_fin`, `estado='reservado'` sobre ese id. Toast: "Próximo turno actualizado…".
3. Si no existe → `insert` como hoy. Toast: "Próximo turno reservado…".

### Notas

- Se restringe el match a `motivo_consulta = "Control / Próxima visita"` para no pisar turnos creados manualmente por recepción.
- Se excluyen estados `cancelado` y `rechazado` para permitir reagendar después de una cancelación creando uno nuevo.
- Si la query falla, fallback al insert actual con warning.
- Habilitar el bloque también en edición (quitar el `!isEdit` actual).

Sin cambios de schema.