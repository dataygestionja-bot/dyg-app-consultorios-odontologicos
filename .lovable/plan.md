
## Bloqueos de agenda del profesional

Nuevo módulo para registrar períodos en que un profesional no está disponible (vacaciones, enfermedad, capacitación, etc.). La DB rechaza turnos en horarios bloqueados, la agenda los muestra como bloques no disponibles, y al crear un bloqueo que pisa turnos existentes se muestra una advertencia con la lista (sin cancelarlos automáticamente).

### 1. Modelo de datos (1 migración)

Tipo nuevo y tabla:

```sql
CREATE TYPE motivo_bloqueo AS ENUM
  ('vacaciones','enfermedad','capacitacion','licencia','feriado','personal','otro');

CREATE TYPE bloqueo_estado AS ENUM ('activo','cancelado');

CREATE TABLE bloqueos_agenda (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profesional_id  uuid NOT NULL REFERENCES profesionales(id) ON DELETE CASCADE,
  fecha_desde     date NOT NULL,
  fecha_hasta     date NOT NULL,
  todo_el_dia     boolean NOT NULL DEFAULT true,
  hora_desde      time,                       -- null si todo_el_dia
  hora_hasta      time,                       -- null si todo_el_dia
  motivo          motivo_bloqueo NOT NULL,
  observaciones   text,
  estado          bloqueo_estado NOT NULL DEFAULT 'activo',
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bloqueos_prof_fecha
  ON bloqueos_agenda (profesional_id, fecha_desde, fecha_hasta)
  WHERE estado = 'activo';
```

**Trigger de validación** (CHECK no aplica porque depende de `todo_el_dia`):

```sql
CREATE OR REPLACE FUNCTION validar_bloqueo_agenda()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.fecha_hasta < NEW.fecha_desde THEN
    RAISE EXCEPTION 'La fecha hasta no puede ser anterior a la fecha desde';
  END IF;
  IF NEW.todo_el_dia = false THEN
    IF NEW.hora_desde IS NULL OR NEW.hora_hasta IS NULL THEN
      RAISE EXCEPTION 'Si no es todo el día, hora_desde y hora_hasta son obligatorias';
    END IF;
    IF NEW.hora_hasta <= NEW.hora_desde THEN
      RAISE EXCEPTION 'hora_hasta debe ser mayor a hora_desde';
    END IF;
  END IF;
  RETURN NEW;
END $$;
```

### 2. Validación en turnos (trigger)

Extender `validar_solapamiento_turno()` (o agregar trigger nuevo `validar_turno_no_bloqueado`) para rechazar `INSERT/UPDATE` de turnos cuyo profesional/fecha/hora caigan dentro de un bloqueo activo:

```sql
-- chequeo: existe bloqueo activo del profesional que cubra el turno
SELECT 1 FROM bloqueos_agenda b
 WHERE b.profesional_id = NEW.profesional_id
   AND b.estado = 'activo'
   AND NEW.fecha BETWEEN b.fecha_desde AND b.fecha_hasta
   AND (
     b.todo_el_dia = true
     OR (NEW.hora_inicio < b.hora_hasta AND NEW.hora_fin > b.hora_desde)
   );
```

Si encuentra coincidencia, lanza:
> `El profesional no está disponible en ese día u horario.`

Esto cubre tanto turnos normales como sobreturnos (los sobreturnos también respetan el bloqueo).

### 3. RLS

```sql
-- lectura: cualquier autenticado (la agenda los necesita ver todos)
-- escritura: admin y recepción (sin permisos granulares por simplicidad,
-- pero se respeta el patrón has_role)
CREATE POLICY "Bloqueos: lectura autenticados" ON bloqueos_agenda
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Bloqueos: alta admin/recepcion" ON bloqueos_agenda
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'recepcion'));

CREATE POLICY "Bloqueos: modificacion admin/recepcion" ON bloqueos_agenda
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'recepcion'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'recepcion'));

CREATE POLICY "Bloqueos: baja admin/recepcion" ON bloqueos_agenda
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'recepcion'));
```

Trigger `audit_trigger_func` enganchado para log automático.

### 4. Pantalla nueva: `/bloqueos`

Archivo: `src/pages/Bloqueos.tsx`. Ruta protegida solo para admin/recepción en `App.tsx`.

```text
Bloqueos de agenda
──────────────────
[Profesional ▼]  [Estado ▼]  [Desde]  [Hasta]   [+ Nuevo bloqueo]

Profesional      Período             Horario      Motivo        Estado    Acciones
─────────────    ────────────────    ─────────    ──────────    ───────   ────────
Pérez, Juan      10/05 → 20/05       Todo el día  Vacaciones    Activo    [Editar][Cancelar]
García, Ana      15/05               09–13        Capacitación  Activo    [Editar][Cancelar]
López, Carla     01/04 → 03/04       Todo el día  Enfermedad    Cancelado [Editar]
```

