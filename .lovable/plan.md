## Cambio

En el tablero (Dashboard), cuando el usuario logueado tiene rol `profesional` (y no es además `admin` ni `recepcion`), filtrar todas las consultas para que solo vea sus propios turnos.

## Detalles técnicos

Archivo: `src/pages/Dashboard.tsx`

1. Obtener el `profesional_id` del usuario logueado:
   - Usar `useAuth()` para obtener `user` y `hasRole`.
   - Calcular `soloMisTurnos = hasRole("profesional") && !hasRole("admin") && !hasRole("recepcion")`.
   - Si `soloMisTurnos`, consultar `profesionales` por `user_id = user.id` para obtener el `id` del profesional. Guardarlo en estado (`miProfesionalId`).

2. En `cargar()`, aplicar `.eq("profesional_id", miProfesionalId)` a las 7 queries cuando `soloMisTurnos` esté activo:
   - turnos de hoy
   - próximos 7 días
   - atendidos hoy (count)
   - solicitudes (lista y count)
   - pendientes de cierre (lista y count)

3. Disparar `cargar()` recién cuando se haya resuelto `miProfesionalId` (o se haya determinado que el usuario no es profesional puro), para evitar mostrar datos de todos por una fracción de segundo.

4. Ajuste menor de UX: para el profesional, ocultar la tarjeta "Pendientes de cierre" del header solo si se mantiene el gate por `canManagePendientes` (ya está condicionado a admin/recepción, queda igual). El bloque de "Solicitudes" se mantiene visible solo si tiene solicitudes propias.

No requiere cambios de base de datos ni RLS — las políticas actuales ya permiten al profesional leer todos los turnos; este es un filtro de presentación en el cliente.
