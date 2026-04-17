import { supabase } from "@/integrations/supabase/client";

/**
 * Registra un intento de login (exitoso o fallido).
 * Se invoca desde la pantalla de Auth — no falla nunca al usuario.
 */
export async function registrarIntentoLogin(params: {
  email: string;
  exitoso: boolean;
  motivo?: string;
  userId?: string | null;
}) {
  try {
    await supabase.from("login_attempts").insert({
      email: params.email,
      exitoso: params.exitoso,
      motivo: params.motivo ?? null,
      user_id: params.userId ?? null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
  } catch (e) {
    console.warn("No se pudo registrar el intento de login", e);
  }
}

/**
 * Registra un evento de auditoría manual (logout, password change, etc.).
 */
export async function registrarEvento(params: {
  accion: string;
  entidad: string;
  entidadId?: string | null;
  descripcion?: string | null;
}) {
  try {
    await supabase.rpc("log_audit_event", {
      _accion: params.accion,
      _entidad: params.entidad,
      _entidad_id: params.entidadId ?? undefined,
      _descripcion: params.descripcion ?? undefined,
    });
  } catch (e) {
    console.warn("No se pudo registrar el evento de auditoría", e);
  }
}
