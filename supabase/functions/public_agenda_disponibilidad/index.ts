// Edge function pública: public_agenda_disponibilidad
// - GET /?listar=profesionales -> lista mínima de profesionales activos
// - GET /?profesional_id=...&fecha=YYYY-MM-DD -> slots disponibles del día

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Suma minutos a un "HH:mm[:ss]" y devuelve "HH:mm"
function addMinutes(hhmm: string, mins: number): string {
  const [h, m] = hhmm.slice(0, 5).split(":").map(Number);
  const total = h * 60 + m + mins;
  const hh = Math.floor(total / 60).toString().padStart(2, "0");
  const mm = (total % 60).toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + "T00:00:00").getTime());
}
function isValidUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return jsonResponse({ error: "Server misconfigured" }, 500);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const url = new URL(req.url);
    const listar = url.searchParams.get("listar");

    // ----- Listar profesionales activos -----
    if (listar === "profesionales") {
      const { data, error } = await supabase
        .from("profesionales")
        .select("id, nombre, apellido, especialidad")
        .eq("activo", true)
        .order("apellido", { ascending: true });

      if (error) {
        console.error("Error listando profesionales:", error);
        return jsonResponse({ error: "No se pudieron obtener los profesionales" }, 500);
      }
      return jsonResponse({ profesionales: data ?? [] });
    }

    // ----- Slots disponibles de un día -----
    const profesional_id = url.searchParams.get("profesional_id") ?? "";
    const fecha = url.searchParams.get("fecha") ?? "";

    if (!isValidUuid(profesional_id)) {
      return jsonResponse({ error: "profesional_id inválido" }, 400);
    }
    if (!isValidDate(fecha)) {
      return jsonResponse({ error: "fecha inválida (use YYYY-MM-DD)" }, 400);
    }

    // Día de semana (0=domingo)
    const diaSemana = new Date(fecha + "T00:00:00").getDay();

    // Horarios del profesional para ese día
    const { data: horarios, error: errHor } = await supabase
      .from("horarios_profesional")
      .select("hora_inicio, hora_fin, duracion_slot_min, activo")
      .eq("profesional_id", profesional_id)
      .eq("dia_semana", diaSemana)
      .eq("activo", true);

    if (errHor) {
      console.error("Error horarios:", errHor);
      return jsonResponse({ error: "Error obteniendo horarios" }, 500);
    }

    // Generar slots base
    const slotsBase: Array<{ hora_inicio: string; hora_fin: string }> = [];
    for (const h of horarios ?? []) {
      const dur = h.duracion_slot_min ?? 30;
      let cursor = h.hora_inicio.slice(0, 5);
      const fin = h.hora_fin.slice(0, 5);
      while (cursor < fin) {
        const next = addMinutes(cursor, dur);
        if (next > fin) break;
        slotsBase.push({ hora_inicio: cursor, hora_fin: next });
        cursor = next;
      }
    }

    // Turnos ocupantes (incluye 'solicitado' para evitar dobles solicitudes)
    const { data: turnos, error: errTur } = await supabase
      .from("turnos")
      .select("hora_inicio, hora_fin, estado, es_sobreturno")
      .eq("profesional_id", profesional_id)
      .eq("fecha", fecha)
      .in("estado", [
        "reservado",
        "confirmado",
        "en_atencion",
        "atendido",
        "pendiente_cierre",
        "solicitado",
      ]);

    if (errTur) {
      console.error("Error turnos:", errTur);
      return jsonResponse({ error: "Error obteniendo turnos" }, 500);
    }

    // Bloqueos activos del día
    const { data: bloqueos, error: errBlo } = await supabase
      .from("bloqueos_agenda")
      .select("fecha_desde, fecha_hasta, todo_el_dia, hora_desde, hora_hasta")
      .eq("profesional_id", profesional_id)
      .eq("estado", "activo")
      .lte("fecha_desde", fecha)
      .gte("fecha_hasta", fecha);

    if (errBlo) {
      console.error("Error bloqueos:", errBlo);
      return jsonResponse({ error: "Error obteniendo bloqueos" }, 500);
    }

    // Hora actual (server) para descartar slots ya pasados del día de hoy
    const hoy = new Date().toISOString().slice(0, 10);
    const ahoraHHMM = new Date().toTimeString().slice(0, 5);

    const slots = slotsBase.map((s) => {
      // Pasado en el día de hoy
      const enPasado = fecha === hoy && s.hora_inicio <= ahoraHHMM;

      // Choque con turno (no sobreturno)
      const ocupadoTurno = (turnos ?? []).some(
        (t) =>
          !t.es_sobreturno &&
          t.hora_inicio.slice(0, 5) < s.hora_fin &&
          t.hora_fin.slice(0, 5) > s.hora_inicio,
      );

      // Choque con bloqueo
      const enBloqueo = (bloqueos ?? []).some((b) => {
        if (b.todo_el_dia) return true;
        if (!b.hora_desde || !b.hora_hasta) return false;
        return s.hora_inicio < b.hora_hasta.slice(0, 5) && s.hora_fin > b.hora_desde.slice(0, 5);
      });

      const ocupado = enPasado || ocupadoTurno || enBloqueo;
      return { ...s, ocupado };
    });

    return jsonResponse({ slots });
  } catch (err) {
    console.error("public_agenda_disponibilidad error:", err);
    return jsonResponse({ error: "Error inesperado" }, 500);
  }
});
