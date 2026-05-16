## Objetivo

Reorganizar el formulario de atención para que la zona de trabajo sea más simple y use solapas (tabs) para los contenidos secundarios del paciente.

## Cambios en `src/pages/AtencionForm.tsx`

### 1. Simplificar "Prácticas realizadas"

- Eliminar el botón **"Crear nueva práctica"** de la cabecera de la tarjeta (queda solo "Agregar fila").
- Eliminar las columnas **Pieza**, **Cara**, **Cantidad** y **Observación** de la tabla.
- La tabla queda con: `Prestación` + acción de eliminar fila. Se mantiene el botón "+" al lado del select para crear prestación rápida.
- En el estado `PracticaRow` y en el guardado, fijar internamente `pieza_dental=null`, `cara_dental=null`, `cantidad=1`, `observacion=null` para no romper el schema actual.
- Quitar el campo **Observaciones** del bloque "Notas clínicas" (el usuario pidió eliminarlo). Quedan: Diagnóstico, Indicaciones y Próxima visita sugerida.

### 2. Vista principal centrada en Odontograma + Prácticas

El cuerpo del formulario, después de la cabecera, mostrará en este orden:

1. **Odontograma** (modo inline, como ya está).
2. **Prácticas realizadas** simplificada (solo Prestación), con los campos **Diagnóstico** e **Indicaciones** dentro de la misma tarjeta (debajo de la tabla).
3. **Próxima visita sugerida** se mantiene en una tarjeta aparte chica o dentro de la misma tarjeta de prácticas (lo dejamos dentro, compacto).

### 3. Solapas para info del paciente

Reemplazar las tarjetas sueltas de "Ficha clínica", historial del odontograma y "Historial de atenciones" por un único bloque con `Tabs` (shadcn) y 3 solapas:

- **Ficha clínica** — alergias, medicación actual, antecedentes médicos (igual que hoy).
- **Historial odontograma** — nuevo componente liviano que muestra los registros de `odontograma_registros` del paciente (fecha, pieza, estado, profesional, observación). Se reutiliza la consulta que ya hace `Odontograma.tsx`; si conviene, se extrae a un componente nuevo `src/components/paciente/HistorialOdontograma.tsx` que solo lista los registros (sin el grid de dientes).
- **Historial de atenciones** — el componente `HistorialAtenciones` existente.

Este bloque de tabs se ubica **debajo** del odontograma y prácticas, para que la atención (lo que el profesional hace ahora) quede arriba y la consulta de historia clínica quede abajo en solapas.

### 4. No tocar

- Lógica de carga, validación y guardado de la atención.
- Schema de base de datos ni RLS.
- Componente `Odontograma` (mantiene su propio historial interno; en el tab de "Historial odontograma" usaremos una vista listado).

## Layout resultante

```text
[ Cabecera: fecha · paciente · profesional (editable) · tipo ]

[ Odontograma (inline) ]

[ Prácticas realizadas
   - tabla: Prestación | eliminar
   - + Agregar fila
   - Diagnóstico
   - Indicaciones
   - Próxima visita sugerida ]

[ Tabs:  Ficha clínica | Historial odontograma | Historial de atenciones ]

[ Cancelar  ·  Guardar ]
```
