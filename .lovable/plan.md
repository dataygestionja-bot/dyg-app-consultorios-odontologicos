## Objetivo

Reemplazar el ícono de tres puntos (`MoreVertical`) del menú de acciones de cada turno por un ícono de lápiz (`Pencil`), más intuitivo para indicar "editar".

## Cambio

**Archivo único: `src/components/turnos/AgendaSemanalMatriz.tsx`**

1. Línea 26: en el import de `lucide-react`, cambiar `MoreVertical` por `Pencil`.
2. Línea 479: reemplazar `<MoreVertical className="h-4 w-4" />` por `<Pencil className="h-3.5 w-3.5" />` (ligeramente más chico para mantener la proporción visual junto al ícono de WhatsApp y el badge).

No se modifica el comportamiento del `DropdownMenu` ni sus opciones (Reprogramar / Cancelar). No hay cambios de lógica ni de backend.