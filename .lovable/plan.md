

Simple: add show/hide password toggle to the login form (and optionally register form) in `src/pages/Auth.tsx`.

## Plan — Mostrar/ocultar contraseña en login

### Cambio
En `src/pages/Auth.tsx` agregar un botón tipo "ojo" dentro del campo de contraseña que alterna entre `type="password"` y `type="text"`.

### Detalles
- Nuevo estado local `showLoginPassword` (boolean) en el componente.
- Wrapper `relative` alrededor del `Input` de contraseña con un `<button type="button">` posicionado a la derecha (`absolute right-2 top-1/2 -translate-y-1/2`).
- Iconos `Eye` / `EyeOff` de `lucide-react` (ya disponible en el proyecto).
- Padding derecho extra al input (`pr-10`) para que el texto no quede tapado por el botón.
- Accesible: `aria-label` dinámico ("Mostrar contraseña" / "Ocultar contraseña"), `tabIndex={-1}` opcional para no romper el flujo de tab.
- Aplicar el mismo patrón al campo de contraseña del tab "Crear cuenta" (estado `showRegPassword`) por consistencia.

### Archivo a editar
- `src/pages/Auth.tsx`

Sin cambios de backend, sin migraciones, sin nuevas dependencias.

