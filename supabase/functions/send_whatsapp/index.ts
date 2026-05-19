const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const META_ACCESS_TOKEN = Deno.env.get("META_ACCESS_TOKEN");
    const META_PHONE_NUMBER_ID = Deno.env.get("META_PHONE_NUMBER_ID");
    if (!META_ACCESS_TOKEN || !META_PHONE_NUMBER_ID) {
      return new Response(JSON.stringify({ success: false, error: "Faltan credenciales Meta" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const body = await req.json().catch(() => ({}));
    const telefono = String(body.telefono || "").trim();
    const mensaje = String(body.mensaje || "");
    if (!telefono || !mensaje) {
      return new Response(JSON.stringify({ success: false, error: "Se requieren telefono y mensaje" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const telefonoLimpio = telefono.replace(/^\+/, "").replace(/[^\d]/g, "");
    const metaRes = await fetch(
      `https://graph.facebook.com/v19.0/${META_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${META_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: telefonoLimpio,
          type: "text",
          text: { body: mensaje },
        }),
      }
    );
    const data = await metaRes.json();
    if (!metaRes.ok) {
      return new Response(
        JSON.stringify({ success: false, error: data.error ? data.error.message : "Error Meta API" }),
        { status: metaRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({
        success: true,
        message_id: data.messages && data.messages[0] ? data.messages[0].id : null,
        to: telefonoLimpio,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});