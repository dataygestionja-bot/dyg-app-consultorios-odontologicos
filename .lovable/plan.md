# Vista semanal de turnos (matriz de doble entrada)

Replicar el formato de la imagen: filas = profesionales (con foto, nombre y resumen), columnas = días de la semana, celdas = estado del día (rango horario, día libre, ausencia, festivo) con cantidad de turnos.

## UX

- En `/turnos` agregar **toggle de modo de vista**:
  - "Agenda diaria" (la actual, sin tocar)
  - "Vista semanal" (nueva)
- Selector de semana con `< Semana X: DD Mes YYYY >` (igual que la imagen).
- Filtros simples arriba: profesional (multi), búsqueda por nombre.

## Estructura de la grilla

```text
┌──────────────────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┐
│ NOMBRE           │ Lun  │ Mar  │ Mié  │ Jue  │ Vie  │ Sáb  │ Dom  │
├──────────────────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┤
│ [foto] Apellido  │ 09-17│ Día  │ Fest.│ 12-20│ ...  │ ...  │ ...  │
│ Especialidad     │ 5 t. │ libre│      │ 3 t. │      │      │      │
│ horas semanales  │      │      │      │      │      │      │      │
└──────────────────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┘
```

- **Columna fija "Nombre"**: avatar (foto o iniciales) + Apellido, Nombre + especialidad + total de horas/turnos de la semana.
- **Celda por día**, prioridad de pintado:
  1. **Festivo** (lila) — si existe en `bloqueos_agenda` con motivo "festivo" o flag global (a confirmar). Por ahora: bloqueo todo_el_dia con motivo `festivo`.
  2. **Ausencia** (rojo claro) — bloqueo todo el día (vacaciones/enfermedad/licencia/etc).
  3. **Día libre** (rojo/rosa) — el profesional no tiene `horarios_profesional` activos ese día.
  4. **Turno horario** (amarillo "Mañana", verde "Tarde", azul "Noche") — rango del día desde `horarios_profesional`.
- Esquina superior derecha de cada celda: pequeño contador `N` (turnos confirmados/reservados ese día) o ícono de check.
- Click en celda → abre **panel lateral / dialog** con la lista de turnos de ese profesional ese día (paciente, hora, estado, acciones rápidas: ver / reprogramar).

## Datos

Fuente única por semana (rango `lunes..domingo`):

- `profesionales` activos → fila (incluye `foto_url`, `especialidad`).
- `horarios_profesional` (todos, por `dia_semana`) → rango horario y clasificación turno (Mañana <13:00, Tarde 13:00–19:00, Noche ≥19:00).
- `bloqueos_agenda` activos que se solapen con la semana → ausencias / festivos.
- `turnos` de la semana, agrupados por `profesional_id + fecha`, contando los que ocupan agenda (excluye `cancelado/reprogramado/ausente/solicitado/rechazado`).

Una sola query por entidad, en paralelo, y se arma la matriz en memoria.

## Archivos a crear / editar

- **Nuevo**: `src/components/turnos/AgendaSemanalMatriz.tsx`
  - Recibe `semanaInicio: Date`, `profesionales[]`, `horarios[]`, `bloqueos[]`, `turnos[]`.
  - Renderiza tabla sticky (header de días sticky-top, columna nombre sticky-left).
  - Maneja `onCellClick(profesional, fecha)`.
- **Nuevo**: `src/components/turnos/DiaProfesionalSheet.tsx` (Sheet con detalle del día).
- **Editar**: `src/pages/Turnos.tsx`
  - Agregar `Tabs` "Diaria | Semanal" arriba del contenido actual.
  - En tab Semanal: navegación por semana + `<AgendaSemanalMatriz />`.
  - Reusar fetchers existentes adaptados a rango semanal.

## Tokens de diseño

Agregar en `index.css` / `tailwind.config.ts` semánticos:
- `--agenda-manana` (amarillo suave)
- `--agenda-tarde` (verde suave)
- `--agenda-noche` (azul suave)
- `--agenda-libre` (rojo/rosa suave)
- `--agenda-ausencia` (rojo)
- `--agenda-festivo` (lila)

Todo en HSL, con variantes para dark mode.

## Fuera de alcance (siguiente iteración)

- Drag & drop de turnos entre celdas.
- Edición de horarios desde la grilla.
- Publicación/exportación de la semana (botón "Publicar" de la imagen).
