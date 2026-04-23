-- Eliminar la constraint de exclusión vieja que bloquea cualquier solapamiento
ALTER TABLE public.turnos
  DROP CONSTRAINT IF EXISTS turnos_no_overlap;

-- Recrearla excluyendo sobreturnos del índice de exclusión
ALTER TABLE public.turnos
  ADD CONSTRAINT turnos_no_overlap
  EXCLUDE USING gist (
    profesional_id WITH =,
    fecha WITH =,
    tsrange((fecha + hora_inicio), (fecha + hora_fin), '[)') WITH &&
  )
  WHERE (
    es_sobreturno = false
    AND estado IN ('reservado','confirmado','atendido')
  );