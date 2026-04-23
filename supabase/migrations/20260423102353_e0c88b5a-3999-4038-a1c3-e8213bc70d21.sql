
-- 1. Enum de acciones
CREATE TYPE public.permission_action AS ENUM ('read','create','update','delete');

-- 2. Tabla role_permissions
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  module text NOT NULL,
  action public.permission_action NOT NULL,
  allowed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, module, action)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "RolePerms: admin gestiona"
  ON public.role_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "RolePerms: lectura autenticados"
  ON public.role_permissions FOR SELECT TO authenticated
  USING (true);

CREATE TRIGGER trg_role_permissions_updated
  BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Función has_permission
CREATE OR REPLACE FUNCTION public.has_permission(_uid uuid, _module text, _action public.permission_action)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    JOIN public.user_roles ur ON ur.role = rp.role
    WHERE ur.user_id = _uid
      AND rp.module = _module
      AND rp.action = _action
      AND rp.allowed = true
  );
$$;

-- 4. Seed de permisos por defecto
-- Admin: todo permitido
INSERT INTO public.role_permissions (role, module, action, allowed)
SELECT 'admin'::public.app_role, m.module, a.action, true
FROM (VALUES
  ('pacientes'),('profesionales'),('turnos'),('atenciones'),
  ('prestaciones'),('obras_sociales'),('cobros'),('presupuestos'),
  ('seguridad_usuarios'),('seguridad_perfiles'),('auditoria'),('reportes')
) AS m(module)
CROSS JOIN (VALUES ('read'::public.permission_action),('create'),('update'),('delete')) AS a(action);

-- Recepción: gestiona pacientes, turnos, prestaciones, obras_sociales, cobros, presupuestos. Atenciones solo lectura. Reportes lectura.
INSERT INTO public.role_permissions (role, module, action, allowed) VALUES
  ('recepcion','pacientes','read',true),('recepcion','pacientes','create',true),('recepcion','pacientes','update',true),('recepcion','pacientes','delete',true),
  ('recepcion','profesionales','read',true),('recepcion','profesionales','create',false),('recepcion','profesionales','update',false),('recepcion','profesionales','delete',false),
  ('recepcion','turnos','read',true),('recepcion','turnos','create',true),('recepcion','turnos','update',true),('recepcion','turnos','delete',true),
  ('recepcion','atenciones','read',true),('recepcion','atenciones','create',false),('recepcion','atenciones','update',false),('recepcion','atenciones','delete',false),
  ('recepcion','prestaciones','read',true),('recepcion','prestaciones','create',true),('recepcion','prestaciones','update',true),('recepcion','prestaciones','delete',true),
  ('recepcion','obras_sociales','read',true),('recepcion','obras_sociales','create',true),('recepcion','obras_sociales','update',true),('recepcion','obras_sociales','delete',true),
  ('recepcion','cobros','read',true),('recepcion','cobros','create',true),('recepcion','cobros','update',true),('recepcion','cobros','delete',true),
  ('recepcion','presupuestos','read',true),('recepcion','presupuestos','create',true),('recepcion','presupuestos','update',true),('recepcion','presupuestos','delete',true),
  ('recepcion','seguridad_usuarios','read',false),('recepcion','seguridad_usuarios','create',false),('recepcion','seguridad_usuarios','update',false),('recepcion','seguridad_usuarios','delete',false),
  ('recepcion','seguridad_perfiles','read',false),('recepcion','seguridad_perfiles','create',false),('recepcion','seguridad_perfiles','update',false),('recepcion','seguridad_perfiles','delete',false),
  ('recepcion','auditoria','read',false),('recepcion','auditoria','create',false),('recepcion','auditoria','update',false),('recepcion','auditoria','delete',false),
  ('recepcion','reportes','read',true),('recepcion','reportes','create',false),('recepcion','reportes','update',false),('recepcion','reportes','delete',false);

