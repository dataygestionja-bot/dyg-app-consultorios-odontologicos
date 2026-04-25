ALTER TABLE public.turnos
  ADD COLUMN IF NOT EXISTS nombre_solicitante text,
  ADD COLUMN IF NOT EXISTS apellido_solicitante text,
  ADD COLUMN IF NOT EXISTS dni_solicitante text,
  ADD COLUMN IF NOT EXISTS telefono_solicitante text,
  ADD COLUMN IF NOT EXISTS email_solicitante text,
  ADD COLUMN IF NOT EXISTS requiere_validacion boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_turnos_requiere_validacion
  ON public.turnos (requiere_validacion)
  WHERE requiere_validacion = true;