## 🎯 Objetivo
Permitir que un paciente reserve un turno desde un link público (`/reservar-turno`), sin login, y que recepción gestione esas solicitudes desde una bandeja interna **"Turnos solicitados"**, con notificaciones automáticas por WhatsApp en cada paso.

---

## 1) 🗄️ Cambios en base de datos (migración)

### a) Enum `turno_estado`
- Agregar nuevos valores:
  - `solicitado` (turno pendiente de revisión)
  - `rechazado` (recepción no aprobó la solicitud)

### b) Tabla `pacientes`
- Agregar columna `pendiente_validacion BOOLEAN NOT NULL DEFAULT false`. Sirve para marcar pacientes creados desde el formulario público que recepción debe completar/validar.

### c) Tabla `turnos`
- Agregar columna `origen TEXT NOT NULL DEFAULT 'interno'` con valores esperados `'interno' | 'publico'`. Permite distinguir y filtrar la bandeja.

### d) RLS
- Las tablas siguen con RLS estricta. La inserción pública NO se hace por anon; se hace desde una **edge function** con service role (ver punto 3). Así no debilitamos las policies existentes.
- Agregar policy en `whatsapp_respuestas` permitiendo que recepción/admin vean los logs de envío saliente (hoy solo admin).

### e) Trigger `validar_solapamiento_turno`
- Ya ignora `cancelado/reprogramado/ausente`. Lo extendemos para que también ignore `solicitado` y `rechazado` al validar choques (un solicitado **no debe bloquear** la agenda hasta ser confirmado, pero veremos en agenda como "pendiente").

> **Aclaración:** un turno `solicitado` aparecerá en la agenda con estilo distinto (gris/rayado) pero NO ocupa el slot hasta que recepción lo confirme. Esto evita que una solicitud bloquee a otra reserva interna que llegue antes.

---

## 2) 🌐 Página pública `/reservar-turno`

Ruta nueva en `App.tsx` **fuera** de `<Private>` (sin `ProtectedRoute`, sin `AppLayout`). Layout simple, mismo estilo de la app (cards, colores, fuentes ya definidos).

**Pasos del formulario (single page con validación):**
1. **Profesional** → select con profesionales activos.
2. **Fecha** → calendario; deshabilita días sin horarios.
3. **Horario disponible** → grilla de slots calculados a partir de:
   - `horarios_profesional` (día semana, duración slot)
   - menos turnos en estados que ocupan agenda (`reservado, confirmado, en_atencion, atendido, pendiente_cierre`)
   - menos `bloqueos_agenda` activos
   - **incluye también los `solicitado` para no permitir doble solicitud sobre el mismo slot** (regla de UX, no de DB)
4. **Datos del paciente:** nombre, apellido, DNI, teléfono WhatsApp (validación E.164), email (opcional).
5. **Motivo** (textarea obligatorio) y **Observaciones** (opcional).
6. Botón **"Solicitar turno"**.

**Datos cargados públicamente** (sin login):
- Lista de profesionales y horarios → se obtienen llamando a una edge function pública nueva `public_agenda_disponibilidad` (ver punto 3) que devuelve solo lo necesario, sin exponer datos sensibles.

**Validaciones cliente:**
- Zod schema (nombre 2-80, apellido 2-80, DNI 7-10 dígitos, teléfono regex internacional, email opcional válido, motivo 5-500).
- Mensajes de error claros por campo.

**Confirmación:**
- Pantalla de éxito con resumen del turno solicitado + texto: *"Te enviamos un WhatsApp confirmando que recibimos tu solicitud."*

---

## 3) ⚙️ Edge functions

### a) `public_agenda_disponibilidad` (GET, pública)
- Sin JWT.
- Recibe: `profesional_id`, `fecha` (yyyy-MM-dd).
- Devuelve: `{ slots: [{hora_inicio, hora_fin, ocupado: boolean}] }`.
- Calcula slots a partir de `horarios_profesional`, descontando turnos activos + solicitados + bloqueos.
- También endpoint `?listar=profesionales` → lista pública mínima `[{id, nombre, apellido, especialidad}]`.

### b) `public_solicitar_turno` (POST, pública)
- Sin JWT.
- Recibe payload validado con Zod (mismos campos del form + slot elegido).
- Lógica:
  1. **Anti-spam ad-hoc:** rechaza si el mismo teléfono envió >3 solicitudes en los últimos 60 min (consulta `turnos` por `origen='publico'` + telefono del paciente vinculado, en ventana de 1h). ⚠️ El backend no tiene primitivas formales de rate limiting; esta es una mitigación simple pero no infalible.
  2. **Re-chequea disponibilidad** del slot (evita race conditions).
  3. **Busca paciente por DNI**:
     - Si existe → usa ese `paciente_id`.
     - Si no existe → crea uno nuevo con `pendiente_validacion = true`.
  4. **Inserta turno** con `estado='solicitado'`, `origen='publico'`, `motivo_consulta`, etc.
  5. **Llama a `send_whatsapp`** con el mensaje:
     > *Hola {nombre}, recibimos tu solicitud de turno con {profesional} para el día {fecha} a las {hora}. Te avisaremos cuando sea confirmada.*
  6. Devuelve `{ success: true, turno_id }`.
- Cualquier error de envío de WhatsApp se loguea pero **no rompe** la creación del turno.

