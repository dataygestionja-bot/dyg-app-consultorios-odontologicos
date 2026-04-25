## Diagnóstico

Hoy la bandeja `Turnos solicitados` muestra el botón **Validar** únicamente cuando `turnos.requiere_validacion = true`, lo que solo se setea en el edge function cuando el teléfono del formulario matchea con un paciente existente y los datos (nombre/apellido/DNI) difieren.

Cuando entra un teléfono **nuevo**, el edge crea un paciente provisorio con `pacientes.pendiente_validacion = true` y deja `turnos.requiere_validacion = false`. Resultado: los pacientes nuevos no aparecen como "a validar" en la bandeja, aunque el paciente sí esté marcado pendiente en la tabla `pacientes`. Eso es lo que ves con los dos turnos que creaste (Federico Nieto y Juan Roman Riquelme): ambos son pacientes nuevos provisorios.

## Cambios

### 1. `src/pages/TurnosSolicitados.tsx`

- Extender el `select` de `fetchItems` para traer también `paciente.pendiente_validacion`.
- Ampliar la interfaz `Solicitud` con `paciente.pendiente_validacion: boolean`.
- Definir un helper `necesitaValidar(s)` que devuelva `true` cuando:
  - `s.requiere_validacion === true` (datos divergen de un paciente existente), **o**
  - `s.paciente?.pendiente_validacion === true` (paciente provisorio recién creado desde el formulario público).
- Reemplazar los usos actuales del flag por ese helper (badge "validar", fila resaltada, botón "Validar", contador "a validar", filtro "Requieren validación").
- Ajustar el filtro `filtroEstado === "validacion"`: traer todos los `solicitado` con `origen=publico` y filtrar en cliente con el helper (volumen bajo, sigue eficiente).

### 2. Diálogo "Validar"

- Caso **paciente nuevo provisorio** (sin diferencias porque no hay paciente previo):
  - Mensaje: "Paciente nuevo creado desde el formulario público. Revisá los datos antes de confirmar."
  - Mostrar los datos ingresados (`nombre_solicitante`, `apellido_solicitante`, `dni_solicitante`, `telefono_solicitante`, `email_solicitante`).
  - Acciones:
    - **Confirmar y marcar paciente como validado** → setea `pacientes.pendiente_validacion = false` y ejecuta el confirm habitual (estado=confirmado + WhatsApp).
    - **Rechazar** → flujo existente.
- Caso **datos divergen de paciente existente** (hoy): conservar las tres acciones existentes (Confirmar usando paciente existente / Actualizar datos del paciente / Crear paciente nuevo).

### 3. Acción "Confirmar usando paciente existente"

- No tocar `pendiente_validacion` del paciente automáticamente — solo se baja explícitamente desde "marcar como validado" o desde la ficha del paciente.

## Resultado esperado

| Caso | Badge "validar" | Botón "Validar" |
|---|---|---|
| Datos divergen contra paciente existente | ✅ | ✅ (3 acciones existentes) |
| Paciente nuevo provisorio (tus 2 turnos) | ✅ | ✅ (Confirmar + marcar validado / Rechazar) |
| Match exacto contra paciente existente | ❌ | ❌ (Confirmar / Reprogramar / Rechazar) |

Los dos turnos actuales pasarán a mostrar el badge "validar" y la acción **Validar** en la grilla.

## Archivos a tocar

- `src/pages/TurnosSolicitados.tsx` (único cambio).

No se requiere migración ni cambios en el edge function.