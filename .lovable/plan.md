## Cambio

En la pantalla **Ver atención** (`src/pages/AtencionDetalle.tsx`), tarjeta **Prácticas realizadas**, eliminar las columnas que ya no se cargan en el nuevo formulario:

- Cara
- Cantidad
- Observación

La tabla queda con solo dos columnas: **Prestación** y **Pieza**.

## Detalles técnicos

Editar `src/pages/AtencionDetalle.tsx` (líneas 237-273):

- Quitar `<TableHead>` de Cara, Cantidad y Observación.
- Quitar las `<TableCell>` correspondientes en el map de `atencion_practicas`.
- Ajustar `colSpan={5}` → `colSpan={2}` en la fila "Sin prácticas registradas".
- Quitar la clase `hidden sm:table-cell` de la columna Pieza para que sea siempre visible (ya que queda como única columna secundaria).

No se modifica la base de datos ni el formulario de carga: los campos siguen existiendo en el modelo, solo se ocultan en esta vista de detalle.
