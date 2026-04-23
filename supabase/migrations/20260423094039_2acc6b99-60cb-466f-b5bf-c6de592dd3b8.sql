-- Agregar campo es_sobreturno a turnos
ALTER TABLE public.turnos
  ADD COLUMN IF NOT EXISTS es_sobreturno BOOLEAN NOT NULL DEFAULT false;

-- Índice para acelerar búsquedas de solapamiento
CREATE INDEX IF NOT EXISTS idx_turnos_prof_fecha_hora
  ON public.turnos (profesional_id, fecha, hora_inicio);

-- Función que valida solapamiento de turnos:
--   * Permite múltiples turnos en el mismo profesional/fecha/horario solo si el nuevo es sobreturno
--   * Bloquea la creación/actualización de un turno NORMAL si ya hay otro turno (normal o no) que se solape
CREATE OR REPLACE FUNCTION public.validar_solapamiento_turno()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _conflict_count INTEGER;
BEGIN
  -- Estados que NO ocupan agenda (cancelados/reprogramados/ausentes liberan el horario)
  IF NEW.estado IN ('cancelado', 'reprogramado', 'ausente') THEN
    RETURN NEW;
  END IF;

  -- Si el nuevo turno es sobreturno, permitir convivir con otros (no validar choque)
  IF NEW.es_sobreturno = true THEN
    RETURN NEW;
  END IF;

  -- Para turnos normales: no debe haber otro turno (normal o sobreturno activo)
  -- en el mismo profesional/fecha que se solape en el rango horario.
  SELECT COUNT(*) INTO _conflict_count
  FROM public.turnos t
  WHERE t.profesional_id = NEW.profesional_id
    AND t.fecha = NEW.fecha
    AND t.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND t.estado NOT IN ('cancelado', 'reprogramado', 'ausente')
    AND t.es_sobreturno = false
    AND t.hora_inicio < NEW.hora_fin
    AND t.hora_fin > NEW.hora_inicio;

  IF _conflict_count > 0 THEN
    RAISE EXCEPTION 'Ya existe un turno en este horario para el profesional. Para registrarlo igual, marque "Sobreturno".'
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_solapamiento_turno ON public.turnos;
CREATE TRIGGER trg_validar_solapamiento_turno
BEFORE INSERT OR UPDATE ON public.turnos
FOR EACH ROW
EXECUTE FUNCTION public.validar_solapamiento_turno();