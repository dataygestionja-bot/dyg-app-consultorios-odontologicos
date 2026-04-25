
## Objetivo

Separar claramente el acceso público (pacientes) del acceso interno (profesionales / recepción / admin), y reemplazar la redirección automática de `/` por una **landing simple con dos botones**.

---

## Cambios propuestos

### 1. Nueva landing pública en `/`

Crear `src/pages/Landing.tsx`:
- Pantalla simple, centrada, con el branding actual (mismo estilo que `Auth.tsx`: ícono `Stethoscope`, tipografía, tokens del design system).
- Título: "Consultorios DG" + subtítulo breve.
- **Dos botones grandes**, uno debajo del otro (o lado a lado en desktop):
  - **"Solicitar turno"** → `Link` a `/reservar` (variante `default`, destacado).
  - **"Ingresar al sistema"** → `Link` a `/auth` (variante `outline`, secundario).
- Sin dependencia de `useAuth` → carga instantánea, accesible sin sesión.
- Footer mínimo opcional con un texto institucional.

### 2. Ajuste de ruteo en `src/App.tsx`

- **Eliminar** el componente `RootLanding` (que hoy redirige a `/reservar` o muestra Dashboard).
- La ruta `/` pasa a renderizar **`<Landing />`** directamente (pública, sin `ProtectedRoute`, sin `AppLayout`).
- **Nueva ruta `/dashboard`** protegida que muestra el `Dashboard` actual (para que el personal logueado tenga su pantalla principal sin chocar con la landing).
- Mantener:
  - `/reservar` → público (`ReservarTurno`).
  - `/reservar-turno` → redirect a `/reservar`.
  - `/auth` → página de login interna (sin cambios de lógica).
- El resto de rutas privadas siguen igual.

### 3. Ajuste post-login

En `src/lib/landing.ts`, cambiar `getLandingPathForRoles` para que devuelva **`/dashboard`** en lugar de `/` (todos los roles internos aterrizan en el Dashboard tras iniciar sesión, en vez de volver a la landing pública).

`Auth.tsx` no requiere cambios: ya usa `resolvePostLoginPath(roles, from)` para redirigir.

### 4. Sidebar / navegación interna

Revisar `AppSidebar.tsx`: si el link "Inicio / Dashboard" apunta a `/`, cambiarlo a `/dashboard` para que el personal interno no caiga en la landing pública desde el menú.

---

## Resultado esperado

| Usuario | Entra a `/` | Ve |
|---|---|---|
| Paciente (sin sesión) | `/` | Landing con 2 botones |
| Paciente | clic "Solicitar turno" | Formulario público `/reservar` |
| Personal | clic "Ingresar al sistema" | Login `/auth` |
| Personal logueado | tras login | `/dashboard` (Dashboard interno) |
| Personal logueado | navega a `/` manualmente | Sigue viendo la landing pública (no lo desloguea) |

- `/auth` queda exclusivamente para staff.
- `/reservar` queda 100% público, sin redirecciones forzadas.
- Ya no hay redirección automática de `/` → `/reservar`.

---

## Archivos a tocar

1. **Crear** `src/pages/Landing.tsx` — landing pública.
2. **Editar** `src/App.tsx` — quitar `RootLanding`, agregar `/` → `Landing` y `/dashboard` → Dashboard protegido.
3. **Editar** `src/lib/landing.ts` — `getLandingPathForRoles` devuelve `/dashboard`.
4. **Editar** `src/components/layout/AppSidebar.tsx` — actualizar el link de "Inicio/Dashboard" a `/dashboard` si correspondiera.

¿Avanzo con la implementación?
