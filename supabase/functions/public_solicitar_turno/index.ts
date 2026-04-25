// Edge function pública: public_solicitar_turno
// Recibe los datos del formulario público, busca/crea paciente, crea turno
// con estado 'solicitado' y dispara WhatsApp al paciente.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface SolicitudPayload {
  profesional_id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string;
  email?: string;
  motivo: string;
  observaciones?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;
// Teléfono internacional: dígitos + opcional '+' al inicio, 8 a 15 dígitos
const PHONE_RE = /^\+?\d{8,15}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(b: Partial<SolicitudPayload>): string | null {
  if (!b || typeof b !== "object") return "Payload inválido";
  if (!b.profesional_id || !UUID_RE.test(b.profesional_id)) return "Profesional inválido";
  if (!b.fecha || !DATE_RE.test(b.fecha)) return "Fecha inválida";
  if (!b.hora_inicio || !TIME_RE.test(b.hora_inicio)) return "Hora de inicio inválida";
  if (!b.hora_fin || !TIME_RE.test(b.hora_fin)) return "Hora de fin inválida";
  if (!b.nombre || b.nombre.trim().length < 2 || b.nombre.length > 80) return "Nombre inválido";
  if (!b.apellido || b.apellido.trim().length < 2 || b.apellido.length > 80) return "Apellido inválido";
  if (!b.dni || !/^\d{6,12}$/.test(b.dni.replace(/\D/g, ""))) return "DNI inválido";
  const tel = (b.telefono ?? "").replace(/[\s-]/g, "");
  if (!PHONE_RE.test(tel)) return "Teléfono inválido (incluya código de país)";
  if (b.email && !EMAIL_RE.test(b.email)) return "Email inválido";
  if (!b.motivo || b.motivo.trim().length < 5 || b.motivo.length > 500) return "Motivo inválido";
  if (b.observaciones && b.observaciones.length > 1000) return "Observaciones demasiado largas";

  // No permitir fechas pasadas
  if (b.fecha < new Date().toISOString().slice(0, 10)) return "No se puede reservar en una fecha pasada";
  return null;
}

