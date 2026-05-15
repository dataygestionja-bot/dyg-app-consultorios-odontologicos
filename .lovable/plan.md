## Objetivo

Cambiar el texto del tooltip del botón de WhatsApp de "Enviar WhatsApp" a "Enviar recordatorio de turno" cuando el paciente tiene teléfono.

## Cambio

**Archivo único: `src/components/turnos/WhatsAppTurnoButton.tsx`**

En la lógica de `tooltipText` (línea ~93), reemplazar el literal `"Enviar WhatsApp"` por `"Enviar recordatorio de turno"`. Se mantienen los otros dos casos: `"Paciente sin teléfono"` (sin teléfono) y `"Enviando..."` (loading).
