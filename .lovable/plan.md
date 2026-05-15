## Problema

En el diálogo "Agendar turno" hay un `Input` de búsqueda y un `Select` de paciente separados. La búsqueda filtra la lista interna pero el desplegable no se abre solo, así que parece que "no funciona" — el usuario escribe y no ve resultados.

Además, el `Select` de Radix sólo se filtra programáticamente; no soporta búsqueda nativa.

## Solución

Reemplazar ambos controles por **un único combobox** (Popover + Command de cmdk, ya disponibles en el proyecto en `src/components/ui/popover.tsx` y `src/components/ui/command.tsx`).

### Comportamiento

- Botón con el paciente seleccionado (o placeholder "Buscar paciente...").
- Al hacer click se abre un popover con:
  - Campo de búsqueda al tope (focus automático).
  - Lista filtrada en vivo por **apellido, nombre o DNI**.
  - Mensaje "Sin resultados" si no hay coincidencias.
- Al elegir un paciente, se cierra el popover y queda visible "Apellido, Nombre — DNI".
- Limpieza con un botón "x" o re-abriendo y eligiendo otro.

### Cambios

1. `src/components/turnos/NuevoTurnoDialog.tsx`:
   - Quitar el `Input` de búsqueda y el `Select` de paciente.
   - Agregar un `PacienteCombobox` inline (o componente local) basado en `Popover` + `Command` (`CommandInput`, `CommandList`, `CommandEmpty`, `CommandItem`).
   - Mantener `pacientes`, `pacienteId` y la carga inicial.
   - El filtrado lo maneja `cmdk` automáticamente, pero le pasamos un `value` rico (`"apellido nombre dni"`) a cada `CommandItem` para que matchee por los tres campos.

### Sin cambios

- BD, RLS, lógica de slots, sobreturno, motivo, guardado, toasts, refresh.
- Resto del flujo de la matriz.
