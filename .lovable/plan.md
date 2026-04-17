
## Etapa 2 de Gestión — sí, viable

El manual define 3 módulos nuevos que se integran limpiamente con lo ya construido (pacientes, profesionales, turnos, atenciones). Propongo implementarlos en este orden:

### 1. Prestaciones (tabla maestra) — base para todo lo demás
Pantalla de ABM en `/prestaciones` (admin/recepción).

Tabla `prestaciones`:
- `id`, `codigo` (único), `descripcion`, `categoria`, `precio_base` (numeric), `duracion_estimada_min` (int), `activo` (bool)

### 2. Presupuestos / Planes de tratamiento
Pantallas: listado `/presupuestos`, detalle/edición `/presupuestos/:id`.

- `presupuestos`: `id`, `fecha`, `paciente_id`, `profesional_id`, `estado` (enum: borrador/entregado/aceptado/rechazado/parcialmente_ejecutado/finalizado), `total` (calculado), `observaciones`
- `presupuesto_detalle`: `id`, `presupuesto_id`, `prestacion_id`, `pieza_dental` (text — número de pieza odontológica), `cantidad`, `precio_unitario` (snapshot del momento), `subtotal` (generated)

Total del presupuesto recalculado por trigger a partir de los detalles.

### 3. Cobros / Caja
Pantallas: listado `/cobros` con filtros por fecha/paciente, alta de cobro con imputación a presupuestos pendientes, vista "Cuenta corriente del paciente" desde la ficha.

- `cobros`: `id`, `fecha`, `paciente_id`, `importe`, `medio_pago` (enum: efectivo/transferencia/débito/crédito/mercadopago/otro), `referencia`, `observaciones`, `usuario_registro` (auth.uid)
- `cobro_aplicaciones`: `id`, `cobro_id`, `presupuesto_id` (nullable), `atencion_id` (nullable), `importe_aplicado`. Constraint: exactamente uno de los dos FKs.

### Seguridad
- RLS coherente con lo existente: lectura para autenticados, ABM para admin/recepción, profesional ve lo suyo.
- Triggers de auditoría sobre `prestaciones`, `presupuestos`, `presupuesto_detalle`, `cobros`, `cobro_aplicaciones` (reusando `audit_trigger_func`).

### Navegación
Nuevo grupo en sidebar **"Gestión"** (admin/recepción) con: Prestaciones · Presupuestos · Cobros.
Desde la ficha de paciente, accesos directos a sus presupuestos y a su cuenta corriente.

### Reportes (rápidos, sin pantalla nueva)
- Saldo pendiente por paciente = Σ presupuestos aceptados − Σ aplicado
- Caja del día (suma de cobros por medio de pago)

### Dudas para confirmar antes de arrancar

Te tiro 3 preguntas para no asumir.
