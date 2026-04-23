

## Pantalla "Mis turnos de hoy"

Pantalla operativa para que el profesional vea sus turnos del día e inicie la atención con un solo clic, sin volver a buscar paciente ni profesional.

### 1. Nueva ruta y página

**Archivo nuevo:** `src/pages/MisTurnos.tsx`
**Ruta:** `/mis-turnos` (registrada en `src/App.tsx` con `<Private>`, accesible a admin, recepción y profesional).

### 2. Comportamiento según rol

- **Profesional:** se detecta su `profesionales.id` vía `user_id = auth.uid()`. Solo ve sus turnos del día. El selector de profesional queda oculto.
- **Admin / Recepción:** ven un `Select` "Profesional" con opción **Todos** (default) y la lista. Pueden cambiar el día (selector de fecha + botón "Hoy").

### 3. Listado de turnos

Tabla / lista de tarjetas con columnas:

- **Hora** (hora_inicio – hora_fin)
- **Paciente** (apellido, nombre + DNI chico)
- **Profesional** (oculto si el rol es profesional, ya es él)
- **Motivo de consulta**
- **Estado** (badge con `TURNO_ESTADO_CLASSES`)
- **Acción**

Orden: por `hora_inicio` ascendente.

### 4. Filtros por estado (tabs)

```text
[ Activos ]  [ Finalizados ]  [ Todos ]
```

- **Activos** (default): `reservado`, `confirmado`, `en_atencion`, `pendiente_cierre`.
- **Finalizados**: `atendido`, `ausente`, `cancelado`, `reprogramado`.
- **Todos**: todos los estados del día.

Contador de turnos al lado de cada tab.

### 5. Acción "Iniciar atención"

Botón principal por fila (visible solo si el estado es `reservado`, `confirmado`, `en_atencion` o `pendiente_cierre`):

- Verifica si ya existe una atención para ese turno (`SELECT id FROM atenciones WHERE turno_id = ?`).
  - Si **existe** → toast informativo y navega a `/atenciones/:id` (editar la existente). No crea duplicado.
  - Si **no existe** → navega a `/atenciones/nuevo?turno={turno_id}`.
- `AtencionForm` ya soporta el query param `?turno=` y precarga `paciente_id`, `profesional_id`, `fecha`, `turno_id` y fija `tipo_atencion = "con_turno"`. **No requiere cambios.**

Adicionalmente, en `AtencionForm.tsx` (cuando viene `turnoIdParam`), agregar `disabled` a los `Select` de **Paciente** y **Profesional** para evitar que se modifiquen — quedan como solo lectura visual.

Si el estado del turno es `reservado` o `confirmado`, opcionalmente al hacer clic se actualiza primero a `en_atencion` (mejor flujo visual del día). Si falla por RLS de profesional, no se rompe — la atención igual se crea.

### 6. Acción secundaria

Botón en el header: **"Nueva atención sin turno"** → navega a `/atenciones/nuevo` (sin query param). Allí el usuario elige `tipo_atencion = "urgencia"` o `"espontanea"`.

### 7. Estado vacío

Si no hay turnos en el filtro activo:
> "No tenés turnos {hoy / para esta fecha} en este estado." + sugerencia de ver el tab "Todos".

### 8. Consulta principal

```sql
SELECT t.*, p.nombre, p.apellido, p.dni,
       pr.nombre AS prof_nombre, pr.apellido AS prof_apellido,
       (SELECT id FROM atenciones WHERE turno_id = t.id LIMIT 1) AS atencion_id
FROM turnos t
JOIN pacientes p ON p.id = t.paciente_id
JOIN profesionales pr ON pr.id = t.profesional_id
WHERE t.fecha = :fecha
  AND (:profesional_id IS NULL OR t.profesional_id = :profesional_id)
ORDER BY t.hora_inicio
```

En el cliente: con Supabase JS, dos queries: `turnos` con joins `paciente:pacientes(...)`, `profesional:profesionales(...)`, y luego `atenciones.select("id, turno_id").in("turno_id", turnoIds)` para mapear cuáles ya tienen atención (mostrar botón "Ver atención" en vez de "Iniciar").

### 9. Menú lateral

En `src/components/layout/AppSidebar.tsx`, agregar al grupo **Operatoria**, justo después de "Turnos":

```text
{ title: "Mis turnos de hoy", url: "/mis-turnos", icon: ListTodo }
```

Visible para todos los roles (sin restricción de `roles`).

### Lo que NO se toca

- Tabla `turnos`, `atenciones`, RLS, triggers, esquema de DB.
- `Turnos.tsx` (calendario semanal) sigue igual.
- Lógica de guardado de `AtencionForm` (solo se agrega `disabled` visual a 2 selects cuando viene `?turno=`).
- Otros módulos.

### Resultado

El profesional entra a "Mis turnos de hoy", ve su agenda del día, hace clic en **Iniciar atención** y cae directo en el formulario con todo precargado y bloqueado para no equivocarse. Si el turno ya tiene atención, lo lleva a editarla en vez de duplicar. Admin/recepción usan la misma pantalla filtrando por profesional.

