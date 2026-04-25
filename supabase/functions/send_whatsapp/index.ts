// Edge function: send_whatsapp
// Envía mensajes de WhatsApp vía Twilio API usando TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FROM_WHATSAPP = "whatsapp:+14155238886";

interface SendBody {
  telefono?: string;
  mensaje?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Faltan TWILIO_ACCOUNT_SID o TWILIO_AUTH_TOKEN",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let body: SendBody = {};
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Body JSON inválido" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const telefono = (body.telefono ?? "").toString().trim();
    const mensaje = (body.mensaje ?? "").toString();

    if (!telefono || !mensaje) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Se requieren los campos 'telefono' y 'mensaje'",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Normalizamos: quitamos un eventual '+' del inicio para construir whatsapp:+{telefono}
    const telefonoLimpio = telefono.replace(/^\+/, "").replace(/[^\d]/g, "");
    const to = `whatsapp:+${telefonoLimpio}`;

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;

    const params = new URLSearchParams({
      To: to,
      From: FROM_WHATSAPP,
      Body: mensaje,
    });

    const basicAuth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    const twilioRes = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await twilioRes.json();

    if (!twilioRes.ok) {
      console.error("Error Twilio:", twilioRes.status, data);
      return new Response(
        JSON.stringify({
          success: false,
          status: twilioRes.status,
          error: data?.message ?? "Error al enviar mensaje",
          twilio: data,
        }),
        {
          status: twilioRes.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        sid: data.sid,
        status: data.status,
        to: data.to,
        from: data.from,
        date_created: data.date_created,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("send_whatsapp error:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
