## Problema

Al guardar una atención (alta) el backend rechaza con:

> new row violates row-level security policy for table "atenciones"

La política de INSERT (`Atenciones: alta por permiso`) requiere:

```
has_permission(auth.uid(), 'atenciones', 'create') AND (
  NOT has_role(auth.uid(), 'profesional')
  OR has_role(auth.uid(), 'admin')
  OR profesional_id IN (select id from profesionales where user_id = auth.uid())
)
```

Pero en `role_permissions`, para el módulo `atenciones`, **todos los roles** tienen `create = false`:

| role        | read | create | update | delete |
|-------------|------|--------|--------|--------|
| admin       | ✅   | ❌     | ❌     | ❌     |
| profesional | ✅   | ❌     | ✅     | ❌     |
| recepcion   | ✅   | ❌     | ❌     | ❌     |

Por eso ningún usuario puede crear una atención (ni siquiera admin). El mismo problema afectará a `update` y `delete` para admin/recepcion.

## Solución

Migración SQL que actualice `role_permissions` para alinear los permisos del módulo `atenciones` con quienes realmente operan el módulo:

```sql
UPDATE public.role_permissions SET allowed = true
 WHERE module = 'atenciones'
   AND (
        (role = 'admin'       AND action IN ('create','update','delete'))
     OR (role = 'profesional' AND action = 'create')
   );
```

Resultado esperado:

| role        | read | create | update | delete |
|-------------|------|--------|--------|--------|
| admin       | ✅   | ✅     | ✅     | ✅     |
| profesional | ✅   | ✅     | ✅     | ❌     |
| recepcion   | ✅   | ❌     | ❌     | ❌     |

`recepcion` sigue sin poder crear/editar/eliminar atenciones (sólo lectura), que es el comportamiento típico. Si querés que recepción también pueda dar de alta atenciones, lo agregamos.

No se tocan políticas RLS, schema, ni código frontend. La política ya está bien diseñada: el problema es sólo de configuración de permisos.

## Preguntas antes de implementar

1. ¿Confirmás otorgar `create/update/delete` a **admin** y `create` a **profesional**?
2. ¿`recepcion` debe poder crear atenciones también (ej. atenciones espontáneas / urgencias)?