-- Profesional: pacientes/turnos solo lectura; atenciones gestiona; resto lectura o nada
INSERT INTO public.role_permissions (role, module, action, allowed) VALUES
  ('profesional','pacientes','read',true),('profesional','pacientes','create',false),('profesional','pacientes','update',false),('profesional','pacientes','delete',false),
  ('profesional','profesionales','read',true),('profesional','profesionales','create',false),('profesional','profesionales','update',false),('profesional','profesionales','delete',false),
  ('profesional','turnos','read',true),('profesional','turnos','create',false),('profesional','turnos','update',true),('profesional','turnos','delete',false),
  ('profesional','atenciones','read',true),('profesional','atenciones','create',true),('profesional','atenciones','update',true),('profesional','atenciones','delete',true),
  ('profesional','prestaciones','read',true),('profesional','prestaciones','create',false),('profesional','prestaciones','update',false),('profesional','prestaciones','delete',false),
  ('profesional','obras_sociales','read',true),('profesional','obras_sociales','create',false),('profesional','obras_sociales','update',false),('profesional','obras_sociales','delete',false),
  ('profesional','cobros','read',false),('profesional','cobros','create',false),('profesional','cobros','update',false),('profesional','cobros','delete',false),
  ('profesional','presupuestos','read',true),('profesional','presupuestos','create',false),('profesional','presupuestos','update',false),('profesional','presupuestos','delete',false),
  ('profesional','seguridad_usuarios','read',false),('profesional','seguridad_usuarios','create',false),('profesional','seguridad_usuarios','update',false),('profesional','seguridad_usuarios','delete',false),
  ('profesional','seguridad_perfiles','read',false),('profesional','seguridad_perfiles','create',false),('profesional','seguridad_perfiles','update',false),('profesional','seguridad_perfiles','delete',false),
  ('profesional','auditoria','read',false),('profesional','auditoria','create',false),('profesional','auditoria','update',false),('profesional','auditoria','delete',false),
  ('profesional','reportes','read',false),('profesional','reportes','create',false),('profesional','reportes','update',false),('profesional','reportes','delete',false);

-- 5. Reescritura RLS de tablas operativas
-- PACIENTES
DROP POLICY IF EXISTS "Pacientes: admin/recepcion gestiona" ON public.pacientes;
DROP POLICY IF EXISTS "Pacientes: lectura autenticados" ON public.pacientes;
CREATE POLICY "Pacientes: lectura por permiso" ON public.pacientes FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'pacientes','read'));
CREATE POLICY "Pacientes: alta por permiso" ON public.pacientes FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(),'pacientes','create'));
CREATE POLICY "Pacientes: modificacion por permiso" ON public.pacientes FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(),'pacientes','update'))
  WITH CHECK (public.has_permission(auth.uid(),'pacientes','update'));
CREATE POLICY "Pacientes: baja por permiso" ON public.pacientes FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(),'pacientes','delete'));

-- PRESTACIONES
DROP POLICY IF EXISTS "Prestaciones: admin/recepcion gestiona" ON public.prestaciones;
DROP POLICY IF EXISTS "Prestaciones: lectura autenticados" ON public.prestaciones;
CREATE POLICY "Prestaciones: lectura por permiso" ON public.prestaciones FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'prestaciones','read'));
CREATE POLICY "Prestaciones: alta por permiso" ON public.prestaciones FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(),'prestaciones','create'));
CREATE POLICY "Prestaciones: modificacion por permiso" ON public.prestaciones FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(),'prestaciones','update'))
  WITH CHECK (public.has_permission(auth.uid(),'prestaciones','update'));
CREATE POLICY "Prestaciones: baja por permiso" ON public.prestaciones FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(),'prestaciones','delete'));

-- OBRAS SOCIALES
DROP POLICY IF EXISTS "ObrasSociales: admin/recepcion gestiona" ON public.obras_sociales;
DROP POLICY IF EXISTS "ObrasSociales: lectura autenticados" ON public.obras_sociales;
CREATE POLICY "ObrasSociales: lectura por permiso" ON public.obras_sociales FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'obras_sociales','read'));
CREATE POLICY "ObrasSociales: alta por permiso" ON public.obras_sociales FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(),'obras_sociales','create'));
CREATE POLICY "ObrasSociales: modificacion por permiso" ON public.obras_sociales FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(),'obras_sociales','update'))
  WITH CHECK (public.has_permission(auth.uid(),'obras_sociales','update'));
CREATE POLICY "ObrasSociales: baja por permiso" ON public.obras_sociales FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(),'obras_sociales','delete'));

