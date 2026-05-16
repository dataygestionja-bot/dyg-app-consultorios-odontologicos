## Objetivo

Configurar `https://app.rcta.me/OnBoarding` como la URL oficial de la integración RCTA.

## Cambios

1. **Migración SQL**: actualizar el registro de `integraciones_externas` con `codigo = 'rcta'` para que `url = 'https://app.rcta.me/OnBoarding'` (y dejarlo como default del seed inicial si aún no se ejecutó).
2. **Verificación UI**: confirmar que en `/seguridad/integraciones` aparezca la URL nueva y que al hacer clic en la tarjeta de RCTA desde el detalle de la atención se abra `https://app.rcta.me/OnBoarding` en nueva pestaña.

## Notas

- No se cambia lógica ni permisos: el admin sigue pudiendo editar la URL desde `/seguridad/integraciones` si en el futuro RCTA cambia el enlace.
- El registro de auditoría `abrir_rcta` continúa guardando la URL efectivamente abierta.
