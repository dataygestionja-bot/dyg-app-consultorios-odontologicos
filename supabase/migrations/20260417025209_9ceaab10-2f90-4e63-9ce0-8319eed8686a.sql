-- ===== ENUMS =====
CREATE TYPE public.presupuesto_estado AS ENUM (
  'borrador', 'entregado', 'aceptado', 'rechazado', 'parcialmente_ejecutado', 'finalizado'
);

CREATE TYPE public.medio_pago AS ENUM (
  'efectivo', 'transferencia', 'debito', 'credito', 'mercadopago', 'otro'
);

-- ===== PRESTACIONES =====
CREATE TABLE public.prestaciones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  descripcion TEXT NOT NULL,
  categoria TEXT,
  precio_base NUMERIC(12,2) NOT NULL DEFAULT 0,
  duracion_estimada_min INTEGER NOT NULL DEFAULT 30,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.prestaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Prestaciones: lectura autenticados" ON public.prestaciones
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Prestaciones: admin/recepcion gestiona" ON public.prestaciones
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'recepcion'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'recepcion'));

CREATE TRIGGER update_prestaciones_updated_at
  BEFORE UPDATE ON public.prestaciones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER audit_prestaciones
  AFTER INSERT OR UPDATE OR DELETE ON public.prestaciones
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- ===== PRESUPUESTOS =====
CREATE TABLE public.presupuestos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE RESTRICT,
  profesional_id UUID REFERENCES public.profesionales(id) ON DELETE SET NULL,
  estado public.presupuesto_estado NOT NULL DEFAULT 'borrador',
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  observaciones TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_presupuestos_paciente ON public.presupuestos(paciente_id);
CREATE INDEX idx_presupuestos_estado ON public.presupuestos(estado);

ALTER TABLE public.presupuestos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Presupuestos: lectura autenticados" ON public.presupuestos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Presupuestos: admin/recepcion gestiona" ON public.presupuestos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'recepcion'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'recepcion'));

CREATE TRIGGER update_presupuestos_updated_at
  BEFORE UPDATE ON public.presupuestos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER audit_presupuestos
  AFTER INSERT OR UPDATE OR DELETE ON public.presupuestos
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- ===== PRESUPUESTO DETALLE =====
CREATE TABLE public.presupuesto_detalle (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  presupuesto_id UUID NOT NULL REFERENCES public.presupuestos(id) ON DELETE CASCADE,
  prestacion_id UUID NOT NULL REFERENCES public.prestaciones(id) ON DELETE RESTRICT,
  pieza_dental TEXT,
  cantidad INTEGER NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  precio_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pdet_presupuesto ON public.presupuesto_detalle(presupuesto_id);

ALTER TABLE public.presupuesto_detalle ENABLE ROW LEVEL SECURITY;

CREATE POLICY "PDetalle: lectura autenticados" ON public.presupuesto_detalle
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "PDetalle: admin/recepcion gestiona" ON public.presupuesto_detalle
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'recepcion'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'recepcion'));

CREATE TRIGGER audit_presupuesto_detalle
  AFTER INSERT OR UPDATE OR DELETE ON public.presupuesto_detalle
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- Recalcular total del presupuesto
CREATE OR REPLACE FUNCTION public.recalc_presupuesto_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pid UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _pid := OLD.presupuesto_id;
  ELSE
    _pid := NEW.presupuesto_id;
  END IF;

  UPDATE public.presupuestos
  SET total = COALESCE((SELECT SUM(subtotal) FROM public.presupuesto_detalle WHERE presupuesto_id = _pid), 0),
      updated_at = now()
  WHERE id = _pid;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER recalc_total_presupuesto
  AFTER INSERT OR UPDATE OR DELETE ON public.presupuesto_detalle
  FOR EACH ROW EXECUTE FUNCTION public.recalc_presupuesto_total();

-- ===== COBROS =====
CREATE TABLE public.cobros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE RESTRICT,
  importe NUMERIC(12,2) NOT NULL CHECK (importe > 0),
  medio_pago public.medio_pago NOT NULL DEFAULT 'efectivo',
  referencia TEXT,
  observaciones TEXT,
  usuario_registro UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cobros_paciente ON public.cobros(paciente_id);
CREATE INDEX idx_cobros_fecha ON public.cobros(fecha);

ALTER TABLE public.cobros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cobros: lectura autenticados" ON public.cobros
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Cobros: admin/recepcion gestiona" ON public.cobros
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'recepcion'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'recepcion'));

CREATE TRIGGER update_cobros_updated_at
  BEFORE UPDATE ON public.cobros
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER audit_cobros
  AFTER INSERT OR UPDATE OR DELETE ON public.cobros
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- ===== COBRO APLICACIONES =====
CREATE TABLE public.cobro_aplicaciones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cobro_id UUID NOT NULL REFERENCES public.cobros(id) ON DELETE CASCADE,
  presupuesto_id UUID REFERENCES public.presupuestos(id) ON DELETE RESTRICT,
  atencion_id UUID REFERENCES public.atenciones(id) ON DELETE RESTRICT,
  importe_aplicado NUMERIC(12,2) NOT NULL CHECK (importe_aplicado > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_aplicacion_target CHECK (
    (presupuesto_id IS NOT NULL AND atencion_id IS NULL) OR
    (presupuesto_id IS NULL AND atencion_id IS NOT NULL)
  )
);

CREATE INDEX idx_capl_cobro ON public.cobro_aplicaciones(cobro_id);
CREATE INDEX idx_capl_presupuesto ON public.cobro_aplicaciones(presupuesto_id);
CREATE INDEX idx_capl_atencion ON public.cobro_aplicaciones(atencion_id);

ALTER TABLE public.cobro_aplicaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CAplic: lectura autenticados" ON public.cobro_aplicaciones
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "CAplic: admin/recepcion gestiona" ON public.cobro_aplicaciones
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'recepcion'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'recepcion'));

CREATE TRIGGER audit_cobro_aplicaciones
  AFTER INSERT OR UPDATE OR DELETE ON public.cobro_aplicaciones
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();