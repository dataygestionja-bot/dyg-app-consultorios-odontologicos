
-- Tabla para documentación adicional adjunta a una atención
CREATE TABLE public.atencion_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atencion_id uuid NOT NULL REFERENCES public.atenciones(id) ON DELETE CASCADE,
  referencia text NOT NULL,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  archivo_path text NOT NULL,
  archivo_nombre text NOT NULL,
  archivo_mime text,
  archivo_size bigint,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_atencion_documentos_atencion ON public.atencion_documentos(atencion_id);

ALTER TABLE public.atencion_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "AtencionDocs: lectura por permiso"
ON public.atencion_documentos FOR SELECT TO authenticated
USING (has_permission(auth.uid(), 'atenciones', 'read'::permission_action));

CREATE POLICY "AtencionDocs: alta por permiso"
ON public.atencion_documentos FOR INSERT TO authenticated
WITH CHECK (has_permission(auth.uid(), 'atenciones', 'create'::permission_action));

CREATE POLICY "AtencionDocs: modificacion por permiso"
ON public.atencion_documentos FOR UPDATE TO authenticated
USING (has_permission(auth.uid(), 'atenciones', 'update'::permission_action))
WITH CHECK (has_permission(auth.uid(), 'atenciones', 'update'::permission_action));

CREATE POLICY "AtencionDocs: baja por permiso"
ON public.atencion_documentos FOR DELETE TO authenticated
USING (has_permission(auth.uid(), 'atenciones', 'delete'::permission_action));

CREATE TRIGGER trg_atencion_documentos_updated_at
BEFORE UPDATE ON public.atencion_documentos
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Bucket privado para los archivos
INSERT INTO storage.buckets (id, name, public)
VALUES ('atencion-documentos', 'atencion-documentos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "AtencionDocsFiles: lectura autenticados"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'atencion-documentos');

CREATE POLICY "AtencionDocsFiles: alta con permiso"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'atencion-documentos'
  AND has_permission(auth.uid(), 'atenciones', 'create'::permission_action)
);

CREATE POLICY "AtencionDocsFiles: borra con permiso"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'atencion-documentos'
  AND has_permission(auth.uid(), 'atenciones', 'delete'::permission_action)
);
