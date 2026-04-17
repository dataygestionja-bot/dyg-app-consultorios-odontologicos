-- 1) Agregar campo proxima_visita_sugerida a atenciones
ALTER TABLE public.atenciones
  ADD COLUMN IF NOT EXISTS proxima_visita_sugerida date;

-- 2) Crear tabla atencion_practicas
CREATE TABLE IF NOT EXISTS public.atencion_practicas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atencion_id uuid NOT NULL REFERENCES public.atenciones(id) ON DELETE CASCADE,
  prestacion_id uuid NOT NULL REFERENCES public.prestaciones(id) ON DELETE RESTRICT,
  pieza_dental text,
  cara_dental text,
  cantidad integer NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  observacion text,
  orden integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_atencion_practicas_atencion ON public.atencion_practicas(atencion_id);
CREATE INDEX IF NOT EXISTS idx_atencion_practicas_prestacion ON public.atencion_practicas(prestacion_id);

-- 3) RLS
ALTER TABLE public.atencion_practicas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "AtPract: lectura autenticados"
  ON public.atencion_practicas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "AtPract: admin gestiona"
  ON public.atencion_practicas FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "AtPract: recepcion gestiona"
  ON public.atencion_practicas FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'recepcion'::app_role))
  WITH CHECK (has_role(auth.uid(), 'recepcion'::app_role));

CREATE POLICY "AtPract: profesional gestiona las suyas"
  ON public.atencion_practicas FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'profesional'::app_role)
    AND atencion_id IN (
      SELECT a.id FROM public.atenciones a
      JOIN public.profesionales p ON p.id = a.profesional_id
      WHERE p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'profesional'::app_role)
    AND atencion_id IN (
      SELECT a.id FROM public.atenciones a
      JOIN public.profesionales p ON p.id = a.profesional_id
      WHERE p.user_id = auth.uid()
    )
  );

-- 4) Trigger updated_at
DROP TRIGGER IF EXISTS trg_atencion_practicas_updated_at ON public.atencion_practicas;
CREATE TRIGGER trg_atencion_practicas_updated_at
  BEFORE UPDATE ON public.atencion_practicas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Auditoría
DROP TRIGGER IF EXISTS trg_atencion_practicas_audit ON public.atencion_practicas;
CREATE TRIGGER trg_atencion_practicas_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.atencion_practicas
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();