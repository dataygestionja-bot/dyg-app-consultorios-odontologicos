

## Historial de atenciones en ficha del paciente

Agregar una nueva pestaña **"Atenciones"** dentro de la edición de paciente (`/pacientes/:id`) que muestre el historial cronológico de atenciones clínicas que tuvo ese paciente.

### Cambios

**1. Nuevo componente `src/components/paciente/HistorialAtenciones.tsx`**

- Recibe `pacienteId` como prop.
- Consulta a `atenciones` filtrando por `paciente_id`, ordenadas por `fecha` descendente (más reciente primero), trayendo además `profesional:profesionales(nombre, apellido)` y `turno:turnos(motivo_consulta)`.
- Renderiza una `Card` con tabla de columnas:
  - **Fecha** (formateada `dd/MM/yyyy`)
  - **Tipo** (badge: Con turno / Urgencia / Espontánea, mismos colores que `Atenciones.tsx`)
  - **Profesional** (apellido, nombre)
  - **Motivo** (del turno, o el tipo si no aplica)
  - **Diagnóstico** (truncado con tooltip)
  - **Acciones**: botón "Ver" → `Link` a `/atenciones/:id`
- Estado vacío: "Sin atenciones registradas".
- Estado de carga: "Cargando atenciones...".

**2. `src/pages/PacienteForm.tsx`**

- Importar `HistorialAtenciones`.
- Agregar nuevo `<TabsTrigger value="atenciones">Atenciones</TabsTrigger>` (solo si `isEdit`), entre **Observaciones** y **Cuenta corriente**.
- Agregar el `<TabsContent value="atenciones">` correspondiente que renderiza `<HistorialAtenciones pacienteId={id!} />`.

### Lo que NO se toca

- Esquema de base de datos (la tabla `atenciones` ya existe con `paciente_id`).
- RLS ni permisos.
- Página `/atenciones` ni `AtencionForm`.

### Resultado

Al abrir cualquier paciente, una nueva solapa **Atenciones** lista todo su historial clínico ordenado de más reciente a más antiguo, con acceso directo al detalle de cada atención.

