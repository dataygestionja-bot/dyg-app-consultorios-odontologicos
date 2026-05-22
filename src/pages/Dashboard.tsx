import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, Users, Plus, AlertCircle, Inbox, Globe, ArrowRight, Phone, UserX, Ban, Stethoscope, Pencil, XCircle, MessageSquare, BotOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TURNO_ESTADO_CLASSES, TURNO_ESTADO_LABELS, type TurnoEstado } from "@/lib/constants";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { ReprogramarDialog } from "@/components/turnos/ReprogramarDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  const { user, hasRole, hasAnyRole, loading: authLoading } = useAuth();
  const confirm = useConfirm();
  const canManagePendientes = hasAnyRole(["admin", "recepcion"]);
  const soloMisTurnos = hasRole("profesional") && !hasRole("admin") && !hasRole("recepcion");
  const puedeEditarTurnos = hasAnyRole(["admin", "recepcion"]);

  const [miProfesionalId, setMiProfesionalId] = useState<string | null>(null);
  const [profIdReady, setProfIdReady] = useState(false);
  const [hoy, setHoy] = useState<TurnoRow[]>([]);
  
  const [solicitudes, setSolicitudes] = useState<TurnoRow[]>([]);
  const [solicitudesCount, setSolicitudesCount] = useState<number>(0);
  const [pendientesCierre, setPendientesCierre] = useState<TurnoRow[]>([]);
  const [pendientesCierreCount, setPendientesCierreCount] = useState<number>(0);
  const [atendidosHoy, setAtendidosHoy] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [ahora, setAhora] = useState<Date>(new Date());
  const [turnoReprogramar, setTurnoReprogramar] = useState<TurnoRow | null>(null);
  const [turnoCancelarDash, setTurnoCancelarDash] = useState<TurnoRow | null>(null);
  const [cancelandoDash, setCancelandoDash] = useState(false);
  const [whatsappCount, setWhatsappCount] = useState<number>(0);
  const [whatsappUltimo, setWhatsappUltimo] = useState<string | null>(null);
  const [esFeriado, setEsFeriado] = useState(false);
  const [canceladosHoy, setCanceladosHoy] = useState<number>(0);



  useEffect(() => {
    document.title = "Dashboard | Consultorio";
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function resolverProfesional() {
      // Esperar a que los roles estén cargados
      if (authLoading) return;

      if (!soloMisTurnos) {
        setMiProfesionalId(null);
        setProfIdReady(true);
        return;
      }
      if (!user?.id) return;
      const { data } = await supabase
        .from("profesionales")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setMiProfesionalId(data?.id ?? null);
      setProfIdReady(true);
    }
    // Resetear para forzar re-evaluación cuando los roles cambian
    setProfIdReady(false);
    resolverProfesional();
    return () => { cancelled = true; };
  }, [user?.id, soloMisTurnos, authLoading]);

  useEffect(() => {
    if (!profIdReady) return;
    cargar(miProfesionalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profIdReady, miProfesionalId]);

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

  async function cargar(profId: string | null = miProfesionalId) {
    setLoading(true);
    const today = format(new Date(), "yyyy-MM-dd");

    const select = "id, fecha, hora_inicio, hora_fin, estado, motivo_consulta, paciente:pacientes(nombre, apellido), profesional:profesionales(nombre, apellido, color_agenda)";
    const selectSolic = "id, fecha, hora_inicio, hora_fin, estado, motivo_consulta, origen, created_at, paciente:pacientes(nombre, apellido, telefono), profesional:profesionales(nombre, apellido, color_agenda)";

    const aplicarFiltro = (q: any): any =>
      (soloMisTurnos && profId) ? q.eq("profesional_id", profId) : q;

    if (soloMisTurnos && !profId) {
      setHoy([]); setAtendidosHoy(0);
      setSolicitudes([]); setSolicitudesCount(0);
      setPendientesCierre([]); setPendientesCierreCount(0);
      setLoading(false);
      return;
    }

    const [hoyRes, atRes, solicRes, solicCountRes, pcRes, pcCountRes] = await Promise.all([
      aplicarFiltro(supabase.from("turnos").select(select).eq("fecha", today)).order("hora_inicio"),
      aplicarFiltro(supabase.from("turnos").select("id", { count: "exact", head: true }).eq("fecha", today).eq("estado", "atendido")),
      aplicarFiltro(supabase.from("turnos").select(selectSolic).eq("estado", "solicitado")).order("created_at", { ascending: false }).limit(5),
      aplicarFiltro(supabase.from("turnos").select("id", { count: "exact", head: true }).eq("estado", "solicitado")),
      aplicarFiltro(supabase.from("turnos").select(select).eq("estado", "pendiente_cierre")).order("fecha", { ascending: false }).order("hora_inicio").limit(20),
      aplicarFiltro(supabase.from("turnos").select("id", { count: "exact", head: true }).eq("estado", "pendiente_cierre")),
    ]);

    // Datos del bot WhatsApp y feriado (solo para admin/recepcion)
    if (!profId) {
      const [waCountRes, waUltimoRes, feriadoRes, canceladosRes] = await Promise.all([
        supabase.from("turnos").select("id", { count: "exact", head: true }).eq("origen", "whatsapp"),
        supabase.from("turnos").select("created_at").eq("origen", "whatsapp").order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("bloqueos_agenda").select("id").eq("todo_el_dia", true).eq("fecha_desde", today).eq("fecha_hasta", today).maybeSingle(),
        supabase.from("turnos").select("id", { count: "exact", head: true }).eq("fecha", today).eq("estado", "cancelado"),
      ]);
      setWhatsappCount(waCountRes.count ?? 0);
      setWhatsappUltimo(waUltimoRes.data?.created_at ?? null);
      setEsFeriado(!!feriadoRes.data);
      setCanceladosHoy(canceladosRes.count ?? 0);
    }

    setHoy((hoyRes.data ?? []) as unknown as TurnoRow[]);
    setAtendidosHoy(atRes.count ?? 0);
    setSolicitudes((solicRes.data ?? []) as unknown as TurnoRow[]);
    setSolicitudesCount(solicCountRes.count ?? 0);
    setPendientesCierre((pcRes.data ?? []) as unknown as TurnoRow[]);
    setPendientesCierreCount(pcCountRes.count ?? 0);
    setLoading(false);
  }

  async function marcarAusente(id: string) {
    const ok = await confirm({
      title: "Marcar como ausente",
      description: "¿Marcar este turno como ausente?",
      confirmText: "Marcar ausente",
    });
    if (!ok) return;
    const { error } = await supabase.from("turnos").update({ estado: "ausente" }).eq("id", id);
    if (error) {
      toast.error("No se pudo actualizar: " + error.message);
      return;
    }
    toast.success("Turno marcado como ausente");
    cargar();
  }

  async function cancelarTurno(id: string) {
    const ok = await confirm({
      title: "Cancelar turno",
      description: "¿Cancelar este turno?",
      confirmText: "Cancelar turno",
      cancelText: "Volver",
      destructive: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("turnos").update({ estado: "cancelado" }).eq("id", id);
    if (error) {
      toast.error("No se pudo cancelar: " + error.message);
      return;
    }
    toast.success("Turno cancelado");
    cargar();
  }

  async function confirmarCancelacionDash() {
    if (!turnoCancelarDash) return;
    setCancelandoDash(true);
    const { error } = await supabase.from("turnos").update({ estado: "cancelado" }).eq("id", turnoCancelarDash.id);
    setCancelandoDash(false);
    if (error) { toast.error("No se pudo cancelar: " + error.message); return; }
    toast.success("Turno cancelado");
    setTurnoCancelarDash(null);
    cargar();
  }

  return (
    <>
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
        {canManagePendientes && (() => {
          const total = hoy.length + canceladosHoy; // total incluyendo cancelados
          const pct = total > 0 ? (canceladosHoy / total) * 100 : 0;
          const colorClass = pct >= 50 ? "text-red-500" : pct >= 20 ? "text-amber-500" : "text-foreground";
          const borderClass = pct >= 50 ? "border-l-red-500" : pct >= 20 ? "border-l-amber-500" : "border-l-muted-foreground/30";
          return (
            <Card className={`h-full border-l-4 ${borderClass}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cancelados hoy</CardTitle>
                <Ban className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${colorClass}`}>{canceladosHoy}</div>
                <p className="text-xs text-muted-foreground">
                  {total > 0 ? `${Math.round(pct)}% del total del día` : "Sin turnos hoy"}
                </p>
              </CardContent>
            </Card>
          );
        })()}
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
        {canManagePendientes && (() => {
          const ahora = new Date();
          const hora = ahora.getHours();
          const diaSemana = ahora.getDay();
          const esDomingo = diaSemana === 0;
          const fueraDeHorario = hora < 8 || hora >= 20;
          const inhabil = esDomingo || esFeriado || fueraDeHorario;

          const ultimoDate = whatsappUltimo ? new Date(whatsappUltimo) : null;
          const diffHoras = ultimoDate ? (ahora.getTime() - ultimoDate.getTime()) / (1000 * 60 * 60) : null;
          const hayAlertaNaranja = !inhabil && diffHoras !== null && diffHoras > 4 && diffHoras <= 8;
          const hayAlertaRoja = !inhabil && diffHoras !== null && diffHoras > 8;
          const hayAlerta = hayAlertaNaranja || hayAlertaRoja;

          const colorClass = hayAlertaRoja
            ? "text-red-500"
            : hayAlertaNaranja
            ? "text-amber-500"
            : "text-green-600";

          const borderClass = hayAlertaRoja
            ? "border-l-red-500"
            : hayAlertaNaranja
            ? "border-l-amber-500"
            : "border-l-green-500";

          const ultimoLabel = ultimoDate
            ? format(ultimoDate, "dd/MM HH:mm'hs'")
            : "Sin registros";

          return (
            <Card className={`border-l-4 ${borderClass}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                  {hayAlerta
                    ? <BotOff className={`h-4 w-4 ${colorClass}`} />
                    : <MessageSquare className="h-4 w-4 text-green-600" />
                  }
                  Bot WhatsApp
                </CardTitle>
                {hayAlerta && <AlertCircle className={`h-4 w-4 ${colorClass}`} />}
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${colorClass}`}>
                  {whatsappCount}
                </div>
                <p className="text-xs text-muted-foreground">
                  Último: {ultimoLabel}
                </p>
              </CardContent>
            </Card>
          );
        })()}
      </div>

      {solicitudesCount > 0 && canManagePendientes && (
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

      <Card>
        <CardHeader>
          <CardTitle>Turnos de hoy</CardTitle>
          <CardDescription>
            {soloMisTurnos ? "Tus turnos programados para hoy" : "Agenda completa del día"}
          </CardDescription>
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
                    {!["atendido", "cancelado", "reprogramado", "ausente"].includes(t.estado) && puedeEditarTurnos && (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs gap-1"
                          onClick={() => setTurnoReprogramar(t)}
                        >
                          <Pencil className="h-3 w-3" /> Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs gap-1 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setTurnoCancelarDash(t)}
                        >
                          <XCircle className="h-3 w-3" /> Cancelar
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

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

      {turnoReprogramar && (
        <ReprogramarDialog
          turno={{
            id: turnoReprogramar.id,
            profesional_id: turnoReprogramar.profesional?.nombre ?? "",
            fecha: turnoReprogramar.fecha,
            hora_inicio: turnoReprogramar.hora_inicio,
            motivo_consulta: turnoReprogramar.motivo_consulta,
            paciente_nombre: turnoReprogramar.paciente
              ? `${turnoReprogramar.paciente.nombre} ${turnoReprogramar.paciente.apellido}`.trim()
              : "Paciente",
            paciente_telefono: turnoReprogramar.paciente?.telefono ?? null,
            profesional_nombre: turnoReprogramar.profesional
              ? `${turnoReprogramar.profesional.nombre} ${turnoReprogramar.profesional.apellido}`
              : "",
          }}
          onClose={() => setTurnoReprogramar(null)}
          onDone={() => { setTurnoReprogramar(null); cargar(); }}
        />
      )}

      <AlertDialog open={!!turnoCancelarDash} onOpenChange={(v) => { if (!v && !cancelandoDash) setTurnoCancelarDash(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar este turno?</AlertDialogTitle>
            <AlertDialogDescription>
              {turnoCancelarDash && (
                <>
                  Se cancelará el turno de{" "}
                  <span className="font-medium text-foreground">
                    {turnoCancelarDash.paciente
                      ? `${turnoCancelarDash.paciente.apellido}, ${turnoCancelarDash.paciente.nombre}`
                      : "el paciente"}
                  </span>{" "}
                  a las{" "}
                  <span className="font-medium text-foreground">
                    {turnoCancelarDash.hora_inicio.slice(0, 5)}
                  </span>. Esta acción no se puede deshacer.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelandoDash}>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmarCancelacionDash(); }}
              disabled={cancelandoDash}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelandoDash ? "Cancelando..." : "Sí, cancelar turno"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
