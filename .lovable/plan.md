# Colores de la matriz por carga de turnos

## Nueva lógica de color

El color de fondo de cada celda dejará de depender del turno (mañana/tarde/noche) y pasará a reflejar la **carga del día**:

| Estado / cantidad de turnos | Color |
|---|---|
| Día libre (sin agenda) | Verde claro |
| Ausencia | Gris (se mantiene) |
| Feriado | Rojo claro (se mantiene) |
| 1 a 3 turnos | Azul claro |
| 4 a 6 turnos | Violeta claro |
| 7 o más turnos | Amarillo claro |
| 0 turnos pero con agenda activa | Verde claro (igual que libre) |

Prioridad: Feriado > Ausencia > conteo de turnos / libre.

## Cambios técnicos

1. **`src/index.css`** — agregar/ajustar tokens HSL en `:root` y `.dark`:
   - `--agenda-libre` → verde claro
   - `--agenda-pocos` → azul claro (1–3)
   - `--agenda-medio` → violeta claro (4–6)
   - `--agenda-lleno` → amarillo claro (7+)
   - Mantener `--agenda-ausencia` y `--agenda-festivo`.
   - Eliminar (o dejar sin uso) `--agenda-manana/tarde/noche`.

2. **`src/components/turnos/AgendaSemanalMatriz.tsx`**:
   - Reemplazar el tipo `CellKind` por `"festivo" | "ausencia" | "libre" | "pocos" | "medio" | "lleno"`.
   - Función de clasificación: si feriado → festivo; si ausencia → ausencia; si no hay turnos → libre; si `count <= 3` → pocos; `<= 6` → medio; resto → lleno.
   - Actualizar `KIND_CLASSES` con los nuevos tokens.
   - Actualizar la leyenda inferior para reflejar los nuevos rangos.

Sin cambios en BD ni en otras vistas. La estructura de la celda (badge con conteo, primeros pacientes, click para abrir detalle) se mantiene.
