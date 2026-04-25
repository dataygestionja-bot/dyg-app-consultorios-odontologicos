CREATE TABLE public.whatsapp_respuestas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telefono text NOT NULL,
  mensaje text,
  message_sid text,
  accion_detectada text,
  turno_id uuid REFERENCES public.turnos(id) ON DELETE SET NULL,
  fecha_recepcion timestamp with time zone NOT NULL DEFAULT now(),
  resultado text
);

CREATE INDEX idx_whatsapp_respuestas_telefono ON public.whatsapp_respuestas(telefono);
CREATE INDEX idx_whatsapp_respuestas_fecha ON public.whatsapp_respuestas(fecha_recepcion DESC);

ALTER TABLE public.whatsapp_respuestas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "WhatsAppResp: admin lee todo"
ON public.whatsapp_respuestas
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));