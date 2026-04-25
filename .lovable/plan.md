## Objetivo

Hacer los botones de la columna **Acciones** más compactos y con etiquetas más descriptivas en `/turnos/solicitudes`.

## Cambios en `src/pages/TurnosSolicitados.tsx` (líneas 478-521)

### 1. Reducir tamaño de los botones

- Reemplazar `size="sm"` por una clase más compacta: `h-7 px-2 text-xs` (más bajos y con menos padding horizontal).
- Mantener los íconos en `h-3.5 w-3.5`.
- Cambiar `gap-1` por `gap-1.5` para que los botones más juntos respiren un poco mejor.

### 2. Renombrar etiquetas

| Antes | Después |
|---|---|
| Validar | **Validar datos de paciente** |
| Confirmar | **Confirmar turno** |
| Reprogramar | Reprogramar *(sin cambios)* |
| Rechazar | **Rechazar turno** |

### 3. Resultado visual

Fila con validación requerida:
**[⚠ Validar datos de paciente] [✓ Confirmar turno] [📅 Reprogramar] [✕ Rechazar turno]**

Fila sin validación:
**[✓ Confirmar turno] [📅 Reprogramar] [✕ Rechazar turno]**

Los botones quedan ~25% más bajos y con texto más informativo. Si en pantallas chicas la fila se vuelve muy larga, el `flex-wrap justify-end` ya existente permite que los botones bajen a una segunda línea sin romper el layout.

## Fuera de alcance

- No se tocan los diálogos de Validar / Reprogramar / Rechazar (los textos internos ya son descriptivos).
- No se modifica lógica ni handlers, solo estilos y labels.
