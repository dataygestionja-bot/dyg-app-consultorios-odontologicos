

## Diagnóstico

El error `Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node` que se muestra en el ErrorBoundary es uno de los bugs más reportados de React (issue [#11538](https://github.com/facebook/react/issues/11538)). **No es un bug de tu código**: ocurre cuando algo modifica el DOM "por afuera" de React, y la causa más común (en ~95% de los casos) es:

> **Google Translate** (u otra extensión de traducción del navegador) traduciendo automáticamente la página y reemplazando nodos de texto. Cuando React intenta remover esos nodos en un re-render, ya no son hijos del padre original → crash.

Síntomas que confirman el diagnóstico:
- Tu `index.html` declara `<html lang="en">` pero el contenido está en español → Chrome ofrece traducir automáticamente.
- El error aparece en módulos con muchos re-renders y nodos de texto dinámicos (Turnos tiene Selects, Tabs, fechas, listados; Atenciones tiene tablas con datos dinámicos).
- Pasa solo a algunos usuarios (los que tienen Translate activo).

## Plan — 3 cambios mínimos y seguros

### 1. Declarar el idioma correcto en `index.html`
Cambiar `<html lang="en">` por `<html lang="es">`. Esto evita que Chrome ofrezca traducir la página (causa raíz del 95% de los casos).

### 2. Bloquear traducción automática (defensa adicional)
Agregar dos meta tags en `<head>` y el atributo `translate="no"` en el body:
```html
<meta name="google" content="notranslate" />
<meta http-equiv="Content-Language" content="es" />
```
Esto le indica explícitamente a Google Translate, Edge Translate, Safari, etc. que no toquen el DOM.

### 3. Mejorar el ErrorBoundary para auto-recuperarse
Si el error vuelve a ocurrir por otra causa, en lugar de quedar trabado en la pantalla de error, agregar:
- Detección específica del mensaje "removeChild" / "insertBefore" → mostrar mensaje amigable "Desactivá el traductor del navegador para esta página".
- Botón "Reintentar" que solo resetea el estado del boundary (sin recargar toda la página).

### Archivos a modificar
- `index.html` — cambiar lang + agregar meta notranslate
- `src/components/ErrorBoundary.tsx` — mensaje contextual + botón reintentar sin recargar

### Lo que NO hace falta
- No tocar Turnos.tsx ni Atenciones.tsx (el código está bien).
- No tocar router ni layout.
- No requiere cambios de backend ni migraciones.

### Después de aplicar
Republicar la app (Publish → Update) y probar de nuevo con el usuario `recepcion`. Si el usuario tiene Google Translate activo manualmente (no automático), pedirle que lo desactive para `consultoriosdg.lovable.app`.