-- COBROS
DROP POLICY IF EXISTS "Cobros: admin/recepcion gestiona" ON public.cobros;
DROP POLICY IF EXISTS "Cobros: lectura autenticados" ON public.cobros;
CREATE POLICY "Cobros: lectura por permiso" ON public.cobros FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'cobros','read'));
CREATE POLICY "Cobros: alta por permiso" ON public.cobros FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(),'cobros','create'));
CREATE POLICY "Cobros: modificacion por permiso" ON public.cobros FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(),'cobros','update'))
  WITH CHECK (public.has_permission(auth.uid(),'cobros','update'));
CREATE POLICY "Cobros: baja por permiso" ON public.cobros FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(),'cobros','delete'));

-- COBRO_APLICACIONES (mismo permiso que cobros)
DROP POLICY IF EXISTS "CAplic: admin/recepcion gestiona" ON public.cobro_aplicaciones;
DROP POLICY IF EXISTS "CAplic: lectura autenticados" ON public.cobro_aplicaciones;
CREATE POLICY "CAplic: lectura por permiso" ON public.cobro_aplicaciones FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'cobros','read'));
CREATE POLICY "CAplic: alta por permiso" ON public.cobro_aplicaciones FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(),'cobros','create'));
CREATE POLICY "CAplic: modificacion por permiso" ON public.cobro_aplicaciones FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(),'cobros','update'))
  WITH CHECK (public.has_permission(auth.uid(),'cobros','update'));
CREATE POLICY "CAplic: baja por permiso" ON public.cobro_aplicaciones FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(),'cobros','delete'));

-- PRESUPUESTOS
DROP POLICY IF EXISTS "Presupuestos: admin/recepcion gestiona" ON public.presupuestos;
DROP POLICY IF EXISTS "Presupuestos: lectura autenticados" ON public.presupuestos;
CREATE POLICY "Presupuestos: lectura por permiso" ON public.presupuestos FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'presupuestos','read'));
CREATE POLICY "Presupuestos: alta por permiso" ON public.presupuestos FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(),'presupuestos','create'));
CREATE POLICY "Presupuestos: modificacion por permiso" ON public.presupuestos FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(),'presupuestos','update'))
  WITH CHECK (public.has_permission(auth.uid(),'presupuestos','update'));
CREATE POLICY "Presupuestos: baja por permiso" ON public.presupuestos FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(),'presupuestos','delete'));

-- PRESUPUESTO_DETALLE
DROP POLICY IF EXISTS "PDetalle: admin/recepcion gestiona" ON public.presupuesto_detalle;
DROP POLICY IF EXISTS "PDetalle: lectura autenticados" ON public.presupuesto_detalle;
CREATE POLICY "PDetalle: lectura por permiso" ON public.presupuesto_detalle FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'presupuestos','read'));
CREATE POLICY "PDetalle: alta por permiso" ON public.presupuesto_detalle FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(),'presupuestos','create'));
CREATE POLICY "PDetalle: modificacion por permiso" ON public.presupuesto_detalle FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(),'presupuestos','update'))
  WITH CHECK (public.has_permission(auth.uid(),'presupuestos','update'));
CREATE POLICY "PDetalle: baja por permiso" ON public.presupuesto_detalle FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(),'presupuestos','delete'));

-- TURNOS
DROP POLICY IF EXISTS "Turnos: admin/recepcion gestiona" ON public.turnos;
DROP POLICY IF EXISTS "Turnos: lectura autenticados" ON public.turnos;
DROP POLICY IF EXISTS "Turnos: profesional actualiza los suyos" ON public.turnos;
CREATE POLICY "Turnos: lectura por permiso" ON public.turnos FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'turnos','read'));
CREATE POLICY "Turnos: alta por permiso" ON public.turnos FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(),'turnos','create'));
CREATE POLICY "Turnos: modificacion por permiso" ON public.turnos FOR UPDATE TO authenticated
  USING (
    public.has_permission(auth.uid(),'turnos','update')
    AND (
      NOT public.has_role(auth.uid(),'profesional')
      OR public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'recepcion')
      OR profesional_id IN (SELECT id FROM public.profesionales WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    public.has_permission(auth.uid(),'turnos','update')
    AND (
      NOT public.has_role(auth.uid(),'profesional')
      OR public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'recepcion')
      OR profesional_id IN (SELECT id FROM public.profesionales WHERE user_id = auth.uid())
    )
  );
CREATE POLICY "Turnos: baja por permiso" ON public.turnos FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(),'turnos','delete'));

