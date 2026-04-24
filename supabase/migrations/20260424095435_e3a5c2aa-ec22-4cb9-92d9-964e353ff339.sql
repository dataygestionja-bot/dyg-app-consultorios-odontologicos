-- 1) Enums
CREATE TYPE public.motivo_bloqueo AS ENUM
  ('vacaciones','enfermedad','capacitacion','licencia','feriado','personal','otro');

CREATE TYPE public.bloqueo_estado AS ENUM ('activo','cancelado');

-- 2) Tabla bloqueos_agenda
CREATE TABLE public.bloqueos_agenda (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profesional_id  uuid NOT NULL REFERENCES public.profesionales(id) ON DELETE CASCADE,
  fecha_desde     date NOT NULL,
  fecha_hasta     date NOT NULL,
  todo_el_dia     boolean NOT NULL DEFAULT true,
  hora_desde      time,
  hora_hasta      time,
  motivo          public.motivo_bloqueo NOT NULL,
  observaciones   text,
  estado          public.bloqueo_estado NOT NULL DEFAULT 'activo',
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bloqueos_prof_fecha
  ON public.bloqueos_agenda (profesional_id, fecha_desde, fecha_hasta)
  WHERE estado = 'activo';

-- 3) Trigger de validación de campos
CREATE OR REPLACE FUNCTION public.validar_bloqueo_agenda()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.fecha_hasta < NEW.fecha_desde THEN
    RAISE EXCEPTION 'La fecha hasta no puede ser anterior a la fecha desde';
  END IF;
  IF NEW.todo_el_dia = false THEN
    IF NEW.hora_desde IS NULL OR NEW.hora_hasta IS NULL THEN
      RAISE EXCEPTION 'Si no es todo el día, hora desde y hora hasta son obligatorias';
    END IF;
    IF NEW.hora_hasta <= NEW.hora_desde THEN
      RAISE EXCEPTION 'La hora hasta debe ser mayor a la hora desde';
    END IF;
  ELSE
    NEW.hora_desde := NULL;
    NEW.hora_hasta := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validar_bloqueo_agenda
  BEFORE INSERT OR UPDATE ON public.bloqueos_agenda
  FOR EACH ROW EXECUTE FUNCTION public.validar_bloqueo_agenda();

-- 4) Trigger updated_at
CREATE TRIGGER trg_bloqueos_agenda_updated_at
  BEFORE UPDATE ON public.bloqueos_agenda
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Trigger auditoría
CREATE TRIGGER trg_bloqueos_agenda_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.bloqueos_agenda
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- 6) RLS
ALTER TABLE public.bloqueos_agenda ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bloqueos: lectura autenticados"
  ON public.bloqueos_agenda FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Bloqueos: alta admin/recepcion"
  ON public.bloqueos_agenda FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'recepcion'));

CREATE POLICY "Bloqueos: modificacion admin/recepcion"
  ON public.bloqueos_agenda FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'recepcion'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'recepcion'));

CREATE POLICY "Bloqueos: baja admin/recepcion"
  ON public.bloqueos_agenda FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'recepcion'));

-- 7) Validación de turnos vs bloqueos
CREATE OR REPLACE FUNCTION public.validar_turno_no_bloqueado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _hit INTEGER;
BEGIN
  -- Estados que no ocupan agenda: ignorar
  IF NEW.estado IN ('cancelado','reprogramado','ausente') THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO _hit
  FROM public.bloqueos_agenda b
  WHERE b.profesional_id = NEW.profesional_id
    AND b.estado = 'activo'
    AND NEW.fecha BETWEEN b.fecha_desde AND b.fecha_hasta
    AND (
      b.todo_el_dia = true
      OR (NEW.hora_inicio < b.hora_hasta AND NEW.hora_fin > b.hora_desde)
    );

  IF _hit > 0 THEN
    RAISE EXCEPTION 'El profesional no está disponible en ese día u horario.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validar_turno_no_bloqueado
  BEFORE INSERT OR UPDATE ON public.turnos
  FOR EACH ROW EXECUTE FUNCTION public.validar_turno_no_bloqueado();