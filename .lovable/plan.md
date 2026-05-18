## Cambio

Cuando al guardar una atención se agenda el turno de próxima visita, actualmente se crea (o actualiza) con estado `reservado`. Debe quedar en estado `confirmado`, ya que la fecha se está pactando en el momento con el paciente.

## Detalles técnicos

Archivo: `src/pages/AtencionForm.tsx`

- Línea 546: en el `update` del turno existente, cambiar `estado: "reservado"` → `estado: "confirmado"`.
- Línea 564: en el `insert` del nuevo turno, cambiar `estado: "reservado"` → `estado: "confirmado"`.
- Ajustar el mensaje de éxito (línea 573) de "Próximo turno reservado..." a "Próximo turno confirmado..." para mantener consistencia.

No requiere cambios de base de datos ni de RLS.
