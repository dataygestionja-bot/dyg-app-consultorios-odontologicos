## Objetivo

Agregar una **bandeja de gestión de turnos pendientes de cierre** en el Dashboard, ubicada **inmediatamente después de la sección "Turnos de hoy"**, para que recepción/admin pueda resolver rápidamente los turnos que el cierre diario automático dejó en estado `pendiente_cierre` (turnos pasados sin atención registrada).

---

## Contexto técnico

- El estado `pendiente_cierre` lo asigna automáticamente la función SQL `cierre_diario_turnos()` (corre vía pg_cron a las 23:55) sobre turnos `confirmado / reservado / en_atencion` cuya hora_fin pasó sin tener una `atencion` asociada.
- Hoy ya hay **5+ turnos** en ese estado en la base, sin una vista clara para gestionarlos masivamente (solo se ven uno a uno desde la agenda y MisTurnos).
- El estado existe en el enum de DB y en `src/integrations/supabase/types.ts`, pero **falta** en `src/lib/constants.ts` (`TURNO_ESTADOS`, `TURNO_ESTADO_LABELS`, `TURNO_ESTADO_CLASSES`). Hoy MisTurnos lo casteo con `as TurnoEstado` para evadir el tipo.

---

## Cambios propuestos

### 1. `src/lib/constants.ts` — incorporar `pendiente_cierre` como estado de primera clase

- Agregar `"pendiente_cierre"` al array `TURNO_ESTADOS`.
- Agregar label: **"Pendiente de cierre"**.
- Agregar clase de color: usar tono ámbar/warning para destacar que requiere atención del operador, ej. `"bg-amber-500 text-white"` (o una variable CSS si ya existe `--estado-pendiente-cierre`; si no, hardcodear ámbar es consistente con los avisos "Fuera de horario" del Dashboard).
- Beneficio colateral: `MisTurnos.tsx` y otros archivos podrán quitar los `as TurnoEstado` posteriores (no es objetivo de esta tarea, pero queda preparado).

### 2. `src/pages/Dashboard.tsx` — nueva bandeja "Turnos pendientes de cierre"

**Estado y carga de datos:**
- Nuevo estado `const [pendientesCierre, setPendientesCierre] = useState<TurnoRow[]>([])`.
- En `cargar()`, agregar al `Promise.all` una consulta:
  ```ts
  supabase.from("turnos")
    .select(select)  // mismo select que "hoy"
    .eq("estado", "pendiente_cierre")
    .order("fecha", { ascending: false })
    .order("hora_inicio")
    .limit(20)
  ```
  (sin filtro por fecha; pueden quedar de varios días).

**KPI extra (opcional, decidido como SÍ para visibilidad):**
- Agregar una 5ª tarjeta en la grilla de KPIs (o reemplazar diseño a `lg:grid-cols-5`) con título **"Pendientes de cierre"**, ícono `AlertCircle`, número total y borde ámbar. Click → scroll/anchor a la nueva bandeja.
- Si preferís no tocar la grilla de KPIs, se omite y solo aparece la bandeja. **Propuesta default: agregar la KPI** porque es coherente con cómo ya se muestra "Solicitudes pendientes".

**Bandeja (Card):**
- Ubicación: **entre el bloque de "Solicitudes pendientes" y el grid `Turnos de hoy / Próximos turnos`**, NO dentro del grid, así ocupa el ancho completo y queda visualmente entre "Turnos de hoy" y los siguientes paneles. Solo se renderiza si `pendientesCierre.length > 0`.
- Estilo coherente con el card de "Turnos solicitados": borde izquierdo ámbar (`border-l-4`), fondo tenue ámbar.
- Header:
  - Ícono `AlertCircle` ámbar.
  - Título: **"Turnos pendientes de cierre"** + Badge con la cantidad.
  - Descripción: *"Turnos pasados sin atención registrada. Resolvelos para mantener la agenda al día."*
- Body: lista (`<ul className="divide-y">`) con cada turno mostrando:
  - Barra de color del profesional.
  - Paciente (apellido, nombre).
  - Línea secundaria: `dd MMM · HH:mm · Dr. {apellido} · {motivo_consulta}`.
  - Acciones rápidas (a la derecha) — **sin abrir modales**, ejecutadas con `confirm()` nativo + toast:
    1. **Marcar como ausente** (variant `outline`, ícono `UserX`): `update turnos set estado='ausente'` → recarga.
    2. **Cancelar turno** (variant `outline` destructivo, ícono `Ban`): `update turnos set estado='cancelado'` → recarga.
    3. **Iniciar atención** (variant `default` primario, ícono `Stethoscope`): navega a `/atenciones/nuevo?turnoId={id}` (ruta ya existente vía `AtencionForm`). Esto cubre el caso "el turno sí se atendió pero nunca se cargó la atención".
  - Botones compactos: `size="sm" className="h-7 px-2 text-xs"` (alineado con el estilo recientemente aplicado en TurnosSolicitados).

**Permisos:**
- La bandeja se muestra solo a `admin` o `recepcion` (usar `hasAnyRole(["admin","recepcion"])` desde `useAuth`). Los profesionales ya gestionan sus pendientes desde **MisTurnos**, así que no duplicamos en su Dashboard.

**Auditoría:**
- Cada UPDATE pasa por la tabla `turnos`; el trigger global `audit_trigger_func` ya registra el cambio en `audit_log`. No hace falta lógica adicional.

---

## Lo que NO se cambia

- No se modifica el cron ni `cierre_diario_turnos()`.
- No se toca `Turnos.tsx` (el bloqueo del campo "estado" para `pendiente_cierre` en el diálogo de edición sigue tal cual).
- No se reemplaza el flujo existente de MisTurnos para profesionales.
- No se crea una página nueva: todo vive dentro del Dashboard como un panel más.

---

## Riesgos / consideraciones

- Si la lista crece mucho, limitamos a 20 + mostramos "Ver todos" enlazando a `/turnos` (filtrable). Si querés, en una segunda iteración podemos agregar un filtro `?estado=pendiente_cierre` en `Turnos.tsx`.
- El UPDATE a `cancelado` / `ausente` respeta los triggers existentes (`validar_turno_no_bloqueado`, `validar_solapamiento_turno`) — esos estados están explícitamente exentos, así que no hay conflictos de validación.

---

## Archivos a editar

1. `src/lib/constants.ts` — agregar `pendiente_cierre` al enum/labels/classes.
2. `src/pages/Dashboard.tsx` — nueva carga, KPI y card de bandeja con acciones rápidas.

Sin migraciones de DB, sin nuevas edge functions, sin cambios de RLS.