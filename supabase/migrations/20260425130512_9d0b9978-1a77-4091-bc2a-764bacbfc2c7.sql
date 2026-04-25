-- 1) Nuevos valores en el enum turno_estado
ALTER TYPE public.turno_estado ADD VALUE IF NOT EXISTS 'solicitado';
ALTER TYPE public.turno_estado ADD VALUE IF NOT EXISTS 'rechazado';

-- 2) Pacientes: marca de validación pendiente
ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS pendiente_validacion BOOLEAN NOT NULL DEFAULT false;

-- 3) Turnos: origen (interno | publico)
ALTER TABLE public.turnos
  ADD COLUMN IF NOT EXISTS origen TEXT NOT NULL DEFAULT 'interno';

-- 4) Trigger validar_solapamiento_turno: ignorar también solicitado y rechazado
CREATE OR REPLACE FUNCTION public.validar_solapamiento_turno()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _conflict_count INTEGER;
BEGIN
  -- Estados que NO ocupan agenda
  IF NEW.estado IN ('cancelado', 'reprogramado', 'ausente', 'solicitado', 'rechazado') THEN
    RETURN NEW;
  END IF;

  IF NEW.es_sobreturno = true THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO _conflict_count
  FROM public.turnos t
  WHERE t.profesional_id = NEW.profesional_id
    AND t.fecha = NEW.fecha
    AND t.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND t.estado NOT IN ('cancelado', 'reprogramado', 'ausente', 'solicitado', 'rechazado')
    AND t.es_sobreturno = false
    AND t.hora_inicio < NEW.hora_fin
    AND t.hora_fin > NEW.hora_inicio;

  IF _conflict_count > 0 THEN
    RAISE EXCEPTION 'Ya existe un turno en este horario para el profesional. Para registrarlo igual, marque "Sobreturno".'
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$function$;

-- 5) Trigger validar_turno_no_bloqueado: también ignorar solicitado/rechazado
CREATE OR REPLACE FUNCTION public.validar_turno_no_bloqueado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _hit INTEGER;
BEGIN
  IF NEW.estado IN ('cancelado','reprogramado','ausente','solicitado','rechazado') THEN
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
$function$;

-- 6) RLS adicional para whatsapp_respuestas: que recepción también lea
DROP POLICY IF EXISTS "WhatsAppResp: recepcion lee" ON public.whatsapp_respuestas;
CREATE POLICY "WhatsAppResp: recepcion lee"
ON public.whatsapp_respuestas
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'recepcion'::app_role));

-- 7) Índice útil para la bandeja "Turnos solicitados"
CREATE INDEX IF NOT EXISTS idx_turnos_estado_origen ON public.turnos (estado, origen);