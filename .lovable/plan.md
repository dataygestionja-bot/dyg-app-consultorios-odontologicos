# Odontograma interactivo y anatómico

Reemplazo del "Resumen por diente" (grilla de tarjetas) por un odontograma visual con representación anatómica de las 32 piezas, modal de acción por pieza con historial completo y nueva paleta de estados clínicos.

## 1. Modelo de datos

La tabla `odontograma_registros` ya cubre lo necesario (paciente_id, diente, estado, fecha, profesional_id, observaciones, created_at). Solo necesita ampliarse el enum `diente_estado` para soportar las nuevas acciones clínicas.

Migración:
- Agregar valores al enum `diente_estado`: `obturacion`, `endodoncia`, `corona`, `extraccion_indicada`, `implante`, `protesis`, `fractura`, `tratamiento_en_curso`, `otro`.
- Se mantienen los existentes (`sano`, `caries`, `restauracion`, `ausente`, `observacion`). `restauracion` queda como alias visual de obturación previa; `observacion` se mantiene por compatibilidad histórica pero no se ofrece en el selector nuevo.
- No se agregan columnas: `usuario_creador` se mapea a `profesional_id` + el `audit_log` ya registra al usuario; `fecha_creacion` = `created_at`.

## 2. Constantes y paleta (src/lib/constants.ts + index.css)

Nuevos labels y colores semánticos por estado (tokens HSL en `index.css`, mapeados en `tailwind.config.ts` y referenciados en `DIENTE_ESTADO_CLASSES` / `DIENTE_ESTADO_DOT`):

- Sano → verde
- Caries → rojo
- Obturación → azul
- Endodoncia → violeta
- Corona → dorado
- Extracción indicada → naranja
- Ausente → gris
- Implante → celeste
- Prótesis → marrón claro
- Fractura → rojo oscuro
- Tratamiento en curso → amarillo
- Otro → gris azulado

## 3. Componente `OdontogramaAnatomico` (nuevo)

`src/components/paciente/OdontogramaAnatomico.tsx` reemplaza la sección "Resumen por diente" dentro de `Odontograma.tsx`. La leyenda, el botón "Agregar registro" y el historial tabular se conservan.

Layout:

```text
              DERECHA  |  IZQUIERDA
  Superior:  18 17 16 15 14 13 12 11 | 21 22 23 24 25 26 27 28
  ─────────────────────────────────────────────────────────────
  Inferior:  48 47 46 45 44 43 42 41 | 31 32 33 34 35 36 37 38
```

- Numeración FDI (estándar odontológico). Internamente se mapea cada FDI ↔ número 1–32 que ya usa la tabla (1–8 = cuadrante 1, 9–16 = cuadrante 2, 17–24 = cuadrante 3, 25–32 = cuadrante 4) para no romper datos existentes.
- Cada pieza se dibuja como un SVG con silueta anatómica diferenciada por tipo (molar, premolar, canino, incisivo) y se rellena con el color del último estado. Bordes redondeados, sombra sutil, hover con `ring-primary` y escala leve.
- Etiquetas "Derecha" / "Izquierda" y líneas divisorias entre arcadas y entre cuadrantes.
- Tooltip nativo (`title`) y `Tooltip` de shadcn al hover con: pieza, estado, fecha último registro y profesional.
- Click sobre la pieza abre el modal de acción.

Responsive:
- Desktop/tablet: layout completo centrado.
- Mobile (`< sm`): wrapper con `overflow-x-auto`, ancho mínimo que asegure legibilidad (~640px). Etiquetas de cuadrante se mantienen.

## 4. Modal de acción por pieza (`PiezaDentalDialog`)

Componente nuevo abierto al click. Contenido:

- Título: `Pieza {fdi}` (con número 1–32 interno entre paréntesis).
- Resumen: estado actual + fecha y profesional del último registro (o "Sin registros").
- Tabs:
  - **Nueva acción** (default):
    - Select **Acción / diagnóstico** con los 12 estados nuevos.
    - Datepicker (default: hoy).
    - Select **Profesional** (pre-seleccionado el del usuario logueado).
    - Textarea **Observaciones**.
    - Botones **Guardar** / **Cancelar**.
  - **Historial**: tabla compacta con todos los registros de esa pieza ordenados por fecha desc (fecha, estado con dot color, profesional, observaciones).

Guardado: `insert` en `odontograma_registros`, luego refresca la lista del padre (callback `onSaved`).

## 5. Integración

- `src/components/paciente/Odontograma.tsx`: la grilla actual (líneas 192–252) se reemplaza por `<OdontogramaAnatomico registros={registros} onPiezaClick={...} />`. Se conservan leyenda, botón "Agregar registro" genérico, filtro por diente del historial inferior y el modo `inline` para `AtencionForm`.
- `mode="inline"` (uso dentro de la atención): el click en la pieza usa el `Popover` rápido actual o el modal completo según se prefiera; por defecto se mantiene el `Popover` para flujo rápido en la atención y se usa el modal completo en la vista del paciente.
- `HistorialOdontograma.tsx` no requiere cambios (sigue mostrando todos los registros del paciente).

## 6. Detalles técnicos

- SVG por pieza: 4 plantillas (molar, premolar, canino, incisivo) en un único archivo `src/components/paciente/odontograma/ToothSVG.tsx`. Reciben `estado`, `numero`, `seleccionado`, `onClick`.
- Mapeo FDI ↔ interno en `src/lib/odontograma.ts` (función `fdiToInterno(n)` y `internoToFdi(n)`).
- Accesibilidad: cada `<button>` con `aria-label="Pieza {fdi}, estado {label}, último registro {fecha}"`.
- Colores: todos vía tokens semánticos (`bg-[hsl(var(--diente-caries))]`, etc.), nada hardcoded en componentes.

## 7. Archivos afectados

- Nuevo: `src/components/paciente/OdontogramaAnatomico.tsx`
- Nuevo: `src/components/paciente/odontograma/ToothSVG.tsx`
- Nuevo: `src/components/paciente/odontograma/PiezaDentalDialog.tsx`
- Nuevo: `src/lib/odontograma.ts`
- Editado: `src/lib/constants.ts` (estados + labels + clases)
- Editado: `src/index.css` y `tailwind.config.ts` (tokens de color por estado)
- Editado: `src/components/paciente/Odontograma.tsx` (reemplazo de la sección grilla)
- Migración: ampliar enum `diente_estado`
