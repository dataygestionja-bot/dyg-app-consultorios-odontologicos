

## Corregir constraint que bloquea sobreturnos

El error real es: existe una constraint de exclusión `turnos_no_overlap` en la tabla `turnos` (anterior al cambio de sobreturnos) que rechaza **cualquier** solapamiento por profesional/fecha/horario, sin importar si el nuevo turno es sobreturno o no. Por eso el trigger que valida sobreturnos nunca llega a ejecutarse: Postgres bloquea antes con `conflicting key value violates exclusion constraint "turnos_no_overlap"`.

### Definición actual problemática

```sql
EXCLUDE USING gist (
  profesional_id WITH =,
  fecha WITH =,
  tsrange(fecha + hora_inicio, fecha + hora_fin, '[)') WITH &&
) WHERE (estado IN ('reservado','confirmado','atendido'))
```

No contempla `es_sobreturno`, por lo que dos turnos en el mismo horario nunca pueden convivir.

### Solución (una sola migración)

Reemplazar la constraint para que **solo aplique a turnos NO sobreturno**. Los sobreturnos quedan exentos de la regla de exclusión y conviven libremente con turnos normales.

```sql
-- 1. Eliminar la constraint vieja
ALTER TABLE public.turnos
  DROP CONSTRAINT IF EXISTS turnos_no_overlap;

-- 2. Recrearla excluyendo sobreturnos del WHERE
ALTER TABLE public.turnos
  ADD CONSTRAINT turnos_no_overlap
  EXCLUDE USING gist (
    profesional_id WITH =,
    fecha WITH =,
    tsrange((fecha + hora_inicio), (fecha + hora_fin), '[)') WITH &&
  )
  WHERE (
    es_sobreturno = false
    AND estado IN ('reservado','confirmado','atendido')
  );
```

### Por qué este enfoque

- Mantiene la **protección original** contra solapamientos accidentales entre turnos normales (a nivel constraint, irreversible incluso por bugs de aplicación).
- Permite que los **sobreturnos no sean evaluados** por la constraint, porque el `WHERE` los excluye del índice de exclusión.
- El **trigger** `validar_solapamiento_turno` que ya existe sigue cubriendo el caso de inserción de un turno normal donde ya hay un sobreturno (vuelve a chequear y devuelve un mensaje claro).
- Estados `cancelado`, `reprogramado`, `ausente` siguen liberando el horario igual que antes.

### Verificación posterior

Después de aplicar la migración, validar manualmente:

1. Crear turno normal 10:00–10:30 → OK.
2. Crear otro turno normal 10:00–10:30 mismo profesional → debe rechazarse con el mensaje del trigger ("Ya existe un turno…").
3. Confirmar el diálogo → el segundo intento marca `es_sobreturno = true` → ahora se inserta correctamente.

### Lo que NO se toca

- Trigger `validar_solapamiento_turno` (ya quedó bien en la migración anterior).
- Columna `es_sobreturno`, RLS, frontend (`Turnos.tsx`, `MisTurnos.tsx`).
- Otros módulos.

### Resultado

Los sobreturnos podrán crearse en horarios ya ocupados sin que la base de datos los rechace, manteniendo la protección contra solapamientos accidentales entre turnos normales.

