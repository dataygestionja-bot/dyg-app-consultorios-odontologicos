import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, Users, Plus, Clock, AlertCircle, Inbox, Globe, ArrowRight, Phone, UserX, Ban, Stethoscope } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TURNO_ESTADO_CLASSES, TURNO_ESTADO_LABELS, type TurnoEstado } from "@/lib/constants";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface TurnoRow {
  id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: TurnoEstado;
  motivo_consulta: string | null;
  origen?: string | null;
  created_at?: string | null;
  paciente: { nombre: string; apellido: string; telefono?: string | null } | null;
  profesional: { nombre: string; apellido: string; color_agenda: string } | null;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { hasAnyRole } = useAuth();
  const canManagePendientes = hasAnyRole(["admin", "recepcion"]);

  const [hoy, setHoy] = useState<TurnoRow[]>([]);
  const [proximos, setProximos] = useState<TurnoRow[]>([]);
  const [solicitudes, setSolicitudes] = useState<TurnoRow[]>([]);
  const [solicitudesCount, setSolicitudesCount] = useState<number>(0);
  const [pendientesCierre, setPendientesCierre] = useState<TurnoRow[]>([]);
  const [pendientesCierreCount, setPendientesCierreCount] = useState<number>(0);
  const [atendidosHoy, setAtendidosHoy] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [ahora, setAhora] = useState<Date>(new Date());

  useEffect(() => {
    document.title = "Dashboard | Consultorio";
    cargar();
  }, []);

  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  function getHorarioInfo(t: TurnoRow): { label: string; className: string; icon?: boolean } | null {
    if (t.estado === "atendido" || t.estado === "cancelado" || t.estado === "ausente") return null;
    const inicio = new Date(`${t.fecha}T${t.hora_inicio}`);
    const fin = new Date(`${t.fecha}T${t.hora_fin}`);
    if (ahora < inicio) {
      return { label: "Pendiente", className: "border-muted-foreground/30 text-muted-foreground" };
    }
    if (ahora >= inicio && ahora <= fin) {
      return { label: "En horario", className: "border-blue-500/50 text-blue-600 dark:text-blue-400 bg-blue-500/10" };
    }
    return { label: "Fuera de horario", className: "border-amber-500/50 text-amber-700 dark:text-amber-400 bg-amber-500/10", icon: true };
  }

  async function cargar() {
    setLoading(true);
    const today = format(new Date(), "yyyy-MM-dd");
    const in7 = format(new Date(Date.now() + 7 * 86400000), "yyyy-MM-dd");

    const select = "id, fecha, hora_inicio, hora_fin, estado, motivo_consulta, paciente:pacientes(nombre, apellido), profesional:profesionales(nombre, apellido, color_agenda)";
    const selectSolic = "id, fecha, hora_inicio, hora_fin, estado, motivo_consulta, origen, created_at, paciente:pacientes(nombre, apellido, telefono), profesional:profesionales(nombre, apellido, color_agenda)";

    const [hoyRes, proxRes, atRes, solicRes, solicCountRes, pcRes, pcCountRes] = await Promise.all([
      supabase.from("turnos").select(select).eq("fecha", today).order("hora_inicio"),
      supabase.from("turnos").select(select).gt("fecha", today).lte("fecha", in7).order("fecha").order("hora_inicio").limit(10),
      supabase.from("turnos").select("id", { count: "exact", head: true }).eq("fecha", today).eq("estado", "atendido"),
      supabase.from("turnos").select(selectSolic).eq("estado", "solicitado").order("created_at", { ascending: false }).limit(5),
      supabase.from("turnos").select("id", { count: "exact", head: true }).eq("estado", "solicitado"),
      supabase.from("turnos").select(select).eq("estado", "pendiente_cierre").order("fecha", { ascending: false }).order("hora_inicio").limit(20),
      supabase.from("turnos").select("id", { count: "exact", head: true }).eq("estado", "pendiente_cierre"),
    ]);

    setHoy((hoyRes.data ?? []) as unknown as TurnoRow[]);
    setProximos((proxRes.data ?? []) as unknown as TurnoRow[]);
    setAtendidosHoy(atRes.count ?? 0);
    setSolicitudes((solicRes.data ?? []) as unknown as TurnoRow[]);
    setSolicitudesCount(solicCountRes.count ?? 0);
    setPendientesCierre((pcRes.data ?? []) as unknown as TurnoRow[]);
    setPendientesCierreCount(pcCountRes.count ?? 0);
    setLoading(false);
  }

  async function marcarAusente(id: string) {
    if (!confirm("¿Marcar este turno como ausente?")) return;
    const { error } = await supabase.from("turnos").update({ estado: "ausente" }).eq("id", id);
    if (error) {
      toast.error("No se pudo actualizar: " + error.message);
      return;
    }
    toast.success("Turno marcado como ausente");
    cargar();
  }

  async function cancelarTurno(id: string) {
    if (!confirm("¿Cancelar este turno?")) return;
    const { error } = await supabase.from("turnos").update({ estado: "cancelado" }).eq("id", id);
    if (error) {
      toast.error("No se pudo cancelar: " + error.message);
      return;
    }
    toast.success("Turno cancelado");
    cargar();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), "EEEE d 'de' MMMM 'de' yyyy", { locale: es })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/pacientes/nuevo"><Plus className="h-4 w-4" /> Paciente</Link>
          </Button>
          <Button asChild>
            <Link to="/turnos"><Plus className="h-4 w-4" /> Turno</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Turnos hoy</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{hoy.length}</div>
            <p className="text-xs text-muted-foreground">Programados para hoy</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atendidos hoy</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{atendidosHoy}</div>
            <p className="text-xs text-muted-foreground">Pacientes atendidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Próximos 7 días</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{proximos.length}</div>
            <p className="text-xs text-muted-foreground">Turnos próximos</p>
          </CardContent>
        </Card>
        <Link to="/turnos/solicitudes" className="block">
          <Card
            className="h-full transition-all hover:shadow-md border-l-4"
            style={{ borderLeftColor: "hsl(var(--estado-solicitado))" }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Solicitudes pendientes</CardTitle>
              <Inbox className="h-4 w-4" style={{ color: "hsl(var(--estado-solicitado))" }} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" style={{ color: "hsl(var(--estado-solicitado))" }}>
                {solicitudesCount}
              </div>
              <p className="text-xs text-muted-foreground">Reservas a confirmar</p>
            </CardContent>
          </Card>
        </Link>
        {canManagePendientes && (
          <a href="#pendientes-cierre" className="block">
            <Card
              className="h-full transition-all hover:shadow-md border-l-4"
              style={{ borderLeftColor: "hsl(var(--estado-pendiente-cierre))" }}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pendientes de cierre</CardTitle>
                <AlertCircle className="h-4 w-4" style={{ color: "hsl(var(--estado-pendiente-cierre))" }} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold" style={{ color: "hsl(var(--estado-pendiente-cierre))" }}>
                  {pendientesCierreCount}
                </div>
                <p className="text-xs text-muted-foreground">Turnos sin cerrar</p>
              </CardContent>
            </Card>
          </a>
        )}
      </div>

      {solicitudesCount > 0 && (
        <Card
          className="border-l-4"
          style={{
            borderLeftColor: "hsl(var(--estado-solicitado))",
            backgroundColor: "hsl(var(--estado-solicitado) / 0.06)",
          }}
        >
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div className="flex items-center gap-2 min-w-0">
              <Inbox className="h-5 w-5 shrink-0" style={{ color: "hsl(var(--estado-solicitado))" }} />
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 flex-wrap">
                  Turnos solicitados
                  <Badge className={TURNO_ESTADO_CLASSES.solicitado}>{solicitudesCount}</Badge>
                </CardTitle>
                <CardDescription>Reservas pendientes de aprobación desde el formulario público</CardDescription>
              </div>
            </div>
            <Button asChild size="sm" variant="outline" className="shrink-0">
              <Link to="/turnos/solicitudes">
                Gestionar <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {solicitudes.map((s) => (
                <li key={s.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="h-9 w-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: s.profesional?.color_agenda ?? "hsl(var(--estado-solicitado))" }}
                    />
                    <div className="min-w-0">
                      <p className="font-medium truncate flex items-center gap-2">
                        {s.paciente ? `${s.paciente.apellido}, ${s.paciente.nombre}` : "—"}
                        {s.origen === "publico" && (
                          <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {format(new Date(s.fecha + "T00:00:00"), "EEE d MMM", { locale: es })} · {s.hora_inicio.slice(0, 5)} · Dr. {s.profesional?.apellido ?? "—"}
                        {s.motivo_consulta ? ` · ${s.motivo_consulta}` : ""}
                      </p>
                      {s.paciente?.telefono && (
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {s.paciente.telefono}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge className={`${TURNO_ESTADO_CLASSES.solicitado} shrink-0`}>
                    {TURNO_ESTADO_LABELS.solicitado}
                  </Badge>
                </li>
              ))}
            </ul>
            {solicitudesCount > solicitudes.length && (
              <div className="pt-3 text-right">
                <Button asChild variant="link" size="sm">
                  <Link to="/turnos/solicitudes">
                    Ver todas ({solicitudesCount}) <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Turnos de hoy</CardTitle>
            <CardDescription>Agenda completa del día</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Cargando...</p>
            ) : hoy.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay turnos programados para hoy.</p>
            ) : (
              <ul className="divide-y">
                {hoy.map((t) => {
                  const horario = getHorarioInfo(t);
                  return (
                  <li key={t.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="h-9 w-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: t.profesional?.color_agenda ?? "hsl(var(--primary))" }}
                      />
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {t.paciente ? `${t.paciente.apellido}, ${t.paciente.nombre}` : "—"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {t.hora_inicio.slice(0, 5)} · Dr. {t.profesional?.apellido ?? "—"}
                          {t.motivo_consulta ? ` · ${t.motivo_consulta}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      <Badge className={TURNO_ESTADO_CLASSES[t.estado]}>
                        {TURNO_ESTADO_LABELS[t.estado]}
                      </Badge>
                      {horario && (
                        <Badge variant="outline" className={`gap-1 ${horario.className}`}>
                          {horario.icon && <AlertCircle className="h-3 w-3" />}
                          {horario.label}
                        </Badge>
                      )}
                    </div>
                  </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Próximos turnos</CardTitle>
            <CardDescription>Siguientes 7 días</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Cargando...</p>
            ) : proximos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin turnos en la próxima semana.</p>
            ) : (
              <ul className="divide-y">
                {proximos.map((t) => (
                  <li key={t.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {t.paciente ? `${t.paciente.apellido}, ${t.paciente.nombre}` : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {format(new Date(t.fecha + "T00:00:00"), "EEE d MMM", { locale: es })} · {t.hora_inicio.slice(0, 5)} · Dr. {t.profesional?.apellido ?? "—"}
                      </p>
                    </div>
                    <Badge variant="outline">{TURNO_ESTADO_LABELS[t.estado]}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {canManagePendientes && pendientesCierreCount > 0 && (
        <Card
          id="pendientes-cierre"
          className="border-l-4 scroll-mt-20"
          style={{
            borderLeftColor: "hsl(var(--estado-pendiente-cierre))",
            backgroundColor: "hsl(var(--estado-pendiente-cierre) / 0.06)",
          }}
        >
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="h-5 w-5 shrink-0" style={{ color: "hsl(var(--estado-pendiente-cierre))" }} />
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 flex-wrap">
                  Turnos pendientes de cierre
                  <Badge className={TURNO_ESTADO_CLASSES.pendiente_cierre}>{pendientesCierreCount}</Badge>
                </CardTitle>
                <CardDescription>
                  Turnos pasados sin atención registrada. Resolvelos para mantener la agenda al día.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {pendientesCierre.map((t) => (
                <li key={t.id} className="py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="h-9 w-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: t.profesional?.color_agenda ?? "hsl(var(--primary))" }}
                    />
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {t.paciente ? `${t.paciente.apellido}, ${t.paciente.nombre}` : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {format(new Date(t.fecha + "T00:00:00"), "dd MMM", { locale: es })} · {t.hora_inicio.slice(0, 5)} · Dr. {t.profesional?.apellido ?? "—"}
                        {t.motivo_consulta ? ` · ${t.motivo_consulta}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    <Button
                      size="sm"
                      variant="default"
                      className="h-7 px-2 text-xs gap-1.5"
                      onClick={() => navigate(`/atenciones/nuevo?turnoId=${t.id}`)}
                    >
                      <Stethoscope className="h-3.5 w-3.5" /> Iniciar atención
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs gap-1.5"
                      onClick={() => marcarAusente(t.id)}
                    >
                      <UserX className="h-3.5 w-3.5" /> Marcar como ausente
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => cancelarTurno(t.id)}
                    >
                      <Ban className="h-3.5 w-3.5" /> Cancelar turno
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            {pendientesCierreCount > pendientesCierre.length && (
              <div className="pt-3 text-right">
                <Button asChild variant="link" size="sm">
                  <Link to="/turnos">
                    Ver todos ({pendientesCierreCount}) <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
