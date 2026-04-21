

## Mejoras al cargar atención "con turno"

Dos ajustes en `src/pages/AtencionForm.tsx` para agilizar la carga de atenciones cuando se selecciona un turno.

### 1. Ordenar turnos de más antiguo a más reciente

En el `useEffect` que carga `turnosDisponibles` (línea ~146), cambiar:
```typescript
.order("fecha", { ascending: false })
```
por:
```typescript
.order("fecha", { ascending: true }).order("hora_inicio", { ascending: true })
```

Así el desplegable **Turno asociado** muestra primero los turnos más antiguos del paciente y al final los más recientes (incluido el de hoy).

### 2. Autocompletar profesional al elegir un turno

Modificar el `onValueChange` del Select de **Turno asociado** (línea ~336): cuando el usuario selecciona un turno, además de setear `turno_id`, leer el `profesional_id` del turno elegido desde `turnosDisponibles` y completar `form.profesional_id` automáticamente.

Comportamiento:
- Si el campo Profesional está vacío → se completa con el del turno.
- Si ya hay un profesional cargado → **también se reemplaza** por el del turno (la fuente de verdad para una atención "con turno" es el turno mismo). Si más adelante el usuario quiere otro, puede cambiarlo manualmente.
- Si se deselecciona el turno → no se toca el profesional (evita borrar algo válido).

### Lo que NO se toca

- Diálogo "Editar turno".
- Lógica de tipos `urgencia` / `espontanea` (allí el profesional se elige a mano como hoy).
- Validaciones de guardado.
- Base de datos.

### Resultado

Al elegir un paciente y seleccionar el turno asociado, el profesional se carga solo con el dato del turno, y la lista de turnos se ve ordenada cronológicamente de más antiguo a más reciente.

