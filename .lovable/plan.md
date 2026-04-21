

## Indicador de horario en "Turnos de hoy"

Agregar al lado del badge de estado, en la lista **Turnos de hoy** del Dashboard, un indicador visual que le diga a recepción si un turno **ya pasó su horario sin atender**, está **en curso** o **aún no llegó**.

### Reglas de visualización

Calculado en cliente comparando `hora_inicio`/`hora_fin` del turno con la hora actual:

- **Estado `atendido`** → no se muestra ningún indicador (el turno se cumplió).
- **Estado `cancelado` o `ausente`** → no se muestra indicador (ya tiene un cierre informativo).
- **Hora actual < `hora_inicio`** → badge gris suave **"Pendiente"** (aún no es la hora).
- **`hora_inicio` ≤ hora actual ≤ `hora_fin`** → badge azul **"En horario"** (está dentro de la franja del turno).
- **Hora actual > `hora_fin`** y estado distinto de `atendido` → badge ámbar/rojo **"Fuera de horario"** con ícono de reloj. Este es el caso clave: turno cuya ventana ya pasó sin atención registrada.

### Cambios en `src/pages/Dashboard.tsx`

1. **Reloj reactivo**: agregar `useState<Date>(new Date())` con un `useInterval` (`setInterval` de 60s en `useEffect`) para que el indicador se recalcule cada minuto sin recargar.
2. **Helper `getHorarioInfo(turno, ahora)`**: devuelve `{ label, className } | null` aplicando las reglas de arriba. Compara armando `Date` desde `fecha + hora_inicio` y `fecha + hora_fin`.
3. **Render**: dentro del `<li>` de cada turno de hoy, junto al `Badge` de estado, renderizar un segundo `Badge` (variante `outline` con clases de color) cuando el helper devuelva un valor.
4. **Layout**: envolver los dos badges en un `div className="flex items-center gap-2 shrink-0"` para que no rompan en mobile. En viewports angostos (<400px) los badges hacen wrap natural.

### Ámbito

- **Solo afecta** la lista "Turnos de hoy" del Dashboard.
- **No** se modifica la tarjeta "Próximos turnos" (todos son a futuro, no aplica).
- **No** se modifica la grilla de `/turnos` ni la base de datos.
- **No** cambia la lógica de estados ni triggers.

### Resultado

Recepción puede ver de un vistazo en el Dashboard qué turnos del día ya vencieron sin haber sido atendidos, cuáles están corriendo ahora y cuáles aún faltan, sin sumar ruido en los turnos ya completados.

