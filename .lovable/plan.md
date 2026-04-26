## Objetivo

En la página pública de solicitud de turnos (`/reservar`), el campo de celular debe:
- Mostrar **`549`** como prefijo fijo no editable (sin el signo `+`).
- Permitir al usuario ingresar **solo los 10 dígitos restantes** (código de área + número, sin 0 y sin 15).
- Enviar al backend el número completo de **13 dígitos** (`549XXXXXXXXXX`).

## Cambios técnicos

**Archivo a modificar:** `src/pages/public/ReservarTurno.tsx`

### 1. UI del campo teléfono
- Reemplazar el `<Input>` simple por un grupo compuesto:
  - Un addon a la izquierda con el texto fijo **`549`** (estilo `bg-muted`, no editable, visualmente integrado al input).
  - El `<Input>` editable a la derecha, con:
    - `maxLength={10}`
    - `inputMode="numeric"`
    - `placeholder="1123456789"`
    - Filtro en `onChange`: `e.target.value.replace(/\D/g, "")` para aceptar solo dígitos.

### 2. Texto de ayuda
Actualizar el helper text debajo del campo:
> *"Ingresá los 10 dígitos sin 0 y sin 15 (código de área + número). El prefijo 549 ya está incluido."*

### 3. Validación
En `validarForm`, validar que `form.telefono` cumpla exactamente con `/^\d{10}$/`. Mensaje de error:
> *"El teléfono debe tener exactamente 10 dígitos."*

### 4. Envío al backend
En `handleSubmit`, concatenar el prefijo antes de invocar la edge function:

```typescript
const response = await supabase.functions.invoke("public_solicitar_turno", {
  body: { 
    ...form, 
    telefono: `549${form.telefono}` // 13 dígitos totales
  },
});
```

## Fuera de alcance
- No se modifica la edge function `public_solicitar_turno` (sigue recibiendo el teléfono ya armado).
- No se modifican otros formularios de teléfono del sistema (solo el público).
- No se agrega el signo `+` en ningún punto.
