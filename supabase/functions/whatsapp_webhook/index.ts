// Edge function: whatsapp_webhook
// Recibe respuestas entrantes de Twilio WhatsApp (formato application/x-www-form-urlencoded)
// y actualiza el estado del próximo turno reservado del paciente según el contenido.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Devuelve TwiML vacío (Twilio acepta 200 con TwiML o texto plano).
function twimlResponse() {
  const body = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
  return new Response(body, {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "text/xml" },
  });
}

function normalizarTelefono(from: string): string {
  // Twilio envía algo como "whatsapp:+5491122334455"
  return from.replace(/^whatsapp:/i, "").replace(/[^\d+]/g, "");
}

function detectarAccion(texto: string): "confirmar" | "cancelar" | null {
  const t = texto
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // quita tildes -> "SI"
  // chequeamos palabras completas con bordes para evitar falsos positivos
  const tieneAlguna = (palabras: string[]) =>
    palabras.some((p) => new RegExp(`\\b${p}\\b`).test(t));

  if (tieneAlguna(["CONFIRMO", "CONFIRMAR", "SI"])) return "confirmar";
  if (tieneAlguna(["CANCELAR", "CANCELO", "NO"])) return "cancelar";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("Faltan variables de entorno SUPABASE_URL/SERVICE_ROLE_KEY");
    return twimlResponse();
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    // Twilio envía form-urlencoded
    let from = "";
    let body = "";
    let messageSid = "";

    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const json = await req.json().catch(() => ({}));
      from = (json.From ?? json.from ?? "").toString();
      body = (json.Body ?? json.body ?? "").toString();
      messageSid = (json.MessageSid ?? json.messageSid ?? "").toString();
    } else {
      const form = await req.formData();
      from = (form.get("From") ?? "").toString();
      body = (form.get("Body") ?? "").toString();
      messageSid = (form.get("MessageSid") ?? "").toString();
    }

    const telefono = normalizarTelefono(from);
    const mensaje = body.trim();
    const accion = detectarAccion(mensaje);

    console.log("WhatsApp entrante:", { telefono, mensaje, messageSid, accion });

    let turnoId: string | null = null;
    let resultado = "sin_accion";

    if (!telefono) {
      resultado = "telefono_invalido";
    } else if (!accion) {
      resultado = "sin_palabra_clave";
    } else {
      // Buscar paciente por teléfono (match flexible: con o sin '+')
      const telefonoSinMas = telefono.replace(/^\+/, "");
      const { data: pacientes, error: errPac } = await supabase
        .from("pacientes")
        .select("id, telefono")
        .or(`telefono.eq.${telefono},telefono.eq.${telefonoSinMas},telefono.eq.+${telefonoSinMas}`)
        .limit(5);

      if (errPac) {
        console.error("Error buscando paciente:", errPac);
        resultado = "error_busqueda_paciente";
      } else if (!pacientes || pacientes.length === 0) {
        resultado = "paciente_no_encontrado";
      } else {
        const pacienteIds = pacientes.map((p) => p.id);
        const hoy = new Date().toISOString().slice(0, 10);

        // Próximo turno activo del paciente (reservado o confirmado, a partir de hoy)
        const { data: turnos, error: errTurnos } = await supabase
          .from("turnos")
          .select("id, fecha, hora_inicio, estado")
          .in("paciente_id", pacienteIds)
          .in("estado", ["reservado", "confirmado"])
          .gte("fecha", hoy)
          .order("fecha", { ascending: true })
          .order("hora_inicio", { ascending: true })
          .limit(1);

        if (errTurnos) {
          console.error("Error buscando turno:", errTurnos);
          resultado = "error_busqueda_turno";
        } else if (!turnos || turnos.length === 0) {
          resultado = "sin_turno_activo";
        } else {
          const turno = turnos[0];
          turnoId = turno.id;
          const nuevoEstado = accion === "confirmar" ? "confirmado" : "cancelado";

          const { error: errUpd } = await supabase
            .from("turnos")
            .update({ estado: nuevoEstado })
            .eq("id", turno.id);

          if (errUpd) {
            console.error("Error actualizando turno:", errUpd);
            resultado = "error_actualizando_turno";
          } else {
            resultado =
              accion === "confirmar" ? "turno_confirmado" : "turno_cancelado";
          }
        }
      }
    }

    // Registrar siempre la respuesta
    const { error: errLog } = await supabase
      .from("whatsapp_respuestas")
      .insert({
        telefono,
        mensaje,
        message_sid: messageSid || null,
        accion_detectada: accion,
        turno_id: turnoId,
        resultado,
      });

    if (errLog) {
      console.error("Error registrando respuesta:", errLog);
    }

    return twimlResponse();
  } catch (err) {
    console.error("whatsapp_webhook error:", err);
    // Devolvemos 200 igualmente para que Twilio no reintente en loop
    return twimlResponse();
  }
});
