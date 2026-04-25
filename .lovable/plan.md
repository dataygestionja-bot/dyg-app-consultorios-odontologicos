# Plan: Actualizar mensaje de WhatsApp con opciones de respuesta

## Objetivo
Modificar el template del mensaje de recordatorio de turno por WhatsApp para incluir explícitamente las opciones de respuesta **CONFIRMO** o **CANCELO**.

## Cambio único

### Archivo: `src/components/turnos/WhatsAppTurnoButton.tsx`

Reemplazar la línea de construcción del mensaje:

**Antes:**
```ts
const mensaje = `Hola ${nombrePaciente}, te recordamos tu turno${conProfesional} el día ${fechaLeg} a las ${horaLeg}. Por favor confirma o responde a este mensaje.`;
```

**Después:**
```ts
const mensaje = `Hola ${nombrePaciente}, te recordamos tu turno${conProfesional} el día ${fechaLeg} a las ${horaLeg}.\n\nPor favor respondé: CONFIRMO o CANCELO`;
```

### Detalles
- Si el turno **no tiene profesional asignado**, se omite el fragmento " con el/la Dr/a. {profesional}" (comportamiento actual ya implementado).
- Se usa `\n\n` para separar el cuerpo del recordatorio de la línea de respuesta. WhatsApp respeta los saltos de línea.

## Sin cambios en backend
El webhook `whatsapp_webhook` ya reconoce las palabras **CONFIRMO** y **CANCELO** (junto con CONFIRMAR, SI, SÍ, CANCELAR, NO). No requiere modificación.

## Alcance
- 1 archivo modificado (frontend).
- Sin cambios en base de datos, edge functions ni estilos.
- Sin impacto en otras vistas.