function normalizarTelefono(t: string): string {
  return t.replace(/[\s-]/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Método no permitido" }, 405);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return jsonResponse({ error: "Server misconfigured" }, 500);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  let body: Partial<SolicitudPayload>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "JSON inválido" }, 400);
  }

  const errMsg = validate(body);
  if (errMsg) return jsonResponse({ error: errMsg }, 400);

  const payload = body as SolicitudPayload;
  const telefono = normalizarTelefono(payload.telefono);
  const dni = payload.dni.replace(/\D/g, "");

  try {
    // ----- Anti-spam ad-hoc: máx 3 solicitudes por teléfono en última hora -----
    const haceUnaHora = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: spamCount } = await supabase
      .from("turnos")
      .select("id, paciente:pacientes!inner(telefono)", { count: "exact", head: true })
      .eq("origen", "publico")
      .gte("created_at", haceUnaHora)
      .or(`telefono.eq.${telefono},telefono.eq.+${telefono.replace(/^\+/, "")}`, {
        foreignTable: "pacientes",
      });
    if ((spamCount ?? 0) >= 3) {
      return jsonResponse(
        { error: "Demasiadas solicitudes recientes. Por favor intentá más tarde." },
        429,
      );
    }

    // ----- Re-chequeo de disponibilidad del slot -----
    const { data: choques, error: errChoque } = await supabase
      .from("turnos")
      .select("id")
      .eq("profesional_id", payload.profesional_id)
      .eq("fecha", payload.fecha)
      .in("estado", [
        "reservado",
        "confirmado",
        "en_atencion",
        "atendido",
        "pendiente_cierre",
        "solicitado",
      ])
      .lt("hora_inicio", payload.hora_fin)
      .gt("hora_fin", payload.hora_inicio)
      .eq("es_sobreturno", false);

    if (errChoque) {
      console.error("Error chequeando choques:", errChoque);
      return jsonResponse({ error: "No se pudo validar la disponibilidad" }, 500);
    }
    if ((choques ?? []).length > 0) {
      return jsonResponse(
        { error: "Ese horario ya no está disponible. Por favor elegí otro." },
        409,
      );
    }

    // ----- Buscar / crear paciente -----
    let pacienteId: string | null = null;
    const { data: existing } = await supabase
      .from("pacientes")
      .select("id")
      .eq("dni", dni)
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      pacienteId = existing.id;
      // Si no tiene teléfono cargado, lo actualizamos (no pisamos uno existente)
      await supabase
        .from("pacientes")
        .update({ telefono })
        .eq("id", pacienteId)
        .is("telefono", null);
    } else {
      const { data: nuevo, error: errPac } = await supabase
        .from("pacientes")
        .insert({
          nombre: payload.nombre.trim(),
          apellido: payload.apellido.trim(),
          dni,
          telefono,
          email: payload.email?.trim() || null,
          pendiente_validacion: true,
        })
        .select("id")
        .single();

      if (errPac || !nuevo) {
        console.error("Error creando paciente:", errPac);
        return jsonResponse({ error: "No se pudo registrar al paciente" }, 500);
      }
      pacienteId = nuevo.id;
    }

    // ----- Crear el turno solicitado -----
    const motivoCompleto = payload.observaciones?.trim()
      ? `${payload.motivo.trim()}\n\nObservaciones: ${payload.observaciones.trim()}`
      : payload.motivo.trim();

    const { data: turno, error: errTur } = await supabase
      .from("turnos")
      .insert({
        paciente_id: pacienteId,
        profesional_id: payload.profesional_id,
        fecha: payload.fecha,
        hora_inicio: payload.hora_inicio,
        hora_fin: payload.hora_fin,
        motivo_consulta: motivoCompleto,
        estado: "solicitado",
        origen: "publico",
        es_sobreturno: false,
      })
      .select("id")
      .single();

    if (errTur || !turno) {
      console.error("Error creando turno:", errTur);
      return jsonResponse({ error: "No se pudo crear la solicitud de turno" }, 500);
    }

    // ----- Datos del profesional para el mensaje -----
    const { data: prof } = await supabase
      .from("profesionales")
      .select("nombre, apellido")
      .eq("id", payload.profesional_id)
      .single();

    const profesionalLabel = prof
      ? `${prof.nombre ?? ""} ${prof.apellido ?? ""}`.trim()
      : "el profesional";

    const fechaLeg = new Date(payload.fecha + "T00:00:00").toLocaleDateString("es-AR");
    const horaLeg = payload.hora_inicio.slice(0, 5);
    const mensaje =
      `Hola ${payload.nombre}, recibimos tu solicitud de turno con ${profesionalLabel} ` +
      `para el día ${fechaLeg} a las ${horaLeg}. Te avisaremos cuando sea confirmada.`;

    // ----- Disparar WhatsApp (no rompe el flujo si falla) -----
    let wpResultado = "enviado_solicitud_recibida";
    try {
      const { data: wpData, error: wpError } = await supabase.functions.invoke(
        "send_whatsapp",
        { body: { telefono, mensaje } },
      );
      if (wpError || (wpData && wpData.success === false)) {
        console.error("WhatsApp falló:", wpError, wpData);
        wpResultado = "error_envio_solicitud_recibida";
      }
    } catch (e) {
      console.error("WhatsApp excepción:", e);
      wpResultado = "error_envio_solicitud_recibida";
    }

    // Log del envío saliente
    await supabase.from("whatsapp_respuestas").insert({
      telefono,
      mensaje,
      accion_detectada: null,
      turno_id: turno.id,
      resultado: wpResultado,
    });

    return jsonResponse({ success: true, turno_id: turno.id });
  } catch (err) {
    console.error("public_solicitar_turno error:", err);
    return jsonResponse({ error: "Error inesperado" }, 500);
  }
});
