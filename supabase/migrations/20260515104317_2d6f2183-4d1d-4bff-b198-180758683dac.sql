CREATE OR REPLACE FUNCTION public.validar_turno_en_atencion()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.estado::text = 'en_atencion'
     AND (OLD.estado IS DISTINCT FROM NEW.estado)
     AND NEW.fecha <> CURRENT_DATE THEN
    RAISE EXCEPTION 'Solo se puede marcar un turno como "en atención" el mismo día del turno (fecha del turno: %, hoy: %).', NEW.fecha, CURRENT_DATE
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_turno_en_atencion ON public.turnos;

CREATE TRIGGER trg_validar_turno_en_atencion
BEFORE UPDATE OF estado ON public.turnos
FOR EACH ROW
EXECUTE FUNCTION public.validar_turno_en_atencion();