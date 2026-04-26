## Diagnóstico

Hoy las dos tarjetas en el Dashboard usan tonos casi idénticos:
- **Solicitudes pendientes** → `--estado-solicitado` = `hsl(38 92% 50%)` (ámbar/naranja).
- **Pendientes de cierre** → `amber-500` de Tailwind ≈ `hsl(38 92% 50%)` (también ámbar).

Por eso visualmente parecen lo mismo, aunque conceptualmente representan flujos distintos:
- *Solicitudes* = entrada nueva al sistema (algo por confirmar).
- *Pendientes de cierre* = problema/alerta operativa (algo del pasado sin resolver).

## Propuesta

Asignar a cada tarjeta una identidad cromática propia, alineada con su semántica:

### 1. "Solicitudes pendientes" → mantener color de marca de "solicitado"
- Sigue usando `--estado-solicitado` (ámbar). Sin cambios; es coherente con el badge del estado "solicitado" en toda la agenda.

### 2. "Pendientes de cierre" → cambiar a **rosa/magenta** (alerta operativa diferenciada)
- Es un estado que **requiere acción correctiva** sobre el pasado, no una entrada nueva.
- Crear nueva variable CSS `--estado-pendiente-cierre` con un tono claramente distinto del resto:
  - "Cancelado" ya es rojo (`0 75% 50%`).
  - "Rechazado" rojo oscuro (`0 60% 40%`).
  - "Solicitado" ámbar (`38 92% 50%`).
  - **Propuesta default: magenta `340 75% 50%`** — claramente distinguible de todos los anteriores.

### 3. Aplicar la nueva variable de forma consistente

**`src/index.css`** (light + dark mode):
- Agregar `--estado-pendiente-cierre: 340 75% 50%;` en ambos bloques `:root` y `.dark`.

**`src/lib/constants.ts`**:
- Reemplazar `pendiente_cierre: "bg-amber-500 text-white"` por `"bg-[hsl(var(--estado-pendiente-cierre))] text-white"` para que el badge en toda la app (Dashboard, MisTurnos, Turnos, etc.) refleje el nuevo color.

**`src/pages/Dashboard.tsx`** (líneas 182–199 y la bandeja inferior):
- Reemplazar `border-amber-500`, `text-amber-500`, `text-amber-600 dark:text-amber-400` por estilos inline con `hsl(var(--estado-pendiente-cierre))`, igual que ya se hace con la tarjeta de Solicitudes.
- Aplicar el mismo cambio a la **bandeja de "Turnos pendientes de cierre"** (borde izquierdo, ícono y badge de cantidad) para mantener coherencia.

## Resultado visual

| Tarjeta | Color actual | Color propuesto |
|---|---|---|
| Solicitudes pendientes | Ámbar | Ámbar (sin cambio) |
| Pendientes de cierre | Ámbar (idéntico) | **Magenta** (claramente distinto) |

Beneficios:
- Se distinguen al instante.
- "Pendientes de cierre" gana jerarquía visual sin chocar con "Cancelado" (rojo) ni con "Solicitado" (ámbar).
- El cambio se propaga automáticamente al badge de estado en el resto de la app vía `TURNO_ESTADO_CLASSES`, manteniendo coherencia.

## Archivos a modificar

1. `src/index.css` — nueva variable `--estado-pendiente-cierre` (light y dark).
2. `src/lib/constants.ts` — actualizar clase del estado.
3. `src/pages/Dashboard.tsx` — KPI card y bandeja usando la nueva variable.

Sin migraciones de DB, sin cambios de lógica.

## Alternativas de color

Si el magenta no te convence:
- **Coral/naranja oscuro**: `hsl(15 80% 50%)` — más cálido, dentro de la familia "alerta".
- **Violeta**: `hsl(280 65% 55%)` — muy diferenciado pero menos "alarmante".

Decime si vamos con magenta (default), coral o violeta y avanzo.