## Objetivo

Mostrar el logo de RCTA como botón clickeable inline en el encabezado de la tarjeta **"Prácticas realizadas"** del formulario de Atención, a la izquierda del botón **"+ Agregar fila"** (igual que la captura).

## Cambios

1. **Nuevo componente compacto** `IntegracionRctaInline` (o variante `compact` del actual `IntegracionRctaCard`):
   - Render: botón con el logo de RCTA (`max-h-7`, object-contain, bordes redondeados, hover suave).
   - Mismo flujo que la tarjeta actual: lee `integraciones_externas` por `codigo='rcta'`, muestra `AlertDialog` de confirmación, abre la URL en nueva pestaña y registra `audit_log` con `accion='abrir_rcta'`.
   - Si la integración está inactiva → no renderiza nada (para no ensuciar el header del form).

2. **`src/pages/AtencionForm.tsx`** (línea ~748):
   - En el `CardHeader` de "Prácticas realizadas", agregar el componente entre el `CardTitle` y el botón "Agregar fila":
     ```
     <div className="flex items-center gap-2">
       <IntegracionRctaInline atencionId={id} pacienteNombre={...} />
       <Button>+ Agregar fila</Button>
     </div>
     ```
   - Pasa el `id` actual de la atención (o `null` si todavía no fue creada — en ese caso el logo se muestra deshabilitado con tooltip "Guardá la atención primero").

3. **`src/pages/AtencionDetalle.tsx`**: agregar el mismo logo inline en el header de "Prácticas realizadas" para mantener consistencia. La tarjeta grande RCTA existente se elimina de allí (queda solo el inline + la sección "Recetas registradas").

## Notas

- No cambia el esquema, permisos ni la sección "Recetas externas registradas" (sigue debajo).
- Auditoría y confirmación previa se mantienen idénticas.
- Responsive: en mobile el logo y el botón se mantienen en la misma fila (`flex items-center gap-2`), el logo no excede 28px de alto.
