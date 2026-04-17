-- ============================================================
-- Módulo de Seguridad: Auditoría e intentos de login
-- ============================================================

-- 1) Tabla de intentos de login
CREATE TABLE public.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  user_id UUID,
  exitoso BOOLEAN NOT NULL,
  motivo TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_login_attempts_email ON public.login_attempts (email);
CREATE INDEX idx_login_attempts_created_at ON public.login_attempts (created_at DESC);
CREATE INDEX idx_login_attempts_user_id ON public.login_attempts (user_id);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Cualquier autenticado puede insertar (registrar su intento) y anónimo también lo necesita pero
-- como se invoca desde el cliente tras intentar signIn lo permitimos a anon también.
CREATE POLICY "LoginAttempts: insert publico"
ON public.login_attempts
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "LoginAttempts: admin lee todo"
ON public.login_attempts
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) Tabla de auditoría
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_email TEXT,
  accion TEXT NOT NULL,           -- INSERT, UPDATE, DELETE, LOGIN, LOGOUT, ROLE_CHANGE, PASSWORD_CHANGE
  entidad TEXT NOT NULL,          -- pacientes, profesionales, turnos, atenciones, user_roles, auth, etc.
  entidad_id UUID,
  descripcion TEXT,
  datos_anteriores JSONB,
  datos_nuevos JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_user_id ON public.audit_log (user_id);
CREATE INDEX idx_audit_log_entidad ON public.audit_log (entidad);
CREATE INDEX idx_audit_log_accion ON public.audit_log (accion);
CREATE INDEX idx_audit_log_created_at ON public.audit_log (created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Sólo admin puede leer toda la auditoría
CREATE POLICY "AuditLog: admin lee todo"
ON public.audit_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Inserts solo desde triggers (security definer) o desde authenticated explícitos (logout/password)
CREATE POLICY "AuditLog: authenticated puede insertar el suyo"
ON public.audit_log
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 3) Función helper para insertar audit desde la app (logout, password change)
CREATE OR REPLACE FUNCTION public.log_audit_event(
  _accion TEXT,
  _entidad TEXT,
  _entidad_id UUID DEFAULT NULL,
  _descripcion TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id UUID;
  _email TEXT;
BEGIN
  SELECT email INTO _email FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.audit_log (user_id, user_email, accion, entidad, entidad_id, descripcion)
  VALUES (auth.uid(), _email, _accion, _entidad, _entidad_id, _descripcion)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

-- 4) Función trigger genérica para auditar tablas
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email TEXT;
  _entidad_id UUID;
  _old JSONB;
  _new JSONB;
BEGIN
  SELECT email INTO _email FROM auth.users WHERE id = auth.uid();

  IF TG_OP = 'DELETE' THEN
    _entidad_id := (row_to_json(OLD)::jsonb ->> 'id')::uuid;
    _old := row_to_json(OLD)::jsonb;
    _new := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    _entidad_id := (row_to_json(NEW)::jsonb ->> 'id')::uuid;
    _old := row_to_json(OLD)::jsonb;
    _new := row_to_json(NEW)::jsonb;
  ELSE
    _entidad_id := (row_to_json(NEW)::jsonb ->> 'id')::uuid;
    _old := NULL;
    _new := row_to_json(NEW)::jsonb;
  END IF;

  INSERT INTO public.audit_log (
    user_id, user_email, accion, entidad, entidad_id, datos_anteriores, datos_nuevos
  ) VALUES (
    auth.uid(), _email, TG_OP, TG_TABLE_NAME, _entidad_id, _old, _new
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- 5) Triggers en entidades sensibles
CREATE TRIGGER audit_pacientes
AFTER INSERT OR UPDATE OR DELETE ON public.pacientes
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_profesionales
AFTER INSERT OR UPDATE OR DELETE ON public.profesionales
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_turnos
AFTER INSERT OR UPDATE OR DELETE ON public.turnos
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_atenciones
AFTER INSERT OR UPDATE OR DELETE ON public.atenciones
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_user_roles
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_obras_sociales
AFTER INSERT OR UPDATE OR DELETE ON public.obras_sociales
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- 6) Política para que recepción/profesional vea SU PROPIO audit (acciones que él hizo) — opcional
CREATE POLICY "AuditLog: usuario ve los suyos"
ON public.audit_log
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
