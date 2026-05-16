# Plan: Rediseñar formulario de atención

## 1. Cabecera del formulario (`AtencionForm.tsx`)

Reemplazar la tarjeta "Datos generales" actual por una cabecera compacta de solo lectura con 4 datos, mostrados como tarjetas/etiquetas:

- **Fecha** (la del turno, o `hoy` si es urgencia/espontánea) — no editable
- **Paciente** — solo lectura (apellido, nombre, DNI)
- **Profesional** — único campo editable, vía `Select` (default: el del turno)
- **Tipo de atención** — solo lectura (badge)

Se elimina del UI el selector de "Turno asociado" (ya viene fijo por el `?turno=` param) y el campo "Próxima visita sugerida" se mueve a la tarjeta "Notas clínicas" (se mantiene la funcionalidad).

Cuando se entra sin turno (urgencia/espontánea), se mantiene el flujo actual con selects de paciente, tipo y fecha.

## 2. Ficha clínica del paciente (nueva tarjeta)

Nueva sección de solo lectura debajo de la cabecera, mostrando los campos que ya existen en `pacientes`:

- `alergias`
- `medicacion_actual`
- `antecedentes_medicos`

Se carga junto con los datos del paciente en la fase 2 del `useEffect`. Si un campo está vacío, mostrar "—". Incluir botón "Editar ficha" que linkea a `/pacientes/:id/editar` (abre en nueva pestaña).

## 3. Odontograma inline (nueva tarjeta)

Refactor de `src/components/paciente/Odontograma.tsx` para soportar un nuevo modo "inline" usable dentro de la atención:

- Nuevas props opcionales: `profesionalId`, `fechaAtencion`, `mode?: "full" | "inline"`.
- En modo `inline`:
  - Ocultar el botón **"Agregar registro"** y el diálogo asociado.
  - Al hacer clic en una pieza dental: abrir un pequeño `Popover` (o expandir el botón a un mini-selector) con la lista de estados (`DIENTE_ESTADOS` con sus colores).
  - Al elegir un estado, hacer `insert` directo en `odontograma_registros` con: `paciente_id`, `diente`, `estado`, `profesional_id` (del form), `fecha` (fecha de la atención, hora actual), `observaciones: null`.
  - Refrescar la grilla y mostrar toast de confirmación.
  - Mantener leyenda, grilla 1–32 e historial detallado tal como están.
- En modo `full` (el actual, usado en la ficha del paciente): no cambia.

Integrarlo en `AtencionForm.tsx` pasando `pacienteId`, `profesionalId={form.profesional_id}`, `fechaAtencion={form.fecha}`, `mode="inline"`. Si todavía no hay profesional seleccionado, deshabilitar los clics y mostrar hint "Seleccioná un profesional para registrar estados".

## 4. Historial de atenciones (nueva tarjeta)

Reutilizar el componente existente `src/components/paciente/HistorialAtenciones.tsx` directamente en `AtencionForm.tsx`, pasando `pacienteId`. Ya muestra fecha, tipo, profesional, motivo y diagnóstico. No requiere cambios.

En modo edición, opcionalmente filtrar fuera la atención actual (`id`) para no listarse a sí misma — pequeño ajuste opcional al componente con prop `excludeId?`.

## 5. Orden visual final del formulario

1. Cabecera (Fecha · Paciente · Profesional editable · Tipo)
2. Ficha clínica del paciente
3. Odontograma (inline, clic = elegir estado)
4. Prácticas realizadas (sin cambios)
5. Notas clínicas (Diagnóstico, Indicaciones, Observaciones, Próxima visita)
6. Historial de atenciones del paciente
7. Botones Cancelar / Guardar

## Detalles técnicos

- Sin cambios de base de datos. `odontograma_registros` ya tiene `paciente_id`, `diente`, `estado`, `fecha`, `profesional_id`, `observaciones`. Los campos de ficha clínica ya existen en `pacientes`.
- Estados de diente y colores se siguen tomando de `@/lib/constants` (`DIENTE_ESTADOS`, `DIENTE_ESTADO_DOT`, `DIENTE_ESTADO_LABELS`).
- Permiso para registrar en odontograma se sigue evaluando con `can("odontograma", "create")`; si no tiene permiso, los clics no insertan.
- El popover de estados usa `@/components/ui/popover` (ya existe).

## Archivos a modificar

- `src/pages/AtencionForm.tsx` — rediseño de cabecera, integración de ficha clínica, odontograma inline e historial.
- `src/components/paciente/Odontograma.tsx` — agregar modo `inline` con clic → popover de estados → insert directo.
- `src/components/paciente/HistorialAtenciones.tsx` — (opcional) prop `excludeId`.
