-- 1. Agregar nuevos valores al enum turno_estado
ALTER TYPE public.turno_estado ADD VALUE IF NOT EXISTS 'en_atencion';
ALTER TYPE public.turno_estado ADD VALUE IF NOT EXISTS 'pendiente_cierre';

-- 2. Crear enum tipo_atencion
DO $$ BEGIN
  CREATE TYPE public.tipo_atencion AS ENUM ('con_turno', 'urgencia', 'espontanea');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. Agregar columna tipo_atencion a atenciones
ALTER TABLE public.atenciones
  ADD COLUMN IF NOT EXISTS tipo_atencion public.tipo_atencion NOT NULL DEFAULT 'con_turno';

-- 4. Hacer motivo_consulta obligatorio en turnos
UPDATE public.turnos SET motivo_consulta = 'Sin especificar' WHERE motivo_consulta IS NULL OR motivo_consulta = '';
ALTER TABLE public.turnos ALTER COLUMN motivo_consulta SET NOT NULL;

-- 5. Trigger: validar coherencia tipo_atencion ↔ turno_id
CREATE OR REPLACE FUNCTION public.validar_tipo_atencion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo_atencion = 'con_turno' AND NEW.turno_id IS NULL THEN
    RAISE EXCEPTION 'Una atención de tipo "con_turno" debe tener un turno asociado';
  END IF;
  IF NEW.tipo_atencion IN ('urgencia', 'espontanea') AND NEW.turno_id IS NOT NULL THEN
    RAISE EXCEPTION 'Una atención de urgencia o espontánea no puede estar vinculada a un turno';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_tipo_atencion ON public.atenciones;
CREATE TRIGGER trg_validar_tipo_atencion
  BEFORE INSERT OR UPDATE ON public.atenciones
  FOR EACH ROW EXECUTE FUNCTION public.validar_tipo_atencion();

-- 6. Trigger: al guardar atención con turno, marcar turno como atendido
CREATE OR REPLACE FUNCTION public.sync_turno_atendido()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.turno_id IS NOT NULL THEN
    UPDATE public.turnos
       SET estado = 'atendido', updated_at = now()
     WHERE id = NEW.turno_id
       AND estado <> 'atendido';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_turno_atendido ON public.atenciones;
CREATE TRIGGER trg_sync_turno_atendido
  AFTER INSERT OR UPDATE ON public.atenciones
  FOR EACH ROW EXECUTE FUNCTION public.sync_turno_atendido();

-- 7. Trigger: prevenir marcar turno como atendido sin atención asociada
CREATE OR REPLACE FUNCTION public.validar_turno_atendido()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.estado = 'atendido' AND (OLD.estado IS DISTINCT FROM 'atendido') THEN
    IF NOT EXISTS (SELECT 1 FROM public.atenciones WHERE turno_id = NEW.id) THEN
      RAISE EXCEPTION 'No se puede marcar un turno como atendido sin una atención asociada. Use "Iniciar atención" para registrarla.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_turno_atendido ON public.turnos;
CREATE TRIGGER trg_validar_turno_atendido
  BEFORE UPDATE ON public.turnos
  FOR EACH ROW EXECUTE FUNCTION public.validar_turno_atendido();

-- 8. Función de cierre diario: marcar turnos vencidos sin atención como pendiente_cierre
CREATE OR REPLACE FUNCTION public.cierre_diario_turnos()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count INTEGER;
BEGIN
  WITH actualizados AS (
    UPDATE public.turnos t
       SET estado = 'pendiente_cierre', updated_at = now()
     WHERE t.estado IN ('confirmado', 'reservado', 'en_atencion')
       AND (t.fecha + t.hora_fin) < now()
       AND NOT EXISTS (SELECT 1 FROM public.atenciones a WHERE a.turno_id = t.id)
     RETURNING 1
  )
  SELECT COUNT(*) INTO _count FROM actualizados;
  RETURN _count;
END;
$$;

-- 9. Programar cierre diario con pg_cron (23:55 todos los días)
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$ BEGIN
  PERFORM cron.unschedule('cierre-diario-turnos');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'cierre-diario-turnos',
  '55 23 * * *',
  $$SELECT public.cierre_diario_turnos();$$
);