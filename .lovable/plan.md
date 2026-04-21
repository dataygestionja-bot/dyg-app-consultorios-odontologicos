

## Quitar el campo "Motivo" del módulo Atención

El motivo de consulta ya se carga obligatoriamente en el turno (`turnos.motivo_consulta NOT NULL`), por lo que duplicarlo en la atención no aporta valor y genera confusión.

### Cambios

**1. `src/pages/AtencionForm.tsx`**
- Eliminar el `Textarea` de "Motivo" (líneas 365–368) del card "Datos generales".
- Eliminar `motivo` del estado `empty`, del setter en el `useEffect` de edición y del precargado por turno.
- Eliminar `motivo` del `payload` enviado a `supabase.from("atenciones")`.
- En el listado de turnos disponibles (Select "Turno asociado") ya se muestra `motivo_consulta`, lo cual queda como referencia visible para el profesional.
- Cuando se inicia desde un turno, el motivo del turno queda accesible en la cabecera del Select de turno; opcionalmente mostrar una línea informativa de solo lectura debajo del Select cuando hay `turno_id` seleccionado: *"Motivo del turno: {motivo_consulta}"*.

**2. `src/pages/Atenciones.tsx` (listado)**
- Reemplazar la columna "Motivo" por "Motivo del turno" obtenida vía join: `turno:turnos(motivo_consulta)`.
- Ajustar el filtro de búsqueda para usar `r.turno?.motivo_consulta` en lugar de `r.motivo`.
- Para atenciones sin turno (urgencia/espontánea) mostrar `—` o el `tipo_atencion` (Urgencia / Espontánea) como contexto.
- Sumar pequeña columna/badge "Tipo" para distinguir `con_turno`, `urgencia`, `espontanea`.

**3. Base de datos — `atenciones.motivo`**
No se elimina la columna ahora para no romper datos históricos. Queda nullable (ya lo es) y deja de escribirse desde la UI. Si más adelante se confirma que no hay datos útiles, se puede dropear en una migración futura.

### Lo que NO se toca
- `turnos.motivo_consulta` sigue siendo obligatorio (ya lo es).
- Triggers y reglas de negocio definidas previamente quedan intactas.
- `diagnostico`, `tratamiento_realizado`, `indicaciones`, `observaciones` y `proxima_visita_sugerida` siguen en el form de atención.

### Resultado
El profesional ve el motivo desde el turno asociado (y al elegirlo en el Select), sin tener que reescribirlo. El listado de Atenciones muestra el motivo proveniente del turno, evitando inconsistencia de datos.

