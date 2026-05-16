
-- ============ Integraciones externas ============
CREATE TABLE public.integraciones_externas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  activa BOOLEAN NOT NULL DEFAULT true,
  url TEXT NOT NULL DEFAULT '',
  logo_url TEXT,
  abrir_nueva_pestana BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.integraciones_externas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Integraciones: lectura autenticados"
  ON public.integraciones_externas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Integraciones: admin gestiona"
  ON public.integraciones_externas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_integraciones_updated_at
  BEFORE UPDATE ON public.integraciones_externas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.integraciones_externas (codigo, nombre, url, activa, abrir_nueva_pestana)
VALUES ('rcta', 'RCTA', 'https://www.rcta.me/', true, true);

-- ============ Recetas externas ============
CREATE TABLE public.recetas_externas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atencion_id UUID NOT NULL REFERENCES public.atenciones(id) ON DELETE CASCADE,
  paciente_id UUID NOT NULL,
  profesional_id UUID NOT NULL,
  integracion_codigo TEXT NOT NULL DEFAULT 'rcta',
  numero_receta TEXT,
  link TEXT,
  archivo_url TEXT,
  observaciones TEXT,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recetas_externas_atencion ON public.recetas_externas(atencion_id);
CREATE INDEX idx_recetas_externas_paciente ON public.recetas_externas(paciente_id);

ALTER TABLE public.recetas_externas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "RecetasExt: lectura por permiso"
  ON public.recetas_externas FOR SELECT TO authenticated
  USING (has_permission(auth.uid(), 'recetas_externas'::text, 'read'::permission_action));

CREATE POLICY "RecetasExt: alta por permiso"
  ON public.recetas_externas FOR INSERT TO authenticated
  WITH CHECK (has_permission(auth.uid(), 'recetas_externas'::text, 'create'::permission_action));

CREATE POLICY "RecetasExt: modificacion por permiso"
  ON public.recetas_externas FOR UPDATE TO authenticated
  USING (has_permission(auth.uid(), 'recetas_externas'::text, 'update'::permission_action))
  WITH CHECK (has_permission(auth.uid(), 'recetas_externas'::text, 'update'::permission_action));

CREATE POLICY "RecetasExt: baja por permiso"
  ON public.recetas_externas FOR DELETE TO authenticated
  USING (has_permission(auth.uid(), 'recetas_externas'::text, 'delete'::permission_action));

CREATE TRIGGER trg_recetas_externas_updated_at
  BEFORE UPDATE ON public.recetas_externas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Permisos ============
INSERT INTO public.role_permissions (role, module, action, allowed) VALUES
  ('admin'::app_role,       'recetas_externas', 'read'::permission_action,   true),
  ('admin'::app_role,       'recetas_externas', 'create'::permission_action, true),
  ('admin'::app_role,       'recetas_externas', 'update'::permission_action, true),
  ('admin'::app_role,       'recetas_externas', 'delete'::permission_action, true),
  ('profesional'::app_role, 'recetas_externas', 'read'::permission_action,   true),
  ('profesional'::app_role, 'recetas_externas', 'create'::permission_action, true),
  ('profesional'::app_role, 'recetas_externas', 'update'::permission_action, true),
  ('recepcion'::app_role,   'recetas_externas', 'read'::permission_action,   true)
ON CONFLICT DO NOTHING;

-- ============ Storage buckets ============
INSERT INTO storage.buckets (id, name, public) VALUES ('integraciones-logos', 'integraciones-logos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) VALUES ('recetas-externas', 'recetas-externas', false)
ON CONFLICT (id) DO NOTHING;

-- Logos integraciones: lectura publica, admin escribe
CREATE POLICY "IntegLogos: lectura publica"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'integraciones-logos');

CREATE POLICY "IntegLogos: admin escribe"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'integraciones-logos' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "IntegLogos: admin actualiza"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'integraciones-logos' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "IntegLogos: admin borra"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'integraciones-logos' AND has_role(auth.uid(), 'admin'::app_role));

-- Recetas externas: lectura autenticados, escritura con permiso de modulo recetas_externas
CREATE POLICY "RecetasFiles: lectura autenticados"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'recetas-externas');

CREATE POLICY "RecetasFiles: alta con permiso"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'recetas-externas' AND has_permission(auth.uid(), 'recetas_externas'::text, 'create'::permission_action));

CREATE POLICY "RecetasFiles: borra con permiso"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'recetas-externas' AND has_permission(auth.uid(), 'recetas_externas'::text, 'delete'::permission_action));
