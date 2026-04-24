-- 1) RLS más estrictas en bloqueos_agenda: profesional solo puede gestionar SU propia agenda
DROP POLICY IF EXISTS "Bloqueos: alta por permiso" ON public.bloqueos_agenda;
DROP POLICY IF EXISTS "Bloqueos: modificacion por permiso" ON public.bloqueos_agenda;
DROP POLICY IF EXISTS "Bloqueos: baja por permiso" ON public.bloqueos_agenda;

CREATE POLICY "Bloqueos: alta por permiso"
ON public.bloqueos_agenda FOR INSERT TO authenticated
WITH CHECK (
  has_permission(auth.uid(), 'bloqueos_agenda', 'create'::permission_action)
  AND (
    NOT has_role(auth.uid(), 'profesional'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'recepcion'::app_role)
    OR profesional_id IN (SELECT id FROM public.profesionales WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Bloqueos: modificacion por permiso"
ON public.bloqueos_agenda FOR UPDATE TO authenticated
USING (
  has_permission(auth.uid(), 'bloqueos_agenda', 'update'::permission_action)
  AND (
    NOT has_role(auth.uid(), 'profesional'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'recepcion'::app_role)
    OR profesional_id IN (SELECT id FROM public.profesionales WHERE user_id = auth.uid())
  )
)
WITH CHECK (
  has_permission(auth.uid(), 'bloqueos_agenda', 'update'::permission_action)
  AND (
    NOT has_role(auth.uid(), 'profesional'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'recepcion'::app_role)
    OR profesional_id IN (SELECT id FROM public.profesionales WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Bloqueos: baja por permiso"
ON public.bloqueos_agenda FOR DELETE TO authenticated
USING (
  has_permission(auth.uid(), 'bloqueos_agenda', 'delete'::permission_action)
  AND (
    NOT has_role(auth.uid(), 'profesional'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'recepcion'::app_role)
    OR profesional_id IN (SELECT id FROM public.profesionales WHERE user_id = auth.uid())
  )
);

-- 2) Permitir UPDATE de atenciones al perfil profesional (la UI restringirá qué campos puede tocar)
INSERT INTO public.role_permissions (role, module, action, allowed)
VALUES ('profesional'::app_role, 'atenciones', 'update'::permission_action, true)
ON CONFLICT (role, module, action) DO UPDATE SET allowed = true, updated_at = now();