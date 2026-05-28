import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Bot, CalendarCheck, CalendarX, RefreshCw, UserPlus, Bell, XCircle, Clock } from "lucide-react";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface BotLog {
  id: string;
  timestamp: string;
  tipo: string;
  telefono: string | null;
  paciente_id: string | null;
  turno_id: string | null;
  detalle: string | null;
  nivel: string | null;
  paciente?: { nombre: string; apellido: string } | null;
}

interface TurnoSinConfirmar {
  id: string;
  fecha: string;
  hora_inicio: string;
  paciente: { nombre: string; apellido: string } | null;
  profesional: { nombre: string; apellido: string } | null;
  created_at: string;
}

const NIVEL_CLASS: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  warning: "bg-yellow-100 text-yellow-800 border-yellow-200",
  info: "bg-blue-100 text-blue-800 border-blue-200",
};

const TIPO_LABEL: Record<string, string> = {
  turno_creado: "Turno creado",
  turno_fallido: "Turno fallido",
  cancelacion: "Cancelación",
  paciente_nuevo: "Paciente nuevo",
  recordatorio_enviado: "Recordatorio",
  consulta: "Consulta",
  error: "Error",
};

export default function SaludBot() {
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Métricas
  const [turnosWhatsapp, setTurnosWhatsapp] = useState(0);
  const [turnosReservados, setTurnosReservados] = useState(0);
  const [cancelaciones, setCancelaciones] = useState(0);
  const [pacientesNuevos, setPacientesNuevos] = useState(0);
  const [recordatorios, setRecordatorios] = useState(0);

  // Alertas
  const [turnosFallidos, setTurnosFallidos] = useState<BotLog[]>([]);
  const [turnosSinConfirmar48h, setTurnosSinConfirmar48h] = useState<TurnoSinConfirmar[]>([]);
  const [confirmacionesSinRegistro, setConfirmacionesSinRegistro] = useState<BotLog[]>([]);
  const [erroresInsert, setErroresInsert] = useState<BotLog[]>([]);
  const [turnosSinPaciente, setTurnosSinPaciente] = useState<{ id: string; fecha: string; hora_inicio: string; created_at: string }[]>([]);

  // Log
  const [logs, setLogs] = useState<BotLog[]>([]);

  const cargar = useCallback(async () => {
    setLoading(true);
    const hoy = format(new Date(), "yyyy-MM-dd");
    const hace48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const [
      { count: twCount },
      { count: trCount },
      { count: canCount },
      { count: pnCount },
      { count: recCount },
      { data: fallidos },
      { data: sin48 },
      { data: logsData },
      { data: confirmSinReg },
      { data: errInsert },
      { data: sinPaciente },
    ] = await Promise.all([
      // Turnos WhatsApp agendados hoy (creados hoy, sin importar para qué fecha son)
      supabase.from("turnos").select("*", { count: "exact", head: true })
        .eq("origen", "whatsapp")
        .gte("created_at", hoy + "T00:00:00")
        .lt("created_at", hoy + "T23:59:59"),
      // Turnos reservados pendientes
      supabase.from("turnos").select("*", { count: "exact", head: true })
        .eq("estado", "reservado").eq("origen", "whatsapp"),
      // Cancelaciones hoy (bot_logs)
      supabase.from("bot_logs").select("*", { count: "exact", head: true })
        .eq("tipo", "cancelacion")
        .gte("timestamp", hoy + "T00:00:00"),
      // Pacientes nuevos hoy (directo de tabla pacientes, más confiable que bot_logs)
      supabase.from("pacientes").select("*", { count: "exact", head: true })
        .gte("created_at", hoy + "T00:00:00")
        .lt("created_at", hoy + "T23:59:59"),
      // Recordatorios hoy
      supabase.from("bot_logs").select("*", { count: "exact", head: true })
        .eq("tipo", "recordatorio_enviado")
        .gte("timestamp", hoy + "T00:00:00"),
      // Turnos fallidos (todos)
      supabase.from("bot_logs").select("id, timestamp, tipo, telefono, detalle, nivel, paciente_id, turno_id")
        .eq("tipo", "turno_fallido")
        .order("timestamp", { ascending: false })
        .limit(10),
      // Turnos reservados sin confirmar hace más de 48h
      supabase.from("turnos").select("id, fecha, hora_inicio, created_at, paciente:pacientes(nombre, apellido), profesional:profesionales(nombre, apellido)")
        .eq("estado", "reservado")
        .eq("origen", "whatsapp")
        .lte("created_at", hace48h)
        .order("created_at", { ascending: true })
        .limit(20),
      // Últimos 50 logs
      supabase.from("bot_logs").select("id, timestamp, tipo, telefono, detalle, nivel, paciente_id, turno_id, paciente:pacientes(nombre, apellido)")
        .order("timestamp", { ascending: false })
        .limit(50),
      // ALERTA 1: Claude confirmó turno pero no se registró en la DB (nivel=critical)
      supabase.from("bot_logs")
        .select("id, timestamp, tipo, telefono, detalle, nivel, paciente_id, turno_id")
        .eq("nivel", "critical")
        .order("timestamp", { ascending: false })
        .limit(20),
      // ALERTA 2: Fallo de INSERT en Supabase (nivel=error, excluyendo turno_fallido que ya tiene su panel)
      supabase.from("bot_logs")
        .select("id, timestamp, tipo, telefono, detalle, nivel, paciente_id, turno_id")
        .eq("nivel", "error")
        .neq("tipo", "turno_fallido")
        .order("timestamp", { ascending: false })
        .limit(20),
      // ALERTA 3: Turnos WhatsApp creados sin paciente_id vinculado
      supabase.from("turnos")
        .select("id, fecha, hora_inicio, created_at")
        .eq("origen", "whatsapp")
        .is("paciente_id", null)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    setTurnosWhatsapp(twCount ?? 0);
    setTurnosReservados(trCount ?? 0);
    setCancelaciones(canCount ?? 0);
    setPacientesNuevos(pnCount ?? 0);
    setRecordatorios(recCount ?? 0);
    setTurnosFallidos((fallidos ?? []) as BotLog[]);
    setTurnosSinConfirmar48h((sin48 ?? []) as unknown as TurnoSinConfirmar[]);
    setLogs((logsData ?? []) as unknown as BotLog[]);
    setConfirmacionesSinRegistro((confirmSinReg ?? []) as BotLog[]);
    setErroresInsert((errInsert ?? []) as BotLog[]);
    setTurnosSinPaciente((sinPaciente ?? []) as { id: string; fecha: string; hora_inicio: string; created_at: string }[]);
    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    document.title = "Salud del Bot | Consultorio";
    cargar();
    const interval = setInterval(cargar, 60000);
    return () => clearInterval(interval);
  }, [cargar]);

  const hayAlertas =
    turnosFallidos.length > 0 ||
    turnosSinConfirmar48h.length > 0 ||
    confirmacionesSinRegistro.length > 0 ||
    erroresInsert.length > 0 ||
    turnosSinPaciente.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bot className="h-6 w-6" /> Salud del Bot
          </h1>
          <p className="text-sm text-muted-foreground">
            Monitoreo operativo de SonrIA · Actualizado {formatDistanceToNow(lastRefresh, { locale: es, addSuffix: true })}
          </p>
        </div>
        <button
          onClick={cargar}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </button>
      </div>

      {/* Métricas del día */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-1">
              <CalendarCheck className="h-3.5 w-3.5" /> Turnos vía WhatsApp
            </div>
            <div className="text-3xl font-bold">{turnosWhatsapp}</div>
            <p className="text-xs text-muted-foreground mt-0.5">Hoy</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-1">
              <Clock className="h-3.5 w-3.5" /> Pendientes confirmar
            </div>
            <div className={`text-3xl font-bold ${turnosReservados > 0 ? "text-amber-600" : ""}`}>{turnosReservados}</div>
            <p className="text-xs text-muted-foreground mt-0.5">Estado reservado</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-1">
              <CalendarX className="h-3.5 w-3.5" /> Cancelaciones
            </div>
            <div className="text-3xl font-bold">{cancelaciones}</div>
            <p className="text-xs text-muted-foreground mt-0.5">Hoy</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-1">
              <UserPlus className="h-3.5 w-3.5" /> Pacientes nuevos
            </div>
            <div className="text-3xl font-bold">{pacientesNuevos}</div>
            <p className="text-xs text-muted-foreground mt-0.5">Hoy</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-1">
              <Bell className="h-3.5 w-3.5" /> Recordatorios
            </div>
            <div className="text-3xl font-bold">{recordatorios}</div>
            <p className="text-xs text-muted-foreground mt-0.5">Enviados hoy</p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas */}
      {hayAlertas && (
        <div className="space-y-3">
          {turnosFallidos.length > 0 && (
            <Card className="border-l-4 border-l-red-500 bg-red-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-red-700 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  ALERTA CRÍTICA — Turnos con fallo de INSERT ({turnosFallidos.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {turnosFallidos.map((f) => (
                    <li key={f.id} className="text-sm bg-red-100 rounded-md px-3 py-2 border border-red-200">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-red-800">
                          {f.telefono ?? "Sin teléfono"}
                        </span>
                        <span className="text-xs text-red-600">
                          {format(parseISO(f.timestamp), "dd/MM HH:mm", { locale: es })}
                        </span>
                      </div>
                      {f.detalle && <p className="text-xs text-red-700 mt-0.5">{f.detalle}</p>}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {confirmacionesSinRegistro.length > 0 && (
            <Card className="border-l-4 border-l-red-700 bg-red-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-red-800 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  CRÍTICO — Claude confirmó turno sin registro en DB ({confirmacionesSinRegistro.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-red-600 mb-2">
                  Estos eventos tienen <code className="bg-red-100 px-1 rounded">nivel=critical</code> — el bot puede haber enviado una confirmación al paciente pero el turno no quedó guardado.
                </p>
                <ul className="space-y-2">
                  {confirmacionesSinRegistro.map((f) => (
                    <li key={f.id} className="text-sm bg-red-100 rounded-md px-3 py-2 border border-red-200">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-medium text-red-800">
                          {f.tipo} · {f.telefono ?? "Sin teléfono"}
                        </span>
                        <span className="text-xs text-red-600">
                          {format(parseISO(f.timestamp), "dd/MM HH:mm", { locale: es })}
                        </span>
                      </div>
                      {f.detalle && <p className="text-xs text-red-700 mt-0.5">{f.detalle}</p>}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {erroresInsert.length > 0 && (
            <Card className="border-l-4 border-l-orange-500 bg-orange-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-orange-700 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  ERROR — Fallos de INSERT en Supabase ({erroresInsert.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-orange-600 mb-2">
                  Eventos con <code className="bg-orange-100 px-1 rounded">nivel=error</code> — operaciones de escritura fallidas en la base de datos.
                </p>
                <ul className="space-y-2">
                  {erroresInsert.map((f) => (
                    <li key={f.id} className="text-sm bg-orange-100 rounded-md px-3 py-2 border border-orange-200">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-medium text-orange-800">
                          {f.tipo} · {f.telefono ?? "Sin teléfono"}
                        </span>
                        <span className="text-xs text-orange-600">
                          {format(parseISO(f.timestamp), "dd/MM HH:mm", { locale: es })}
                        </span>
                      </div>
                      {f.detalle && <p className="text-xs text-orange-700 mt-0.5">{f.detalle}</p>}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {turnosSinPaciente.length > 0 && (
            <Card className="border-l-4 border-l-yellow-500 bg-yellow-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-yellow-700 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Turnos WhatsApp sin paciente vinculado ({turnosSinPaciente.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-yellow-700 mb-2">
                  Turnos creados por el bot donde <code className="bg-yellow-100 px-1 rounded">paciente_id</code> es NULL — el paciente no fue identificado ni creado correctamente.
                </p>
                <ul className="space-y-2">
                  {turnosSinPaciente.map((t) => (
                    <li key={t.id} className="text-sm bg-yellow-100 rounded-md px-3 py-2 border border-yellow-200">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-mono text-xs text-yellow-800">ID: {t.id.slice(0, 8)}…</span>
                        <span className="text-xs text-yellow-700">
                          {format(parseISO(t.fecha + "T00:00:00"), "dd/MM/yyyy", { locale: es })} · {t.hora_inicio.slice(0, 5)}
                        </span>
                      </div>
                      <p className="text-xs text-yellow-600 mt-0.5">
                        Creado {formatDistanceToNow(parseISO(t.created_at), { locale: es, addSuffix: true })}
                      </p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {turnosSinConfirmar48h.length > 0 && (
            <Card className="border-l-4 border-l-amber-500 bg-amber-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-amber-700 flex items-center gap-2">
                  <XCircle className="h-5 w-5" />
                  Turnos reservados sin confirmar hace más de 48hs ({turnosSinConfirmar48h.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {turnosSinConfirmar48h.map((t) => (
                    <li key={t.id} className="text-sm bg-amber-100 rounded-md px-3 py-2 border border-amber-200">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-medium text-amber-900">
                          {t.paciente ? `${t.paciente.apellido}, ${t.paciente.nombre}` : "—"}
                        </span>
                        <span className="text-xs text-amber-700">
                          {format(parseISO(t.fecha + "T00:00:00"), "dd/MM/yyyy", { locale: es })} · {t.hora_inicio.slice(0, 5)}
                          {t.profesional ? ` · Dr. ${t.profesional.apellido}` : ""}
                        </span>
                      </div>
                      <p className="text-xs text-amber-600 mt-0.5">
                        Creado {formatDistanceToNow(parseISO(t.created_at), { locale: es, addSuffix: true })}
                      </p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {!hayAlertas && !loading && (
        <Card className="border-l-4 border-l-green-500 bg-green-50/50">
          <CardContent className="pt-5">
            <p className="text-sm text-green-700 font-medium flex items-center gap-2">
              ✓ Sin alertas activas — El bot opera con normalidad
            </p>
          </CardContent>
        </Card>
      )}

      {/* Log de actividad */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Log de actividad</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Hora</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Paciente / Teléfono</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead className="w-24">Nivel</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Cargando...</TableCell></TableRow>
                ) : logs.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sin registros</TableCell></TableRow>
                ) : logs.map((log) => (
                  <TableRow
                    key={log.id}
                    className={log.nivel === "critical" ? "bg-red-50" : log.nivel === "warning" ? "bg-yellow-50" : ""}
                  >
                    <TableCell className="text-xs font-mono whitespace-nowrap">
                      {format(parseISO(log.timestamp), "dd/MM HH:mm:ss", { locale: es })}
                    </TableCell>
                    <TableCell className="text-xs">
                      {TIPO_LABEL[log.tipo] ?? log.tipo}
                    </TableCell>
                    <TableCell className="text-xs">
                      {log.paciente
                        ? `${log.paciente.apellido}, ${log.paciente.nombre}`
                        : log.telefono ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs max-w-xs truncate">{log.detalle ?? "—"}</TableCell>
                    <TableCell>
                      {log.nivel && (
                        <Badge variant="outline" className={`text-xs ${NIVEL_CLASS[log.nivel] ?? ""}`}>
                          {log.nivel}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