**Form (Dialog)** "Nuevo / Editar bloqueo":
- Profesional (Select, obligatorio)
- Fecha desde / Fecha hasta (Inputs `type=date`)
- Switch "Todo el día" (default true)
- Hora desde / Hora hasta (visibles solo si Todo el día = false)
- Motivo (Select con los 7 enums)
- Observaciones (Textarea)
- Botones: Cancelar | Guardar

**Flujo "turnos afectados"**: al guardar, antes del INSERT consulta:
```ts
supabase.from("turnos")
 .select("id, fecha, hora_inicio, hora_fin, paciente:pacientes(nombre,apellido)")
 .eq("profesional_id", profId)
 .gte("fecha", desde).lte("fecha", hasta)
 .not("estado", "in", "(cancelado,reprogramado,ausente)")
 .order("fecha").order("hora_inicio");
```
Filtra por horario si no es todo el día. Si hay resultados, muestra `AlertDialog`:

```text
⚠ Hay 3 turnos confirmados dentro del rango bloqueado:
  • 12/05 09:30 — Gómez, Luis
  • 14/05 11:00 — Ríos, María
  • 16/05 16:00 — Pérez, Ana

Estos turnos NO se cancelan automáticamente.
Podés ir a Turnos para reprogramarlos o cancelarlos.

[Cancelar]  [Crear bloqueo igual]   [Ir a Turnos]
```

**Cancelar bloqueo**: botón que hace `UPDATE estado='cancelado'` (no DELETE), preserva auditoría.

### 5. Integración en módulo Turnos

`src/pages/Turnos.tsx`:

- Cargar `bloqueos_agenda` activos del profesional + rango visible junto con horarios y turnos.
- En `CalendarGrid`, para cada slot calcular si cae dentro de un bloqueo:
  - Renderizar el slot con fondo rayado/gris oscuro y texto del motivo (ej. "Vacaciones — no disponible").
  - Click sobre slot bloqueado: `toast.error("El profesional no está disponible en ese día u horario")` y no abre el diálogo.
- Si algún día completo está bloqueado, mostrar barra superior `<Badge>` en la columna del día: "Día bloqueado · Vacaciones".
- Color: token nuevo `--estado-bloqueado` en `index.css` (gris medio con leve tono rojo) más patrón rayado vía `bg-[repeating-linear-gradient(...)]`.

### 6. Integración en "Mis turnos de hoy"

`src/pages/MisTurnos.tsx`:
- Cargar bloqueos activos del profesional para la fecha seleccionada.
- Si hay bloqueo del día completo: banner `<Alert variant="destructive">` arriba "Día bloqueado: Vacaciones" y la lista igual sigue visible (puede haber turnos previos no cancelados).
- Si hay franjas, mostrar chips informativas "09:00–13:00 bloqueado (Capacitación)".

### 7. Ficha del profesional

`src/pages/ProfesionalForm.tsx`:
- Sección nueva al final "Próximos bloqueos" listando los bloqueos activos con `fecha_hasta >= today`, ordenados por `fecha_desde`. Solo lectura, link "Gestionar" → `/bloqueos?prof={id}`.

### 8. Sidebar

Agregar en `itemsOperatoria` (o nuevo grupo "Agenda"):
```ts
{ title: "Bloqueos de agenda", url: "/bloqueos", icon: CalendarOff, roles: ["admin","recepcion"] }
```

### 9. Mensajes de error en alta de turno

En `Turnos.tsx > guardar()`, agregar manejo del error del trigger:
```ts
if (error.message.includes("no está disponible")) {
  return toast.error("El profesional no está disponible en ese día u horario");
}
```

### Lo que NO se toca

- Sistema de permisos granulares (`role_permissions`) — bloqueos usa `has_role` por simplicidad y porque es un módulo administrativo acotado. Se puede granularizar después si hace falta.
- RLS, validaciones ni triggers existentes de turnos/atenciones más allá del nuevo chequeo de bloqueo.
- Cancelación automática de turnos: queda explícitamente fuera (regla del usuario).
- Sobreturnos: respetan el bloqueo igual que turnos normales (consistente con el objetivo del módulo).

### Resultado

Recepción/admin entran a **Bloqueos de agenda**, eligen profesional, rango y motivo, y graban. Si hay turnos en el rango, la app los lista y deja decidir. La agenda de Turnos muestra los slots bloqueados como bloques no disponibles con el motivo, y cualquier intento de crear un turno (normal o sobreturno) en ese rango es rechazado tanto en frontend como en la base con un mensaje claro.
