## Objetivo

Permitir subir y mostrar una foto de perfil para cada profesional, como base para la futura vista semanal de turnos.

## Cambios

### 1. Base de datos (migración)

- Agregar columna `foto_url text` (nullable) a `profesionales`.
- Crear bucket de Storage `profesionales-fotos` (público, para que la URL pueda mostrarse directamente).
- Políticas RLS sobre `storage.objects`:
  - SELECT público (cualquiera puede ver las fotos).
  - INSERT / UPDATE / DELETE solo para admin (`has_role(auth.uid(), 'admin')`), que es el rol que ya gestiona profesionales.

### 2. Formulario de profesional (`src/pages/ProfesionalForm.tsx`)

- Nuevo bloque "Foto de perfil":
  - Avatar (preview circular) con la foto actual o iniciales como fallback.
  - Botón "Subir foto" → input file (acepta `image/*`, máx. 2 MB).
  - Botón "Quitar foto" si ya hay una cargada.
- Al seleccionar archivo:
  - Subir a `profesionales-fotos/{profesional_id}/{timestamp}.{ext}` con `upsert: true`.
  - Obtener la public URL y guardarla en `foto_url`.
  - Mostrar toast de éxito/error.
- Si el profesional es nuevo (sin id), se sube recién después de guardar el alta.

### 3. Listado de profesionales (`src/pages/Profesionales.tsx`)

- Agregar columna con `Avatar` mostrando la foto (fallback a iniciales `Apellido[0]+Nombre[0]`), reemplazando o acompañando el círculo de color de agenda.
- Incluir `foto_url` en el `select`.

## Notas técnicas

- Bucket público = URLs estables tipo `https://<proj>.supabase.co/storage/v1/object/public/profesionales-fotos/...`.
- Validación de tamaño/tipo en el cliente (no se agrega edge function).
- `foto_url` queda libre para que más adelante la vista semanal y otros lugares (header, agenda) la consuman sin migrar de nuevo.

## Próximo paso (fuera de este plan)

Una vez aprobado y subidas las fotos, armamos la vista semanal tipo grilla (filas = profesionales con avatar, columnas = días de la semana).