-- ATENCIONES
DROP POLICY IF EXISTS "Atenciones: admin gestiona" ON public.atenciones;
DROP POLICY IF EXISTS "Atenciones: lectura autenticados" ON public.atenciones;
DROP POLICY IF EXISTS "Atenciones: profesional gestiona las suyas" ON public.atenciones;
CREATE POLICY "Atenciones: lectura por permiso" ON public.atenciones FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'atenciones','read'));
CREATE POLICY "Atenciones: alta por permiso" ON public.atenciones FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission(auth.uid(),'atenciones','create')
    AND (
      NOT public.has_role(auth.uid(),'profesional')
      OR public.has_role(auth.uid(),'admin')
      OR profesional_id IN (SELECT id FROM public.profesionales WHERE user_id = auth.uid())
    )
  );
CREATE POLICY "Atenciones: modificacion por permiso" ON public.atenciones FOR UPDATE TO authenticated
  USING (
    public.has_permission(auth.uid(),'atenciones','update')
    AND (
      NOT public.has_role(auth.uid(),'profesional')
      OR public.has_role(auth.uid(),'admin')
      OR profesional_id IN (SELECT id FROM public.profesionales WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    public.has_permission(auth.uid(),'atenciones','update')
    AND (
      NOT public.has_role(auth.uid(),'profesional')
      OR public.has_role(auth.uid(),'admin')
      OR profesional_id IN (SELECT id FROM public.profesionales WHERE user_id = auth.uid())
    )
  );
CREATE POLICY "Atenciones: baja por permiso" ON public.atenciones FOR DELETE TO authenticated
  USING (
    public.has_permission(auth.uid(),'atenciones','delete')
    AND (
      NOT public.has_role(auth.uid(),'profesional')
      OR public.has_role(auth.uid(),'admin')
      OR profesional_id IN (SELECT id FROM public.profesionales WHERE user_id = auth.uid())
    )
  );

-- ATENCION_PRACTICAS
DROP POLICY IF EXISTS "AtPract: admin gestiona" ON public.atencion_practicas;
DROP POLICY IF EXISTS "AtPract: lectura autenticados" ON public.atencion_practicas;
DROP POLICY IF EXISTS "AtPract: profesional gestiona las suyas" ON public.atencion_practicas;
DROP POLICY IF EXISTS "AtPract: recepcion gestiona" ON public.atencion_practicas;
CREATE POLICY "AtPract: lectura por permiso" ON public.atencion_practicas FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'atenciones','read'));
CREATE POLICY "AtPract: alta por permiso" ON public.atencion_practicas FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission(auth.uid(),'atenciones','create')
    AND (
      NOT public.has_role(auth.uid(),'profesional')
      OR public.has_role(auth.uid(),'admin')
      OR atencion_id IN (
        SELECT a.id FROM public.atenciones a
        JOIN public.profesionales p ON p.id = a.profesional_id
        WHERE p.user_id = auth.uid()
      )
    )
  );
CREATE POLICY "AtPract: modificacion por permiso" ON public.atencion_practicas FOR UPDATE TO authenticated
  USING (
    public.has_permission(auth.uid(),'atenciones','update')
    AND (
      NOT public.has_role(auth.uid(),'profesional')
      OR public.has_role(auth.uid(),'admin')
      OR atencion_id IN (
        SELECT a.id FROM public.atenciones a
        JOIN public.profesionales p ON p.id = a.profesional_id
        WHERE p.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    public.has_permission(auth.uid(),'atenciones','update')
    AND (
      NOT public.has_role(auth.uid(),'profesional')
      OR public.has_role(auth.uid(),'admin')
      OR atencion_id IN (
        SELECT a.id FROM public.atenciones a
        JOIN public.profesionales p ON p.id = a.profesional_id
        WHERE p.user_id = auth.uid()
      )
    )
  );
CREATE POLICY "AtPract: baja por permiso" ON public.atencion_practicas FOR DELETE TO authenticated
  USING (
    public.has_permission(auth.uid(),'atenciones','delete')
    AND (
      NOT public.has_role(auth.uid(),'profesional')
      OR public.has_role(auth.uid(),'admin')
      OR atencion_id IN (
        SELECT a.id FROM public.atenciones a
        JOIN public.profesionales p ON p.id = a.profesional_id
        WHERE p.user_id = auth.uid()
      )
    )
  );
