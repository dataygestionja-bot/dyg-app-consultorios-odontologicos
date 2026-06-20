import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { CalendarDays, PlayCircle, FileText, Plus, RefreshCw, AlertTriangle, Pencil, XCircle } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TURNO_ESTADO_CLASSES,
  TURNO_ESTADO_LABELS,
  type TurnoEstado,
} from "@/lib/constants";
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

interface Profesional {
  id: string;
  nombre: string;
  apellido: string;
  user_id: string | null;
}

interface TurnoRow {
  id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  motivo_consulta: string;
  estado: TurnoEstado;
  es_sobreturno: boolean;
  paciente_id: string;
  profesional_id: string;
  paciente: { nombre: string; apellido: string; dni: string; telefono?: string | null } | null;
  profesional: { nombre: string; apellido: string } | null;
  atencion_id?: string | null;
}

const ESTADOS_ACTIVOS: TurnoEstado[] = [
  "reservado",
  "confirmado",
  "en_atencion" as TurnoEstado,
  "pendiente_cierre" as TurnoEstado,
];
const ESTADOS_FINALIZADOS: TurnoEstado[] = [
  "atendido",
  "ausente",
  "cancelado",
  "reprogramado",
];

const ESTADOS_INICIAR = new Set<string>([
  "reservado",
  "confirmado",
  "en_atencion",
  "pendiente_cierre",
]);

