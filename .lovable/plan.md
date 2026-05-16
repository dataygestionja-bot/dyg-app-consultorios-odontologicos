## Objetivo

Permitir abrir RCTA desde el formulario de atención sin necesidad de haberla guardado previamente.

## Cambio

En `src/components/integraciones/IntegracionRctaInline.tsx`:
- Quitar el estado deshabilitado y el tooltip "Guardá la atención primero".
- El botón siempre abre el diálogo de confirmación y, al aceptar, abre RCTA en nueva pestaña.
- La auditoría (`registrarEvento`) sólo se registra cuando ya existe `atencionId`; si la atención aún no fue creada, simplemente se omite el log (sin error).

No se tocan permisos, esquema, ni el resto de la integración.
