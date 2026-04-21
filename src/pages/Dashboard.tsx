import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, Users, Plus, Clock, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TURNO_ESTADO_CLASSES, TURNO_ESTADO_LABELS, type TurnoEstado } from "@/lib/constants";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface TurnoRow {
  id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: TurnoEstado;
  motivo_consulta: string | null;
  paciente: { nombre: string; apellido: string } | null;
  profesional: { nombre: string; apellido: string; color_agenda: string } | null;
}

export default function Dashboard() {
  const [hoy, setHoy] = useState<TurnoRow[]>([]);
  const [proximos, setProximos] = useState<TurnoRow[]>([]);
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

    const [hoyRes, proxRes, atRes] = await Promise.all([
      supabase.from("turnos").select(select).eq("fecha", today).order("hora_inicio"),
      supabase.from("turnos").select(select).gt("fecha", today).lte("fecha", in7).order("fecha").order("hora_inicio").limit(10),
      supabase.from("turnos").select("id", { count: "exact", head: true }).eq("fecha", today).eq("estado", "atendido"),
    ]);

    setHoy((hoyRes.data ?? []) as unknown as TurnoRow[]);
    setProximos((proxRes.data ?? []) as unknown as TurnoRow[]);
    setAtendidosHoy(atRes.count ?? 0);
    setLoading(false);
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

      <div className="grid gap-4 md:grid-cols-3">
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
      </div>

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
    </div>
  );
}
