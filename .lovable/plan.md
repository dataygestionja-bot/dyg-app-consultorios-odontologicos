## Objetivo

Agregar acciones para **reprogramar** y **cancelar** cada turno desde el panel lateral que se abre al hacer clic en una celda de la matriz semanal.

## UX

En el `Sheet` de detalle del día (en `AgendaSemanalMatriz`), cada turno listado tendrá un menú de acciones (botón con tres puntos) con:

- **Reprogramar** — abre el `ReprogramarDialog` ya existente, que permite cambiar fecha/hora/profesional y notifica por WhatsApp.
- **Cancelar turno** — abre un `AlertDialog` de confirmación (“¿Cancelar el turno de [paciente] a las [hora]?”). Al confirmar, el turno pasa a estado `cancelado`, se muestra `toast.success` y se refresca la matriz.

Los turnos en estado `cancelado`, `ausente`, `atendido` o `pendiente_cierre` no muestran las acciones (solo el badge de estado).

## Implementación técnica

**Archivo único: `src/components/turnos/AgendaSemanalMatriz.tsx`**

1. Importar `DropdownMenu`, `AlertDialog` (ya disponibles en `src/components/ui`), íconos `MoreVertical`, `CalendarClock`, `XCircle` y el componente `ReprogramarDialog`.
2. Añadir estados locales:
   - `turnoReprogramar: TurnoLite | null`
   - `turnoCancelar: TurnoLite | null`
   - `cancelando: boolean`
3. En el render del listado de turnos del `Sheet`, junto al `Badge` de estado, agregar un `DropdownMenu` con las dos opciones (visible solo si el estado lo permite).
4. Función `cancelarTurno(t)`:
   ```ts
   await supabase.from("turnos").update({ estado: "cancelado" }).eq("id", t.id);
   ```
   Manejo de error con `toast.error`, éxito con `toast.success("Turno cancelado")`, luego `cargarDatos()` y limpiar `turnoCancelar`.
5. Renderizar `<ReprogramarDialog>` cuando `turnoReprogramar` esté seteado, mapeando los campos requeridos (`paciente_nombre`, `paciente_telefono`, `profesional_nombre`). Para obtener `paciente.telefono` se incluirá ese campo en la query existente de turnos: `paciente:pacientes(nombre, apellido, telefono)`.
6. `onDone` del diálogo: cerrar y `cargarDatos()`.
7. `AlertDialog` controlado con `turnoCancelar` para la confirmación de cancelación.

## Sin cambios

- Base de datos / RLS (la política `Turnos: modificacion por permiso` ya cubre el `UPDATE`).
- `NuevoTurnoDialog`, `ReprogramarDialog`, layout de la matriz, leyenda, encabezados y resaltado del día actual.
