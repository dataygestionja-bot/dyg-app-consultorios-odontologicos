-- 1. Columna foto_url
ALTER TABLE public.profesionales ADD COLUMN IF NOT EXISTS foto_url text;

-- 2. Bucket público
INSERT INTO storage.buckets (id, name, public)
VALUES ('profesionales-fotos', 'profesionales-fotos', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Políticas RLS sobre storage.objects
CREATE POLICY "ProfFotos: lectura publica"
ON storage.objects FOR SELECT
USING (bucket_id = 'profesionales-fotos');

CREATE POLICY "ProfFotos: admin sube"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'profesionales-fotos' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "ProfFotos: admin actualiza"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'profesionales-fotos' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "ProfFotos: admin borra"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'profesionales-fotos' AND has_role(auth.uid(), 'admin'::app_role));