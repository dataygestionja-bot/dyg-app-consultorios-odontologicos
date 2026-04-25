## Diagnóstico

En `src/pages/TurnosSolicitados.tsx` (líneas 480-503), las acciones "Validar" y "Confirmar" están en un `if/else` excluyente:

- Si `necesitaValidar(s) === true` → solo se renderiza **Validar** (warning).
- Si no → solo se renderiza **Confirmar** (verde).

Como tus dos turnos actuales (Federico Nieto y Juan Roman Riquelme) son pacientes nuevos provisorios, ambos caen en el primer caso y por eso desapareció el botón verde de Confirmar.

## Cambio propuesto

En la columna **Acciones** de la grilla de turnos solicitados:

- Mostrar **siempre** el botón **Confirmar** (verde) para turnos pendientes.
- Mostrar **además** el botón **Validar** (warning) cuando `necesitaValidar(s) === true`, ubicado **antes** de Confirmar para que sea la acción sugerida visualmente.
- Mantener Reprogramar y Rechazar como hoy.

Orden final en filas que requieren validación:
**[⚠ Validar] [✓ Confirmar] [📅 Reprogramar] [✕ Rechazar]**

En filas sin necesidad de validar:
**[✓ Confirmar] [📅 Reprogramar] [✕ Rechazar]**

## Comportamiento

- "Confirmar" ejecuta `handleConfirmar(s)` directamente (sin pasar por el diálogo de validación), confirmando el turno y enviando WhatsApp tal como antes.
- "Validar" sigue abriendo el diálogo con la comparación / el flujo de paciente provisorio.
- La recepcionista decide: si confía en los datos, click directo en Confirmar; si quiere revisar primero, abre Validar.

## Archivos a tocar

- `src/pages/TurnosSolicitados.tsx` (única edición, ~10 líneas en la sección Acciones de la tabla).

No requiere migración ni cambios en edge functions.