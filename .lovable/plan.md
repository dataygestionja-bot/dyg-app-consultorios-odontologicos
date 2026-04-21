

## Vista de detalle (solo lectura) para atenciones

Hoy el ícono ojo en el listado de **Atenciones** y en la solapa **Atenciones** del paciente abre `/atenciones/:id`, que en realidad renderiza `AtencionForm` en modo edición. El usuario espera ver los datos sin poder modificarlos.

### Solución

Crear una nueva página **`/atenciones/:id/ver`** que muestra la atención en modo solo lectura, y redirigir todos los íconos "ojo" a esa ruta. La edición sigue accesible desde un botón **"Editar"** dentro de la vista de detalle.

### Cambios

**1. Nueva página `src/pages/AtencionDetalle.tsx`**

- Lee `:id` desde la URL.
- Trae la atención con joins: paciente, profesional, turno y prácticas (`atencion_practicas` con su prestación).
- Renderiza en `Card`s de solo lectura (texto plano, sin inputs):
  - **Encabezado**: botón ← volver, título "Detalle de atención", botón **Editar** a la derecha (`Link` a `/atenciones/:id`).
  - **Datos generales**: fecha, paciente, profesional, tipo de atención (badge), turno asociado (motivo + fecha/hora si existe), próxima visita sugerida.
  - **Prácticas realizadas**: tabla con prestación (código + descripción), pieza, cara, cantidad, observación.
  - **Diagnóstico**, **Indicaciones**, **Observaciones** como bloques de texto (mostrar "—" si vacíos).
- Estado de carga y "no encontrado".

**2. Registrar la ruta en `src/App.tsx`**

Agregar `<Route path="/atenciones/:id/ver" element={<AtencionDetalle />} />` dentro del bloque protegido, **antes** de `/atenciones/:id` para evitar conflictos.

**3. Cambiar destino del ícono ojo**

- `src/pages/Atenciones.tsx` (línea 161): `to={`/atenciones/${a.id}/ver`}`.
- `src/components/paciente/HistorialAtenciones.tsx` (línea ~117): mismo cambio.

### Lo que NO se toca

- `AtencionForm.tsx` sigue siendo el modo crear/editar; se accede desde el botón **Editar** del detalle o desde "Nueva atención".
- Permisos / RLS / base de datos.
- Otras vistas (Dashboard, Turnos).

### Resultado

Al hacer clic en el ojo desde el listado de Atenciones o desde la ficha del paciente, se abre una vista de **solo lectura** con todos los datos de la atención. Para modificarla, el usuario usa el botón **Editar** que la lleva al formulario actual.

