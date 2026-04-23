

## Matriz de permisos por perfil (editable y aplicada)

Rediseñar `Seguridad → Perfiles` con la matriz de permisos del mockup: filas = funcionalidades del sistema, columnas = **Lectura / Alta / Modificación / Baja**. Los cambios se guardan en una tabla nueva y **se aplican de verdad** en toda la app (botones Nuevo / Editar / Eliminar se ocultan según el permiso del rol del usuario logueado).

> Nota importante: este es un cambio grande. Reemplaza la lógica actual basada solo en `has_role()` por una matriz de permisos granular. Las RLS de Supabase también se actualizan para validar contra esa matriz (defensa en profundidad: el frontend oculta el botón, la DB rechaza el INSERT/UPDATE/DELETE si el rol no tiene el permiso).

### 1. Modelo de datos (1 migración)

Tabla nueva `role_permissions`:

```sql
CREATE TYPE permission_action AS ENUM ('read','create','update','delete');

CREATE TABLE role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  module text NOT NULL,        -- 'pacientes','turnos','atenciones',...
  action permission_action NOT NULL,
  allowed boolean NOT NULL DEFAULT false,
  UNIQUE (role, module, action)
);
```

Función security definer:

```sql
CREATE FUNCTION has_permission(_uid uuid, _module text, _action permission_action)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM role_permissions rp
    JOIN user_roles ur ON ur.role = rp.role
    WHERE ur.user_id = _uid AND rp.module = _module
      AND rp.action = _action AND rp.allowed = true
  );
$$;
```

**Seed** con los permisos actuales (preserva el comportamiento de hoy):
- `admin` → todos los módulos, todas las acciones = true.
- `recepcion` → pacientes, turnos, prestaciones, obras_sociales, presupuestos, cobros: read/create/update/delete = true. Atenciones: solo read. Seguridad: nada.
- `profesional` → pacientes, turnos: solo read. Atenciones, atencion_practicas: read/create/update/delete. Resto: nada o solo read.

RLS de `role_permissions`: solo `admin` gestiona; resto solo lectura del propio rol.

### 2. Reescritura de RLS de las tablas

Reemplazar las políticas tipo `has_role(uid,'admin') OR has_role(uid,'recepcion')` por `has_permission(uid,'pacientes','create')` etc., en: `pacientes, turnos, atenciones, atencion_practicas, prestaciones, obras_sociales, cobros, cobro_aplicaciones, presupuestos, presupuesto_detalle`. Se conservan las RLS especiales del profesional sobre **sus propias** atenciones/turnos (combinadas con el chequeo de permission).

### 3. Frontend — hook nuevo

`src/hooks/usePermissions.tsx`:
- Carga al login todos los permisos de los roles del usuario en un `Set<string>` (`"pacientes:create"`, etc.).
- Expone `can(module, action) => boolean`.
- Cachea en el contexto de `AuthProvider`.

Uso en cada pantalla:
```tsx
const { can } = usePermissions();
{can("pacientes","create") && <Button>Nuevo paciente</Button>}
{can("pacientes","update") && <Button>Editar</Button>}
{can("pacientes","delete") && <Button>Eliminar</Button>}
```

Aplicado en: `Pacientes.tsx`, `PacienteForm.tsx`, `Turnos.tsx`, `Atenciones.tsx`, `AtencionForm.tsx`, `Prestaciones.tsx`, `ObrasSociales.tsx`, `Cobros.tsx`, `Presupuestos.tsx`, `Profesionales.tsx`, `Usuarios.tsx`, `Perfiles.tsx`.

### 4. Pantalla Perfiles rediseñada

`src/pages/seguridad/Perfiles.tsx` (admin only — los no-admin siguen viendo "Mi perfil" como hoy):

```text
Perfiles de seguridad
─────────────────────
[ Administrador ] [ Recepción ] [ Profesional ]   ← tabs

Funcionalidad           Lectura  Alta  Modif.  Baja
─────────────────────   ───────  ────  ──────  ────
Pacientes                  ☑      ☑     ☑       ☑
Profesionales              ☑      ☐     ☐       ☐
Turnos                     ☑      ☑     ☑       ☑
Atenciones                 ☑      ☐     ☐       ☐
Prestaciones               ☑      ☑     ☑       ☐
Obras sociales             ☑      ☑     ☑       ☐
Cobros                     ☑      ☑     ☑       ☐
Presupuestos               ☑      ☑     ☑       ☑
Seguridad – Usuarios       ☐      ☐     ☐       ☐
Seguridad – Perfiles       ☐      ☐     ☐       ☐
Auditoría                  ☐      ☐     ☐       ☐
Reportes                   ☑      ☐     ☐       ☐

[ Guardar cambios ]   [ Restaurar valores por defecto ]
```

- **Tabs por rol** (admin / recepcion / profesional).
- Tabla de permisos con `Checkbox` (shadcn) por celda — estado local hasta apretar Guardar.
- Auto-implicación: tildar Alta/Modif./Baja prende Lectura automáticamente y la deja disabled (no podés modificar lo que no podés leer).
- Botón **Guardar cambios**: upsert masivo a `role_permissions` para el rol activo del tab.
- Botón **Restaurar defaults**: vuelve al seed inicial del rol.
- Toast de éxito + log en `audit_log` ("Permisos actualizados para rol X").
- Sección "Mi perfil" (datos personales) se mueve a una nueva ruta `/seguridad/mi-perfil`, accesible para todos los roles. El sidebar muestra "Perfiles" solo a admin y "Mi perfil" a todos.

### 5. Módulos a listar

```
Pacientes, Profesionales, Turnos, Atenciones, Prestaciones,
Obras sociales, Cobros, Presupuestos,
Seguridad – Usuarios, Seguridad – Perfiles, Auditoría, Reportes
```

Constante `MODULES` en `src/lib/permissions.ts` con `{ key, label }`.

### 6. Diseño visual

- Tabs estilo shadcn arriba.
- Tabla con `Table` de shadcn, header sticky, checkboxes centrados.
- Iconos: ✓ violeta (`text-primary`) cuando está marcado, cuadrado vacío cuando no, igual que el mockup. Los `Checkbox` ya usan el color `primary` del tema.
- Mobile: tabla con scroll horizontal.

### Lo que NO se toca

- Esquema de `user_roles`, `profiles`, `pacientes`, etc. (solo sus RLS).
- `useAuth`, `ProtectedRoute` (siguen funcionando por rol — los permisos granulares son adicionales).
- Triggers, otras pantallas no listadas.

### Resultado

Admin entra a Perfiles, ve tabs por rol y una grilla de 12 funcionalidades × 4 acciones. Tilda lo que quiera, guarda, y al instante los usuarios de ese rol ven aparecer/desaparecer botones en toda la app. Si alguien intenta saltearse el frontend con la API, las RLS lo rechazan en la DB.

