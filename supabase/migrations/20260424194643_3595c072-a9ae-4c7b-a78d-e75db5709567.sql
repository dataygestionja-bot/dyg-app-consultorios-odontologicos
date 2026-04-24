
-- 1) Renombrar permisos existentes del módulo turnos -> agenda
UPDATE public.role_permissions
SET module = 'agenda', updated_at = now()
WHERE module = 'turnos';

-- 2) Crear permisos por defecto del nuevo módulo bloqueos_agenda
-- admin: todo
INSERT INTO public.role_permissions (role, module, action, allowed)
SELECT 'admin'::app_role, 'bloqueos_agenda', a::permission_action, true
FROM unnest(ARRAY['read','create','update','delete']) AS a
ON CONFLICT DO NOTHING;

-- recepcion: todo
INSERT INTO public.role_permissions (role, module, action, allowed)
SELECT 'recepcion'::app_role, 'bloqueos_agenda', a::permission_action, true
FROM unnest(ARRAY['read','create','update','delete']) AS a
ON CONFLICT DO NOTHING;

-- profesional: todo (SI puede gestionar bloqueos)
INSERT INTO public.role_permissions (role, module, action, allowed)
SELECT 'profesional'::app_role, 'bloqueos_agenda', a::permission_action, true
FROM unnest(ARRAY['read','create','update','delete']) AS a
ON CONFLICT DO NOTHING;

-- Asegurar que el profesional NO tenga permisos en agenda (excepto read para visualizar su agenda)
-- Mantener read=true (para que pueda ver), forzar create/update/delete = false
UPDATE public.role_permissions
SET allowed = false, updated_at = now()
WHERE role = 'profesional'
  AND module = 'agenda'
  AND action IN ('create'::permission_action, 'delete'::permission_action);

-- update en agenda lo dejamos true para profesional (puede cambiar estado de su propio turno: en_atencion, etc.)
-- read true por defecto ya estaba migrado desde turnos

-- 3) RLS: tabla turnos -> usar módulo 'agenda' en lugar de 'turnos'
DROP POLICY IF EXISTS "Turnos: alta por permiso" ON public.turnos;
DROP POLICY IF EXISTS "Turnos: baja por permiso" ON public.turnos;
DROP POLICY IF EXISTS "Turnos: lectura por permiso" ON public.turnos;
DROP POLICY IF EXISTS "Turnos: modificacion por permiso" ON public.turnos;

CREATE POLICY "Turnos: lectura por permiso"
ON public.turnos FOR SELECT TO authenticated
USING (has_permission(auth.uid(), 'agenda', 'read'::permission_action));

CREATE POLICY "Turnos: alta por permiso"
ON public.turnos FOR INSERT TO authenticated
WITH CHECK (has_permission(auth.uid(), 'agenda', 'create'::permission_action));

CREATE POLICY "Turnos: baja por permiso"
ON public.turnos FOR DELETE TO authenticated
USING (has_permission(auth.uid(), 'agenda', 'delete'::permission_action));

CREATE POLICY "Turnos: modificacion por permiso"
ON public.turnos FOR UPDATE TO authenticated
USING (
  has_permission(auth.uid(), 'agenda', 'update'::permission_action)
  AND (
    NOT has_role(auth.uid(), 'profesional'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'recepcion'::app_role)
    OR profesional_id IN (SELECT id FROM public.profesionales WHERE user_id = auth.uid())
  )
)
WITH CHECK (
  has_permission(auth.uid(), 'agenda', 'update'::permission_action)
  AND (
    NOT has_role(auth.uid(), 'profesional'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'recepcion'::app_role)
    OR profesional_id IN (SELECT id FROM public.profesionales WHERE user_id = auth.uid())
  )
);

-- 4) RLS: tabla bloqueos_agenda -> usar módulo 'bloqueos_agenda' en lugar de chequear rol
DROP POLICY IF EXISTS "Bloqueos: alta admin/recepcion" ON public.bloqueos_agenda;
DROP POLICY IF EXISTS "Bloqueos: baja admin/recepcion" ON public.bloqueos_agenda;
DROP POLICY IF EXISTS "Bloqueos: lectura autenticados" ON public.bloqueos_agenda;
DROP POLICY IF EXISTS "Bloqueos: modificacion admin/recepcion" ON public.bloqueos_agenda;

CREATE POLICY "Bloqueos: lectura por permiso"
ON public.bloqueos_agenda FOR SELECT TO authenticated
USING (has_permission(auth.uid(), 'bloqueos_agenda', 'read'::permission_action));

CREATE POLICY "Bloqueos: alta por permiso"
ON public.bloqueos_agenda FOR INSERT TO authenticated
WITH CHECK (has_permission(auth.uid(), 'bloqueos_agenda', 'create'::permission_action));

CREATE POLICY "Bloqueos: modificacion por permiso"
ON public.bloqueos_agenda FOR UPDATE TO authenticated
USING (has_permission(auth.uid(), 'bloqueos_agenda', 'update'::permission_action))
WITH CHECK (has_permission(auth.uid(), 'bloqueos_agenda', 'update'::permission_action));

CREATE POLICY "Bloqueos: baja por permiso"
ON public.bloqueos_agenda FOR DELETE TO authenticated
USING (has_permission(auth.uid(), 'bloqueos_agenda', 'delete'::permission_action));
