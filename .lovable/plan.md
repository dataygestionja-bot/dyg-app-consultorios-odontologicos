## Objetivo

En la pantalla de atención, los clics sobre el odontograma se persisten al instante en `odontograma_registros`. Queremos que esos cambios queden **pendientes en memoria** y se guarden recién cuando el usuario presione **Guardar** en la atención.

## Comportamiento propuesto

- El profesional puede tocar piezas y elegir estados igual que hoy.
- Cada cambio se acumula como "pendiente" (en estado local del formulario), con feedback visual:
  - La pieza muestra el nuevo estado tentativo (mismo color que ya hoy se usa).
  - Un pequeño contador/badge "N cambios sin guardar" en la cabecera del odontograma.
  - Botón "Descartar cambios" para limpiar los pendientes.
- Al presionar **Guardar atención**:
  - Primero se guarda/actualiza la atención (igual que hoy).
  - Luego, en la misma transacción lógica, se insertan los registros pendientes del odontograma, todos con la `fecha` de la atención y el `profesional_id` del formulario.
  - Si falla la inserción del odontograma, se muestra error pero la atención queda guardada (mensaje claro al usuario).
- Si el usuario navega fuera con cambios pendientes, se le pide confirmación (igual patrón que ya existe con `confirm-dialog`).

## Detalles técnicos

- **`src/pages/AtencionForm.tsx`**
  - Nuevo estado `odontoPendientes: { diente: number; estado: DienteEstado; observaciones?: string | null }[]`.
  - Se pasa a `<Odontograma />` junto con callbacks `onAgregarPendiente`, `onQuitarPendiente`, `onLimpiarPendientes`.
  - Dentro de `guardar(...)`, tras persistir la atención, se hace `supabase.from("odontograma_registros").insert([...])` con la fecha de la atención.
  - Avisos `beforeunload` / confirmación al cancelar si hay pendientes.

- **`src/components/paciente/Odontograma.tsx`** (modo `inline`)
  - Nueva prop opcional `pending` + callbacks. Cuando se pasa, **no** inserta en la base; en su lugar invoca `onAgregarPendiente`.
  - El estado visual de cada pieza pasa a ser: último registro persistido **sobrescrito** por el pendiente local si existe.
  - Encabezado muestra badge "N pendientes" y botón "Descartar".

- **`src/components/paciente/odontograma/PiezaDentalDialog.tsx`**
  - Nueva prop opcional `onRegistrarPendiente?: (estado) => void`. Si está presente, se usa en lugar del `insert` directo.
  - El "historial" sigue mostrando sólo lo persistido, más una fila destacada "(pendiente de guardar)" si hay un cambio local para esa pieza.

- **Modo no-atención (`mode="full"` desde la ficha del paciente)**: se mantiene el comportamiento actual (guardado inmediato). Sólo cambia el modo `inline` usado en `AtencionForm`.

## Fuera de alcance

- Edición/eliminación diferida de registros previos.
- Cambios en el historial del odontograma de la ficha del paciente.
- Cambios de esquema en la base (no hacen falta).

## A confirmar

1. Si el usuario marca una pieza, cambia de opinión y vuelve a marcar otro estado **antes** de guardar la atención: ¿el pendiente se **reemplaza** (queda un solo registro nuevo) o se **acumulan** ambos cambios como historial? Propongo **reemplazar** para evitar ruido en el historial.
2. ¿Mostrar el contador "N cambios sin guardar" y el botón "Descartar" en el header del odontograma, o sólo el contador?
