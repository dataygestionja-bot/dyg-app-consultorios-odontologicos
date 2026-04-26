-- Enum de estados clínicos del diente
CREATE TYPE public.diente_estado AS ENUM (
  'sano',
  'caries',
  'restauracion',
  'ausente',
  'observacion'
);

-- Tabla principal
CREATE TABLE public.odontograma_registros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  diente SMALLINT NOT NULL CHECK (diente BETWEEN 1 AND 32),
  estado public.diente_estado NOT NULL,
  fecha TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  profesional_id UUID NOT NULL REFERENCES public.profesionales(id) ON DELETE RESTRICT,
  observaciones TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_odontograma_paciente ON public.odontograma_registros(paciente_id);
CREATE INDEX idx_odontograma_paciente_diente_fecha ON public.odontograma_registros(paciente_id, diente, fecha DESC);

-- Trigger updated_at
CREATE TRIGGER update_odontograma_updated_at
BEFORE UPDATE ON public.odontograma_registros
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.odontograma_registros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Odontograma: lectura por permiso"
ON public.odontograma_registros
FOR SELECT
TO authenticated
USING (has_permission(auth.uid(), 'odontograma', 'read'::permission_action));

CREATE POLICY "Odontograma: alta por permiso"
ON public.odontograma_registros
FOR INSERT
TO authenticated
WITH CHECK (
  has_permission(auth.uid(), 'odontograma', 'create'::permission_action)
  AND (
    NOT has_role(auth.uid(), 'profesional'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'recepcion'::app_role)
    OR profesional_id IN (SELECT id FROM public.profesionales WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Odontograma: modificacion por permiso"
ON public.odontograma_registros
FOR UPDATE
TO authenticated
USING (
  has_permission(auth.uid(), 'odontograma', 'update'::permission_action)
  AND (
    NOT has_role(auth.uid(), 'profesional'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'recepcion'::app_role)
    OR profesional_id IN (SELECT id FROM public.profesionales WHERE user_id = auth.uid())
  )
)
WITH CHECK (
  has_permission(auth.uid(), 'odontograma', 'update'::permission_action)
  AND (
    NOT has_role(auth.uid(), 'profesional'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'recepcion'::app_role)
    OR profesional_id IN (SELECT id FROM public.profesionales WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Odontograma: baja por permiso"
ON public.odontograma_registros
FOR DELETE
TO authenticated
USING (
  has_permission(auth.uid(), 'odontograma', 'delete'::permission_action)
  AND (
    NOT has_role(auth.uid(), 'profesional'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'recepcion'::app_role)
    OR profesional_id IN (SELECT id FROM public.profesionales WHERE user_id = auth.uid())
  )
);

-- Seed de permisos por defecto para el módulo 'odontograma'
INSERT INTO public.role_permissions (role, module, action, allowed) VALUES
  ('admin', 'odontograma', 'read', true),
  ('admin', 'odontograma', 'create', true),
  ('admin', 'odontograma', 'update', true),
  ('admin', 'odontograma', 'delete', true),
  ('recepcion', 'odontograma', 'read', true),
  ('recepcion', 'odontograma', 'create', false),
  ('recepcion', 'odontograma', 'update', false),
  ('recepcion', 'odontograma', 'delete', false),
  ('profesional', 'odontograma', 'read', true),
  ('profesional', 'odontograma', 'create', true),
  ('profesional', 'odontograma', 'update', true),
  ('profesional', 'odontograma', 'delete', false)
ON CONFLICT DO NOTHING;