### c) `whatsapp_webhook` (existente, sin cambios)
- Sigue funcionando igual para `CONFIRMO`/`CANCELO` de los recordatorios. No interfiere con el nuevo flujo.

> ⚠️ Twilio: ya tenés `TWILIO_ACCOUNT_SID` y `TWILIO_AUTH_TOKEN` configurados. No se exponen al frontend (toda llamada va por edge functions con service role).

---

## 4) 📋 Bandeja interna "Turnos solicitados"

### Nueva ruta `/turnos/solicitudes`
- Protegida con `RoleProtected roles={["admin", "recepcion"]}`.
- Item nuevo en `AppSidebar` bajo el grupo de Agenda, con badge contador de solicitudes pendientes.

### UI (similar a Cobros / Pacientes)
Tabla con columnas:
| Fecha | Hora | Paciente | Teléfono | Profesional | Motivo | Origen | Estado | Acciones |

Filtros:
- Por estado (`solicitado`, `confirmado`, `rechazado`, `reprogramado`, todos).
- Por profesional.
- Por rango de fechas.

### Acciones por fila

**🟢 Confirmar:**
- Re-valida que el slot siga libre (puede haber sido tomado).
- `UPDATE turnos SET estado='confirmado'`.
- Llama a `send_whatsapp` con:
  > *Hola {nombre}, tu turno fue confirmado con {profesional} el día {fecha} a las {hora}. Te esperamos.*

**🔴 Rechazar:**
- AlertDialog para confirmar.
- `UPDATE turnos SET estado='rechazado'`.
- Llama a `send_whatsapp` con:
  > *Hola {nombre}, no pudimos confirmar tu solicitud de turno para el día {fecha} a las {hora}. Por favor contactanos para coordinar otro horario.*

**🔄 Reprogramar:**
- Abre diálogo con: profesional (preseleccionado, editable), fecha, slots disponibles del nuevo día.
- `UPDATE turnos SET fecha, hora_inicio, hora_fin, profesional_id, estado='confirmado'`.
- Llama a `send_whatsapp` con el mensaje de confirmación, usando la nueva fecha/hora.

Cada acción muestra toast de éxito/error y refresca la lista.

---

## 5) 🗓️ Integración con la agenda existente (`/turnos`)

- Los turnos `solicitado` aparecen en la grilla con:
  - Color/estilo distintivo (rayado o badge "Pendiente").
  - Tooltip indicando que es una solicitud online sin confirmar.
  - **No bloquean** otros agendamientos (no cuentan como ocupado en validación de solapamiento del backend, pero la UI los muestra para que recepción los vea).
- Click en uno te lleva o abre la misma vista de bandeja (link rápido).

Agregamos:
- Constante `solicitado` y `rechazado` en `src/lib/constants.ts` (`TURNO_ESTADOS`, `TURNO_ESTADO_LABELS`, `TURNO_ESTADO_CLASSES`).
- Nuevas variables CSS en `src/index.css` para los colores de esos estados (siguiendo el patrón actual de `--estado-*`).

---

## 6) 📝 Logs de WhatsApp

- Cada envío saliente (solicitud recibida, confirmación, rechazo) se registra en `whatsapp_respuestas` con un nuevo valor de `resultado`:
  - `enviado_solicitud_recibida`
  - `enviado_confirmacion`
  - `enviado_rechazo`
  - `enviado_reprogramacion`
- Esto te permite auditar qué mensajes se enviaron desde la pantalla "Auditoría" si más adelante querés exponerlo.

---

## 7) 📂 Resumen de archivos

**Migración nueva:** 1 archivo SQL (enum + columnas + ajuste trigger + policy).

**Edge functions nuevas:**
- `supabase/functions/public_agenda_disponibilidad/index.ts`
- `supabase/functions/public_solicitar_turno/index.ts`

**Frontend nuevo:**
- `src/pages/public/ReservarTurno.tsx` (página pública)
- `src/pages/TurnosSolicitados.tsx` (bandeja interna)
- `src/components/turnos/ReprogramarDialog.tsx`

**Modificados:**
- `src/App.tsx` (rutas nuevas, `/reservar-turno` pública + `/turnos/solicitudes` protegida)
- `src/lib/constants.ts` (nuevos estados)
- `src/index.css` (variables de color)
- `src/components/layout/AppSidebar.tsx` (item bandeja con contador)
- `src/pages/Turnos.tsx` (mostrar `solicitado` con estilo distintivo)
- (opcional) `src/lib/permissions.ts` si querés un módulo nuevo `turnos_solicitados`; por ahora reusamos el módulo `agenda`.

---

## ⚠️ Notas / advertencias

1. **Rate limiting:** será una mitigación ad-hoc en BD (no hay primitivas formales en el backend). Si el endpoint público se abusa, habría que sumar Cloudflare/captcha más adelante.
2. **Captcha:** no incluido. Si después querés sumar hCaptcha/Turnstile, es una integración aparte.
3. **Pacientes provisorios** quedarán marcados con `pendiente_validacion=true` para que recepción complete obra social, etc., al confirmar.
4. **Difusión del link:** `/reservar-turno` queda accesible para cualquiera con la URL. Conviene compartirlo desde el sitio/redes oficiales.

¿Avanzo con la implementación?