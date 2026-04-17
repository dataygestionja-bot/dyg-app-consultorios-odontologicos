
-- ==========================================
-- ENUMS
-- ==========================================
CREATE TYPE public.app_role AS ENUM ('admin', 'recepcion', 'profesional');
CREATE TYPE public.turno_estado AS ENUM ('reservado', 'confirmado', 'atendido', 'cancelado', 'ausente', 'reprogramado');

-- ==========================================
-- EXTENSIONS
-- ==========================================
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ==========================================
-- UPDATED_AT helper
-- ==========================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ==========================================
-- PROFILES
-- ==========================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT,
  apellido TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- USER ROLES
-- ==========================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role (security definer, evita recursión RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ==========================================
-- HANDLE NEW USER (trigger en auth.users)
-- Primer usuario => admin, resto => recepcion
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_first BOOLEAN;
  _role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, nombre, apellido, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'nombre',
    NEW.raw_user_meta_data ->> 'apellido',
    NEW.email
  );

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO _is_first;
  IF _is_first THEN
    _role := 'admin';
  ELSE
    _role := 'recepcion';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- POLICIES: profiles
-- ==========================================
CREATE POLICY "Profiles: usuario ve el suyo"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Profiles: admin ve todos"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Profiles: usuario actualiza el suyo"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Profiles: admin actualiza todos"
  ON public.profiles FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- ==========================================
-- POLICIES: user_roles
-- ==========================================
CREATE POLICY "UserRoles: usuario ve los suyos"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "UserRoles: admin ve todos"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "UserRoles: admin gestiona"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ==========================================
-- OBRAS SOCIALES
-- ==========================================
CREATE TABLE public.obras_sociales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.obras_sociales ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_obras_sociales_updated
BEFORE UPDATE ON public.obras_sociales
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "ObrasSociales: lectura autenticados"
  ON public.obras_sociales FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "ObrasSociales: admin/recepcion gestiona"
  ON public.obras_sociales FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'recepcion'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'recepcion'));

-- ==========================================
-- PACIENTES
-- ==========================================
CREATE TABLE public.pacientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  dni TEXT NOT NULL UNIQUE,
  telefono TEXT,
  email TEXT,
  fecha_nacimiento DATE,
  obra_social_id UUID REFERENCES public.obras_sociales(id) ON DELETE SET NULL,
  numero_afiliado TEXT,
  domicilio TEXT,
  localidad TEXT,
  contacto_emergencia_nombre TEXT,
  contacto_emergencia_telefono TEXT,
  alergias TEXT,
  medicacion_actual TEXT,
  antecedentes_medicos TEXT,
  observaciones TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_pacientes_apellido ON public.pacientes (apellido);
CREATE INDEX idx_pacientes_dni ON public.pacientes (dni);

CREATE TRIGGER trg_pacientes_updated
BEFORE UPDATE ON public.pacientes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Pacientes: lectura autenticados"
  ON public.pacientes FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Pacientes: admin/recepcion gestiona"
  ON public.pacientes FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'recepcion'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'recepcion'));

-- ==========================================
-- PROFESIONALES
-- ==========================================
CREATE TABLE public.profesionales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  matricula TEXT,
  especialidad TEXT,
  telefono TEXT,
  email TEXT,
  color_agenda TEXT NOT NULL DEFAULT '#3b82f6',
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE public.profesionales ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_profesionales_updated
BEFORE UPDATE ON public.profesionales
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Profesionales: lectura autenticados"
  ON public.profesionales FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Profesionales: admin gestiona"
  ON public.profesionales FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ==========================================
-- HORARIOS PROFESIONAL
-- ==========================================
CREATE TABLE public.horarios_profesional (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profesional_id UUID NOT NULL REFERENCES public.profesionales(id) ON DELETE CASCADE,
  dia_semana SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  duracion_slot_min INTEGER NOT NULL DEFAULT 30 CHECK (duracion_slot_min > 0),
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (hora_fin > hora_inicio)
);
ALTER TABLE public.horarios_profesional ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_horarios_prof ON public.horarios_profesional (profesional_id, dia_semana);

CREATE POLICY "Horarios: lectura autenticados"
  ON public.horarios_profesional FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Horarios: admin gestiona"
  ON public.horarios_profesional FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ==========================================
-- TURNOS
-- ==========================================
CREATE TABLE public.turnos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE RESTRICT,
  profesional_id UUID NOT NULL REFERENCES public.profesionales(id) ON DELETE RESTRICT,
  fecha DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  motivo_consulta TEXT,
  estado public.turno_estado NOT NULL DEFAULT 'reservado',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (hora_fin > hora_inicio)
);
ALTER TABLE public.turnos ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_turnos_fecha ON public.turnos (fecha);
CREATE INDEX idx_turnos_prof_fecha ON public.turnos (profesional_id, fecha);
CREATE INDEX idx_turnos_paciente ON public.turnos (paciente_id);

-- Constraint: impedir superposición del mismo profesional en estados activos
ALTER TABLE public.turnos
  ADD CONSTRAINT turnos_no_overlap
  EXCLUDE USING gist (
    profesional_id WITH =,
    fecha WITH =,
    tsrange(
      (fecha + hora_inicio)::timestamp,
      (fecha + hora_fin)::timestamp,
      '[)'
    ) WITH &&
  )
  WHERE (estado IN ('reservado', 'confirmado', 'atendido'));

CREATE TRIGGER trg_turnos_updated
BEFORE UPDATE ON public.turnos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Turnos: lectura autenticados"
  ON public.turnos FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Turnos: admin/recepcion gestiona"
  ON public.turnos FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'recepcion'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'recepcion'));

-- Profesional puede actualizar el estado de sus propios turnos
CREATE POLICY "Turnos: profesional actualiza los suyos"
  ON public.turnos FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'profesional')
    AND profesional_id IN (SELECT id FROM public.profesionales WHERE user_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'profesional')
    AND profesional_id IN (SELECT id FROM public.profesionales WHERE user_id = auth.uid())
  );

-- ==========================================
-- ATENCIONES
-- ==========================================
CREATE TABLE public.atenciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turno_id UUID REFERENCES public.turnos(id) ON DELETE SET NULL,
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE RESTRICT,
  profesional_id UUID NOT NULL REFERENCES public.profesionales(id) ON DELETE RESTRICT,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  motivo TEXT,
  diagnostico TEXT,
  tratamiento_realizado TEXT,
  indicaciones TEXT,
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.atenciones ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_atenciones_paciente ON public.atenciones (paciente_id);
CREATE INDEX idx_atenciones_prof_fecha ON public.atenciones (profesional_id, fecha);

CREATE TRIGGER trg_atenciones_updated
BEFORE UPDATE ON public.atenciones
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Atenciones: lectura autenticados"
  ON public.atenciones FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Atenciones: admin gestiona"
  ON public.atenciones FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Profesional puede gestionar sus propias atenciones
CREATE POLICY "Atenciones: profesional gestiona las suyas"
  ON public.atenciones FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'profesional')
    AND profesional_id IN (SELECT id FROM public.profesionales WHERE user_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'profesional')
    AND profesional_id IN (SELECT id FROM public.profesionales WHERE user_id = auth.uid())
  );
