## Objetivo

Mostrar en el **Dashboard** una lista clara y diferenciada de los turnos en estado `solicitado` (los que llegan desde el formulario público `/reservar-turno`), para que recepción los vea apenas entra y pueda actuar rápido.

## Diseño propuesto

Agregar una **nueva Card destacada** arriba del bloque "Turnos de hoy / Próximos turnos", que solo aparece **si hay solicitudes pendientes** (si no hay, no se muestra para no agregar ruido).

Estilo distintivo (consistente con la grilla de `/turnos`):
- Borde y fondo sutil con el color `--estado-solicitado` (naranja, ya definido en `src/index.css`).
- Ícono `Inbox` + título **"Turnos solicitados"** + badge con el conteo total.
- Cada item muestra: paciente, teléfono, profesional, fecha, hora, motivo y badge de estado `Solicitado` (mismo `TURNO_ESTADO_CLASSES.solicitado` que ya se usa en la grilla).
- Indicador visual de "origen público" (ícono `Globe` o similar) para reforzar que vino del link público.
- Botón **"Gestionar solicitudes"** en el header de la card que linkea a `/turnos/solicitudes` (la bandeja interna existente).
- Se listan hasta **5 solicitudes** ordenadas por `created_at` desc; si hay más, un link "Ver todas (N)" al final.

También sumar una **mini-stat card** en la fila de KPIs (junto a "Turnos hoy / Atendidos hoy / Próximos 7 días"), o reemplazar visualmente para que el conteo de solicitudes pendientes sea visible aunque no haya nuevas hoy. Propuesta: agregar una **4ª tarjeta KPI** "Solicitudes pendientes" con el color naranja del estado, clickeable hacia `/turnos/solicitudes`.

## Cambios técnicos

**Archivo único a modificar: `src/pages/Dashboard.tsx`**

1. Agregar estado `solicitudes: TurnoRow[]` y `solicitudesCount: number`.
2. En `cargar()`, sumar una query paralela:
   ```ts
   supabase.from("turnos")
     .select(select + ", origen, created_at, paciente:pacientes(nombre, apellido, telefono)")
     .eq("estado", "solicitado")
     .order("created_at", { ascending: false })
     .limit(5)
   ```
   Y un `count` separado para el total.
3. Extender la interfaz `TurnoRow` con `telefono` opcional en paciente y `origen`.
4. Renderizar la nueva Card destacada solo si `solicitudesCount > 0`, ubicada **entre los KPIs y la grilla de hoy/próximos**.
5. Agregar la 4ª tarjeta KPI "Solicitudes pendientes" (cambia el grid a `md:grid-cols-2 lg:grid-cols-4`).
6. Importar `Inbox`, `Globe` de `lucide-react` y `Link` (ya importado).

## Lo que NO cambia
- No se toca `/turnos` ni la grilla (sigue mostrando los `solicitado` con su color como ya se definió en migraciones anteriores).
- No se toca `/turnos/solicitudes` (la bandeja completa de gestión sigue igual).
- No se modifican estilos globales ni constantes (ya está todo definido).
- No hay cambios de DB ni de edge functions.

## Resultado esperado
Al entrar al Dashboard, recepción ve inmediatamente:
- KPI "Solicitudes pendientes: N" en naranja.
- Si hay solicitudes, una card destacada en naranja con las últimas 5, con acción directa a la bandeja de gestión.
