## Integración RCTA – Recetas electrónicas externas

MVP sin API: solo abrir RCTA en otra pestaña, registrar la apertura, y permitir adjuntar manualmente número/link/PDF a la atención.

### 1. Base de datos (migración)

**Tabla `integraciones_externas`** (configuración general, una fila por integración)
- `codigo` (text, unique) – ej. `rcta`
- `nombre` (text) – "RCTA"
- `activa` (bool, default true)
- `url` (text)
- `logo_url` (text, nullable)
- `abrir_nueva_pestana` (bool, default true)
- timestamps

RLS:
- SELECT: cualquier usuario autenticado.
- INSERT/UPDATE/DELETE: solo `admin` (vía `has_role`).

Seed inicial: una fila `rcta` con la URL `https://www.rcta.me/` (placeholder, editable) y el logo subido por el usuario.

**Tabla `recetas_externas`** (recetas manualmente registradas en una atención)
- `atencion_id` (fk → atenciones, cascade)
- `paciente_id` (fk → pacientes)
- `profesional_id` (fk → profesionales)
- `integracion_codigo` (text, default `rcta`)
- `numero_receta` (text, nullable)
- `link` (text, nullable)
- `archivo_url` (text, nullable) – guardado en bucket `recetas-externas`
- `observaciones` (text, nullable)
- `fecha` (date, default current_date)
- timestamps + `created_by` (uuid)

RLS:
- SELECT: cualquier usuario autenticado (recepción puede ver).
- INSERT/UPDATE/DELETE: usuarios con permiso `atenciones.update` (profesional/admin). Recepción no edita salvo permiso específico.

**Bucket de Storage** `recetas-externas` (privado) con policies para que profesional/admin suban y todos los autenticados puedan leer (URL firmada al renderizar).

**Auditoría** – reusar la tabla existente `audit_log` con `accion = 'abrir_rcta'`, `entidad = 'atencion'`, `entidad_id = atencion.id`, `descripcion` con paciente + URL utilizada. Se inserta con la función RPC `log_audit_event` ya disponible (ver `src/lib/audit.ts`).

### 2. Pantalla de configuración (admin)

Nueva ruta **`/seguridad/integraciones`** → `src/pages/seguridad/Integraciones.tsx`.

- Lista las integraciones de `integraciones_externas`.
- Formulario para editar: nombre, URL, logo (upload a bucket público `integraciones-logos`), activa, abrir en nueva pestaña.
- Enlace en `AppSidebar` (sección Seguridad) visible solo para admin.
- Protegida por `ProtectedRoute` + `has_role('admin')`.

### 3. UI en Detalle de Atención

En `src/pages/AtencionDetalle.tsx` agregar nueva sección **"Receta electrónica externa"** debajo de la sección actual de prácticas/observaciones:

- Carga la config de `rcta` desde `integraciones_externas`.
- Si `activa = false`: muestra card deshabilitada con texto "Integración no disponible".
- Si activa: card con logo centrado, texto "Abrir RCTA" y subtexto descriptivo. Click en logo o card → `AlertDialog` con título "Abrir RCTA" y los textos exactos del requerimiento, botones Cancelar / Abrir RCTA.
- Al confirmar:
  1. `window.open(url, '_blank', 'noopener,noreferrer')` (o misma pestaña si `abrir_nueva_pestana = false`).
  2. `registrarEvento({ accion: 'abrir_rcta', entidad: 'atencion', entidadId: atencion.id, descripcion: 'Paciente <nombre> – URL <url>' })`.

Diseño: card con `rounded-2xl`, hover sutil (`hover:shadow-md hover:-translate-y-0.5 transition`), logo `max-h-16` centrado, responsive (single column en mobile, 2 col en desktop si conviven con otras integraciones futuras). Usa tokens semánticos (`bg-card`, `text-foreground`, `border`).

### 4. Recetas registradas en la atención

Debajo de la card RCTA, sub-sección **"Recetas registradas"**:

- Lista las filas de `recetas_externas` para la atención (tabla compacta: fecha, profesional, plataforma, número, link clickeable, ícono adjunto, observaciones).
- Botón "Agregar receta" (solo si el usuario tiene `atenciones.update`) que abre un `Dialog` con campos: número, link, archivo (upload opcional al bucket), observaciones. Profesional y paciente se infieren de la atención.
- Permite editar/eliminar (solo creador o admin) con ícono.

### 5. Historia clínica del paciente

En `src/components/paciente/HistorialAtenciones.tsx` (o donde se muestra la HC del paciente) agregar tab/bloque adicional **"Recetas externas"** con todas las recetas del paciente: fecha, profesional, plataforma RCTA, número, link, adjunto, observaciones. Solo lectura desde acá.

### 6. Permisos (`role_permissions`)

Agregar entradas para el nuevo módulo `recetas_externas`:

| role        | read | create | update | delete |
|-------------|------|--------|--------|--------|
| admin       | ✅   | ✅     | ✅     | ✅     |
| profesional | ✅   | ✅     | ✅     | ❌     |
| recepcion   | ✅   | ❌     | ❌     | ❌     |

Y `integraciones`:

| role  | read | update |
|-------|------|--------|
| admin | ✅   | ✅     |
| otros | ✅   | ❌     |

El componente usa `usePermissions()` (ya existente) para mostrar/ocultar acciones.

### 7. Assets

- Copiar el logo subido (`user-uploads://RCTA.jpg`) a `src/assets/rcta-logo.jpg` como fallback bundled, y también subirlo a Storage para que sea editable por el admin. La card prefiere `integracion.logo_url`; si no existe, usa el import local.

### Detalles técnicos (referencia)

- Migración crea: tablas, RLS, función trigger `updated_at`, seed `rcta`, bucket privado, bucket público para logos, policies storage.
- Nuevas rutas en `App.tsx`: `/seguridad/integraciones`.
- Nuevos componentes: `IntegracionRctaCard.tsx`, `RecetasExternasSection.tsx`, `RecetaExternaDialog.tsx`.
- Auditoría reutiliza `registrarEvento` de `src/lib/audit.ts`.

### Fuera de alcance (explícito)

- No se llama a ninguna API de RCTA.
- No se emite ni valida la receta desde el sistema.
- No hay sincronización ni webhook.