export default function MisTurnos() {
  const navigate = useNavigate();
  const { user, hasRole, hasAnyRole } = useAuth();
  const isProfesional = hasRole("profesional") && !hasAnyRole(["admin", "recepcion"]);

  const [fecha, setFecha] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [profesionalFiltro, setProfesionalFiltro] = useState<string>("ALL");
  const [miProfesionalId, setMiProfesionalId] = useState<string | null>(null);
  const [turnos, setTurnos] = useState<TurnoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"activos" | "finalizados">("activos");
  const [turnoEditar, setTurnoEditar] = useState<TurnoRow | null>(null);
  const [turnoACancelar, setTurnoACancelar] = useState<TurnoRow | null>(null);
  const [cancelando, setCancelando] = useState(false);

  useEffect(() => {
    document.title = "Mis turnos | Consultorio";
  }, []);

  // Cargar profesional logueado (si aplica) y lista de profesionales (admin/recepción)
  useEffect(() => {
    if (!user) return;

    if (isProfesional) {
      supabase
        .from("profesionales")
        .select("id, nombre, apellido, user_id")
        .eq("user_id", user.id)
        .eq("activo", true)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setMiProfesionalId(data.id);
        });
    } else {
      supabase
        .from("profesionales")
        .select("id, nombre, apellido, user_id")
        .eq("activo", true)
        .order("apellido")
        .then(({ data }) => {
          setProfesionales((data ?? []) as Profesional[]);
        });
    }
  }, [user, isProfesional]);

  const profesionalIdQuery = useMemo(() => {
    if (isProfesional) return miProfesionalId;
    return profesionalFiltro === "ALL" ? null : profesionalFiltro;
  }, [isProfesional, miProfesionalId, profesionalFiltro]);

  async function cargarTurnos() {
    if (isProfesional && !miProfesionalId) {
      setTurnos([]);
      return;
    }
    setLoading(true);
    let query = supabase
      .from("turnos")
      .select(
        `id, fecha, hora_inicio, hora_fin, motivo_consulta, estado, es_sobreturno, paciente_id, profesional_id,
         paciente:pacientes(nombre, apellido, dni, telefono),
         profesional:profesionales(nombre, apellido)`,
      )
      .eq("fecha", fecha)
      .order("hora_inicio", { ascending: true })
      .order("es_sobreturno", { ascending: true });

    if (profesionalIdQuery) {
      query = query.eq("profesional_id", profesionalIdQuery);
    }

    const { data, error } = await query;
    if (error) {
      toast.error("No se pudieron cargar los turnos", { description: error.message });
      setTurnos([]);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as unknown as TurnoRow[];

    // Buscar atenciones existentes para mapear botón
    if (rows.length > 0) {
      const ids = rows.map((r) => r.id);
      const { data: ats } = await supabase
        .from("atenciones")
        .select("id, turno_id")
        .in("turno_id", ids);
      const map = new Map<string, string>();
      (ats ?? []).forEach((a: { id: string; turno_id: string | null }) => {
        if (a.turno_id) map.set(a.turno_id, a.id);
      });
      rows.forEach((r) => {
        r.atencion_id = map.get(r.id) ?? null;
      });
    }

    setTurnos(rows);
    setLoading(false);
  }

  useEffect(() => {
    cargarTurnos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha, profesionalIdQuery, isProfesional ? miProfesionalId : null]);

  const turnosActivos = turnos.filter((t) =>
    ESTADOS_ACTIVOS.includes(t.estado as TurnoEstado),
  );
  const turnosFinalizados = turnos.filter((t) =>
    ESTADOS_FINALIZADOS.includes(t.estado as TurnoEstado),
  );

  const visibles = tab === "activos" ? turnosActivos : turnosFinalizados;

  async function iniciarAtencion(t: TurnoRow) {
    if (t.atencion_id) {
      toast.info("Este turno ya tiene una atención registrada", {
        description: "Te llevamos a la atención existente.",
      });
      navigate(`/atenciones/${t.atencion_id}`);
      return;
    }
    // Intentar marcar el turno como en_atencion (best effort)
    // Solo si el turno es de hoy: no tiene sentido iniciar la atención
    // de un turno futuro o pasado.
    const hoy = format(new Date(), "yyyy-MM-dd");
    if (t.fecha !== hoy) {
      toast.error("Solo se puede iniciar la atención el día del turno", {
        description: `Este turno es del ${t.fecha}. Hoy es ${hoy}.`,
      });
      return;
    }
    if (t.estado === "reservado" || t.estado === "confirmado") {
      await supabase
        .from("turnos")
        .update({ estado: "en_atencion" as TurnoEstado })
        .eq("id", t.id);
      // si falla por RLS, no rompemos el flujo
    }
    navigate(`/atenciones/nuevo?turno=${t.id}`);
  }

  async function confirmarCancelacion() {
    if (!turnoACancelar) return;
    setCancelando(true);
    const { error } = await supabase
      .from("turnos")
      .update({ estado: "cancelado" as TurnoEstado })
      .eq("id", turnoACancelar.id);
    setCancelando(false);
    if (error) {
      toast.error("No se pudo cancelar el turno", { description: error.message });
      return;
    }
    toast.success("Turno cancelado");
    setTurnoACancelar(null);
    cargarTurnos();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarDays className="h-6 w-6" />
            Mis turnos
          </h1>
          <p className="text-sm text-muted-foreground">
            Iniciá la atención del paciente con sus datos ya precargados desde el turno.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/atenciones/nuevo")}>
          <Plus className="h-4 w-4" />
          Nueva atención sin turno
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label>Fecha</Label>
              <Input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-[170px]"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFecha(format(new Date(), "yyyy-MM-dd"))}
            >
              Hoy
            </Button>

            {!isProfesional && (
              <div className="space-y-1">
                <Label>Profesional</Label>
                <Select value={profesionalFiltro} onValueChange={setProfesionalFiltro}>
                  <SelectTrigger className="w-[260px]">
                    <SelectValue placeholder="Todos los profesionales" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos los profesionales</SelectItem>
                    {profesionales.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.apellido}, {p.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button variant="ghost" size="sm" onClick={cargarTurnos} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="activos">Activos ({turnosActivos.length})</TabsTrigger>
          <TabsTrigger value="finalizados">Finalizados ({turnosFinalizados.length})</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">Hora</TableHead>
                      <TableHead>Paciente</TableHead>
                      {!isProfesional && <TableHead>Profesional</TableHead>}
                      <TableHead>Motivo</TableHead>
                      <TableHead className="w-[100px]">Estado</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibles.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={isProfesional ? 5 : 6}
                          className="text-center text-muted-foreground py-10"
                        >
                          {loading
                            ? "Cargando turnos..."
                            : `No hay turnos ${fecha === format(new Date(), "yyyy-MM-dd") ? "hoy" : "para esta fecha"} en este filtro.`}
                        </TableCell>
                      </TableRow>
                    ) : (
                      visibles.map((t) => {
                        const puedeIniciar = ESTADOS_INICIAR.has(t.estado);
                        return (
                          <TableRow
                            key={t.id}
                            className={t.es_sobreturno ? "bg-[hsl(var(--estado-sobreturno)/0.07)]" : ""}
                          >
                            <TableCell className="font-mono">
                              <div className="flex items-center gap-1">
                                {t.es_sobreturno && (
                                  <AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--estado-sobreturno))]" />
                                )}
                                <span>
                                  {t.hora_inicio?.slice(0, 5)} – {t.hora_fin?.slice(0, 5)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">
                                {t.paciente?.apellido}, {t.paciente?.nombre}
                              </div>
                              {t.paciente?.dni && (
                                <div className="text-xs text-muted-foreground">
                                  DNI {t.paciente.dni}
                                </div>
                              )}
                            </TableCell>
                            {!isProfesional && (
                              <TableCell>
                                {t.profesional
                                  ? `${t.profesional.apellido}, ${t.profesional.nombre}`
                                  : "—"}
                              </TableCell>
                            )}
                            <TableCell className="max-w-[280px] truncate">
                              {t.motivo_consulta}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                <Badge
                                  className={
                                    TURNO_ESTADO_CLASSES[t.estado as TurnoEstado] ??
                                    "bg-muted text-foreground"
                                  }
                                >
                                  {TURNO_ESTADO_LABELS[t.estado as TurnoEstado] ?? t.estado}
                                </Badge>
                                {t.es_sobreturno && (
                                  <Badge
                                    className="text-white"
                                    style={{ backgroundColor: "hsl(var(--estado-sobreturno))" }}
                                  >
                                    Sobreturno
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-nowrap justify-end gap-1">
                                {t.atencion_id ? (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => navigate(`/atenciones/${t.atencion_id}/ver`)}
                                    >
                                      <FileText className="h-4 w-4" />
                                      Ver atención
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => navigate(`/atenciones/${t.atencion_id}`)}
                                    >
                                      <Pencil className="h-4 w-4" />
                                      Editar atención
                                    </Button>
                                  </>
                                ) : puedeIniciar ? (
                                  <Button size="sm" onClick={() => iniciarAtencion(t)}>
                                    <PlayCircle className="h-4 w-4" />
                                    Iniciar atención
                                  </Button>
                                ) : null}
                                {!["atendido", "cancelado", "reprogramado", "ausente"].includes(t.estado) && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setTurnoEditar(t)}
                                    >
                                      <Pencil className="h-4 w-4" />
                                      Editar turno
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-destructive hover:text-destructive"
                                      onClick={() => setTurnoACancelar(t)}
                                    >
                                      <XCircle className="h-4 w-4" />
                                      Cancelar turno
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {turnoEditar && (
        <ReprogramarDialog
          turno={{
            id: turnoEditar.id,
            profesional_id: turnoEditar.profesional_id,
            fecha: turnoEditar.fecha,
            hora_inicio: turnoEditar.hora_inicio,
            motivo_consulta: turnoEditar.motivo_consulta,
            paciente_nombre: turnoEditar.paciente
              ? `${turnoEditar.paciente.nombre} ${turnoEditar.paciente.apellido}`.trim()
              : "Paciente",
            paciente_telefono: turnoEditar.paciente?.telefono ?? null,
            profesional_nombre: turnoEditar.profesional
              ? `${turnoEditar.profesional.nombre} ${turnoEditar.profesional.apellido}`.trim()
              : "",
          }}
          onClose={() => setTurnoEditar(null)}
          onDone={() => { setTurnoEditar(null); cargarTurnos(); }}
        />
      )}

      <AlertDialog
        open={!!turnoACancelar}
        onOpenChange={(v) => { if (!v && !cancelando) setTurnoACancelar(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar este turno?</AlertDialogTitle>
            <AlertDialogDescription>
              {turnoACancelar && (
                <>
                  Se cancelará el turno de{" "}
                  <span className="font-medium text-foreground">
                    {turnoACancelar.paciente
                      ? `${turnoACancelar.paciente.apellido}, ${turnoACancelar.paciente.nombre}`
                      : "el paciente"}
                  </span>{" "}
                  a las{" "}
                  <span className="font-medium text-foreground">
                    {turnoACancelar.hora_inicio.slice(0, 5)}
                  </span>
                  . Esta acción no se puede deshacer.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelando}>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmarCancelacion(); }}
              disabled={cancelando}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelando ? "Cancelando..." : "Sí, cancelar turno"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
