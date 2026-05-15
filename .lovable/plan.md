## Objetivo

Agregar en la página de Turnos un botón que abra un listado simple de turnos agrupados/listados por paciente, mostrando: **paciente, fecha del turno, hora y profesional**.

## UX

- Nuevo botón **"Listar por paciente"** en la barra superior de `src/pages/Turnos.tsx`, junto al buscador y el navegador de semana.
- Al hacer click se abre un **Dialog** (modal) con:
  - Input de búsqueda por nombre de paciente.
  - Filtro de rango de fechas (por defecto: la semana actual ya seleccionada en la página; con opción de cambiar "desde / hasta").
  - Tabla simple ordenada por **paciente (A-Z)** y luego por fecha:
    - Paciente (apellido, nombre)
    - Fecha (dd/MM/yyyy)
    - Hora
    - Profesional
    - Estado (badge)
  - Botón para cerrar.

No se modifica la matriz semanal existente ni el backend.

## Implementación técnica

**Archivos:**

1. **Nuevo:** `src/components/turnos/ListadoPorPacienteDialog.tsx`
   - Componente con `Dialog` de shadcn.
   - Props: `open`, `onOpenChange`, `fechaInicial: Date` (la semana actual de la página).
   - Estado interno: `desde`, `hasta`, `search`.
   - Query a Supabase:
     ```ts
     supabase.from("turnos")
       .select("id, fecha, hora_inicio, estado, paciente:pacientes(nombre, apellido), profesional:profesionales(nombre, apellido)")
       .gte("fecha", desde).lte("fecha", hasta)
       .order("fecha", { ascending: true })
     ```
   - Orden en cliente por `apellido, nombre` del paciente y luego fecha/hora.
   - Filtrado en cliente por `search` (apellido + nombre).
   - Render con `Table` de shadcn + `Badge` con `TURNO_ESTADO_LABELS` / `TURNO_ESTADO_CLASSES`.

2. **Editar:** `src/pages/Turnos.tsx`
   - Agregar estado `listadoOpen`.
   - Botón `<Button variant="outline">Listar por paciente</Button>` en la barra de acciones.
   - Renderizar `<ListadoPorPacienteDialog open=... onOpenChange=... fechaInicial={inicio} />`.

Sin cambios de schema ni de RLS (se usa el mismo acceso a `turnos` que ya tiene `AgendaSemanalMatriz`).
