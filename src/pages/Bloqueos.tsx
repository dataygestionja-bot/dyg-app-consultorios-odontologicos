import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format, parseISO, isValid } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarOff, Plus, AlertTriangle, Pencil, Ban, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type MotivoBloqueo =
  | "vacaciones" | "enfermedad" | "capacitacion" | "licencia" | "feriado" | "personal" | "otro";

export type BloqueoEstado = "activo" | "cancelado";

export const MOTIVO_LABELS: Record<MotivoBloqueo, string> = {
  vacaciones: "Vacaciones",
  enfermedad: "Enfermedad",
  capacitacion: "Capacitación",
  licencia: "Licencia",
  feriado: "Feriado",
  personal: "Personal",
  otro: "Otro",
};

interface Profesional { id: string; nombre: string; apellido: string; }

export interface Bloqueo {
  id: string;
  profesional_id: string;
  fecha_desde: string;
  fecha_hasta: string;
  todo_el_dia: boolean;
  hora_desde: string | null;
  hora_hasta: string | null;
  motivo: MotivoBloqueo;
  observaciones: string | null;
  estado: BloqueoEstado;
  created_at: string;
  profesional?: { nombre: string; apellido: string } | null;
}

interface TurnoAfectado {
  id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  paciente: { nombre: string; apellido: string } | null;
}

const MOTIVOS: MotivoBloqueo[] = ["vacaciones","enfermedad","capacitacion","licencia","feriado","personal","otro"];

const safeFormatDate = (s: string | null | undefined) => {
  if (!s) return "—";
  const d = parseISO(s);
  return isValid(d) ? format(d, "dd/MM/yyyy", { locale: es }) : "—";
};

export default function Bloqueos() {
  const { user, hasRole } = useAuth();
  const { can } = usePermissions();
  const canEdit = can("bloqueos_agenda", "create") || can("bloqueos_agenda", "update") || can("bloqueos_agenda", "delete");
  const esProfRestringido = hasRole("profesional") && !hasRole("admin") && !hasRole("recepcion");
  const [miProfesionalId, setMiProfesionalId] = useState<string>("");

  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [bloqueos, setBloqueos] = useState<Bloqueo[]>([]);
  const [loading, setLoading] = useState(false);

  // Filtros
  const [filtroProf, setFiltroProf] = useState<string>("ALL");
  const [filtroEstado, setFiltroEstado] = useState<string>("activo");
  const [filtroDesde, setFiltroDesde] = useState<string>("");
  const [filtroHasta, setFiltroHasta] = useState<string>("");

  // Dialog
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Bloqueo | null>(null);
  const [fProf, setFProf] = useState("");
  const [fDesde, setFDesde] = useState("");
  const [fHasta, setFHasta] = useState("");
  const [fTodoDia, setFTodoDia] = useState(true);
  const [fHoraDesde, setFHoraDesde] = useState("09:00");
  const [fHoraHasta, setFHoraHasta] = useState("13:00");
  const [fMotivo, setFMotivo] = useState<MotivoBloqueo>("vacaciones");
  const [fObs, setFObs] = useState("");
  const [saving, setSaving] = useState(false);

  // Confirmación de turnos afectados
  const [turnosAfectados, setTurnosAfectados] = useState<TurnoAfectado[]>([]);
  const [confirmAfectados, setConfirmAfectados] = useState(false);

  useEffect(() => {
    document.title = "Bloqueos de agenda | Consultorio";
    supabase.from("profesionales")
      .select("id, nombre, apellido")
      .eq("activo", true)
      .order("apellido")
      .then(({ data }) => setProfesionales((data ?? []) as Profesional[]));
  }, []);

  // Lookup del profesional logueado para restringir al perfil profesional
  useEffect(() => {
    if (!user || !esProfRestringido) return;
    supabase.from("profesionales")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.id) {
          setMiProfesionalId(data.id);
          setFiltroProf(data.id);
        }
      });
  }, [user, esProfRestringido]);

  useEffect(() => { cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ },
    [filtroProf, filtroEstado, filtroDesde, filtroHasta]);

  async function cargar() {
    setLoading(true);
    let q = supabase.from("bloqueos_agenda")
      .select("*, profesional:profesionales(nombre, apellido)")
      .order("fecha_desde", { ascending: false });
    if (filtroProf !== "ALL") q = q.eq("profesional_id", filtroProf);
    if (filtroEstado !== "ALL") q = q.eq("estado", filtroEstado as BloqueoEstado);
    if (filtroDesde) q = q.gte("fecha_hasta", filtroDesde);
    if (filtroHasta) q = q.lte("fecha_desde", filtroHasta);
    const { data, error } = await q;
    if (error) {
      toast.error("No se pudieron cargar los bloqueos", { description: error.message });
      setBloqueos([]);
    } else {
      setBloqueos((data ?? []) as unknown as Bloqueo[]);
    }
    setLoading(false);
  }

  function abrirNuevo() {
    setEditing(null);
    setFProf(esProfRestringido ? miProfesionalId : "");
    setFDesde(format(new Date(), "yyyy-MM-dd"));
    setFHasta(format(new Date(), "yyyy-MM-dd"));
    setFTodoDia(true);
    setFHoraDesde("09:00");
    setFHoraHasta("13:00");
    setFMotivo("vacaciones");
    setFObs("");
    setOpen(true);
  }

  function abrirEditar(b: Bloqueo) {
    setEditing(b);
    setFProf(b.profesional_id);
    setFDesde(b.fecha_desde);
    setFHasta(b.fecha_hasta);
    setFTodoDia(b.todo_el_dia);
    setFHoraDesde(b.hora_desde?.slice(0, 5) ?? "09:00");
    setFHoraHasta(b.hora_hasta?.slice(0, 5) ?? "13:00");
    setFMotivo(b.motivo);
    setFObs(b.observaciones ?? "");
    setOpen(true);
  }

  async function buscarTurnosAfectados(): Promise<TurnoAfectado[]> {
    let q = supabase.from("turnos")
      .select("id, fecha, hora_inicio, hora_fin, paciente:pacientes(nombre, apellido)")
      .eq("profesional_id", fProf)
      .gte("fecha", fDesde)
      .lte("fecha", fHasta)
      .not("estado", "in", "(cancelado,reprogramado,ausente)")
      .order("fecha", { ascending: true })
      .order("hora_inicio", { ascending: true });
    const { data, error } = await q;
    if (error) {
      console.error("Error buscando turnos afectados:", error);
      return [];
    }
    let rows = (data ?? []) as unknown as TurnoAfectado[];
    if (!fTodoDia) {
      rows = rows.filter((t) =>
        t.hora_inicio < fHoraHasta + ":00" && t.hora_fin > fHoraDesde + ":00",
      );
    }
    // Si estamos editando, ignorar los que ya estaban dentro del rango previo (ya advertidos)
    return rows;
  }

  async function intentarGuardar() {
    if (!fProf) return toast.error("Seleccioná un profesional");
    if (!fDesde || !fHasta) return toast.error("Las fechas son obligatorias");
    if (fHasta < fDesde) return toast.error("La fecha hasta no puede ser anterior a la fecha desde");
    if (!fTodoDia && fHoraHasta <= fHoraDesde) return toast.error("La hora hasta debe ser mayor a la hora desde");

    const afectados = await buscarTurnosAfectados();
    if (afectados.length > 0) {
      setTurnosAfectados(afectados);
      setConfirmAfectados(true);
      return;
    }
    await guardar();
  }

  async function guardar() {
    if (saving) return;
    setSaving(true);
    try {
      const payload = {
        profesional_id: fProf,
        fecha_desde: fDesde,
        fecha_hasta: fHasta,
        todo_el_dia: fTodoDia,
        hora_desde: fTodoDia ? null : fHoraDesde,
        hora_hasta: fTodoDia ? null : fHoraHasta,
        motivo: fMotivo,
        observaciones: fObs.trim() || null,
        ...(editing ? {} : { created_by: user?.id ?? null, estado: "activo" as BloqueoEstado }),
      };
      const res = editing
        ? await supabase.from("bloqueos_agenda").update(payload).eq("id", editing.id)
        : await supabase.from("bloqueos_agenda").insert(payload);
      if (res.error) {
        return toast.error("No se pudo guardar", { description: res.error.message });
      }
      toast.success(editing ? "Bloqueo actualizado" : "Bloqueo creado");
      setOpen(false);
      setConfirmAfectados(false);
      setTurnosAfectados([]);
      cargar();
    } finally {
      setSaving(false);
    }
  }

  async function cancelarBloqueo(b: Bloqueo) {
    if (!confirm("¿Cancelar este bloqueo? Quedará registrado como cancelado.")) return;
    const { error } = await supabase
      .from("bloqueos_agenda")
      .update({ estado: "cancelado" })
      .eq("id", b.id);
    if (error) return toast.error("No se pudo cancelar", { description: error.message });
    toast.success("Bloqueo cancelado");
    cargar();
  }

  async function eliminarBloqueo(b: Bloqueo) {
    if (!confirm("¿Eliminar definitivamente este bloqueo?")) return;
    const { error } = await supabase.from("bloqueos_agenda").delete().eq("id", b.id);
    if (error) return toast.error("No se pudo eliminar", { description: error.message });
    toast.success("Bloqueo eliminado");
    cargar();
  }

  const profActual = useMemo(() => profesionales.find((p) => p.id === fProf), [profesionales, fProf]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarOff className="h-6 w-6" />
            Bloqueos de agenda
          </h1>
          <p className="text-sm text-muted-foreground">
            Registrá los períodos en que un profesional no estará disponible.
          </p>
        </div>
        {canEdit && (
          <Button onClick={abrirNuevo}>
            <Plus className="h-4 w-4" />
            Nuevo bloqueo
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            {!esProfRestringido && (
              <div className="space-y-1">
                <Label>Profesional</Label>
                <Select value={filtroProf} onValueChange={setFiltroProf}>
                  <SelectTrigger className="w-[240px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos</SelectItem>
                    {profesionales.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.apellido}, {p.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label>Estado</Label>
              <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="activo">Activos</SelectItem>
                  <SelectItem value="cancelado">Cancelados</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Desde</Label>
              <Input type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} className="w-[160px]" />
            </div>
            <div className="space-y-1">
              <Label>Hasta</Label>
              <Input type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} className="w-[160px]" />
            </div>
            <Button variant="ghost" size="sm" onClick={() => { if (!esProfRestringido) setFiltroProf("ALL"); setFiltroEstado("activo"); setFiltroDesde(""); setFiltroHasta(""); }}>
              Limpiar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Profesional</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Horario</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Observaciones</TableHead>
                  <TableHead>Estado</TableHead>
                  {canEdit && <TableHead className="text-right">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {bloqueos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canEdit ? 7 : 6} className="text-center text-muted-foreground py-10">
                      {loading ? "Cargando..." : "No hay bloqueos para los filtros seleccionados."}
                    </TableCell>
                  </TableRow>
                ) : bloqueos.map((b) => (
                  <TableRow key={b.id} className={b.estado === "cancelado" ? "opacity-60" : ""}>
                    <TableCell className="font-medium">
                      {b.profesional ? `${b.profesional.apellido}, ${b.profesional.nombre}` : "—"}
                    </TableCell>
                    <TableCell>
                      {b.fecha_desde === b.fecha_hasta
                        ? safeFormatDate(b.fecha_desde)
                        : `${safeFormatDate(b.fecha_desde)} → ${safeFormatDate(b.fecha_hasta)}`}
                    </TableCell>
                    <TableCell>
                      {b.todo_el_dia
                        ? <Badge variant="outline">Todo el día</Badge>
                        : `${b.hora_desde?.slice(0, 5)} – ${b.hora_hasta?.slice(0, 5)}`}
                    </TableCell>
                    <TableCell>{MOTIVO_LABELS[b.motivo]}</TableCell>
                    <TableCell className="max-w-[260px] truncate text-sm text-muted-foreground">
                      {b.observaciones ?? "—"}
                    </TableCell>
                    <TableCell>
                      {b.estado === "activo" ? (
                        <Badge style={{ backgroundColor: "hsl(var(--estado-bloqueado))" }} className="text-white">
                          Activo
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Cancelado</Badge>
                      )}
                    </TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => abrirEditar(b)} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {b.estado === "activo" && (
                            <Button size="sm" variant="ghost" onClick={() => cancelarBloqueo(b)} title="Cancelar">
                              <Ban className="h-4 w-4" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => eliminarBloqueo(b)} title="Eliminar">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog crear/editar */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar bloqueo" : "Nuevo bloqueo"}</DialogTitle>
            <DialogDescription>
              {editing ? "Modificá los datos del bloqueo." : "Registrá un período en que el profesional no estará disponible."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Profesional *</Label>
              {esProfRestringido ? (
                <Input
                  value={profActual ? `${profActual.apellido}, ${profActual.nombre}` : "—"}
                  disabled
                />
              ) : (
                <Select value={fProf} onValueChange={setFProf}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar profesional" /></SelectTrigger>
                  <SelectContent>
                    {profesionales.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.apellido}, {p.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Fecha desde *</Label>
                <Input type="date" value={fDesde} onChange={(e) => setFDesde(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Fecha hasta *</Label>
                <Input type="date" value={fHasta} onChange={(e) => setFHasta(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label htmlFor="todo-dia" className="cursor-pointer">Todo el día</Label>
                <p className="text-xs text-muted-foreground">Bloquea el día completo del profesional.</p>
              </div>
              <Switch id="todo-dia" checked={fTodoDia} onCheckedChange={setFTodoDia} />
            </div>

            {!fTodoDia && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>Hora desde *</Label>
                  <Input type="time" value={fHoraDesde} onChange={(e) => setFHoraDesde(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Hora hasta *</Label>
                  <Input type="time" value={fHoraHasta} onChange={(e) => setFHoraHasta(e.target.value)} />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Motivo *</Label>
              <Select value={fMotivo} onValueChange={(v) => setFMotivo(v as MotivoBloqueo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MOTIVOS.map((m) => (
                    <SelectItem key={m} value={m}>{MOTIVO_LABELS[m]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Observaciones</Label>
              <Textarea value={fObs} onChange={(e) => setFObs(e.target.value)} rows={3} placeholder="Notas internas (opcional)" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={intentarGuardar} disabled={saving}>
              {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear bloqueo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Advertencia de turnos afectados */}
      <AlertDialog open={confirmAfectados} onOpenChange={setConfirmAfectados}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-[hsl(var(--warning))]" />
              Hay {turnosAfectados.length} turno{turnosAfectados.length === 1 ? "" : "s"} dentro del rango bloqueado
            </AlertDialogTitle>
            <AlertDialogDescription>
              Estos turnos <strong>no se cancelan automáticamente</strong>. Podés crear el bloqueo igual y luego ir a <strong>Turnos</strong> para reprogramarlos o cancelarlos manualmente.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="max-h-[300px] overflow-y-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Horario</TableHead>
                  <TableHead>Paciente</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {turnosAfectados.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{safeFormatDate(t.fecha)}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {t.hora_inicio?.slice(0, 5)}–{t.hora_fin?.slice(0, 5)}
                    </TableCell>
                    <TableCell>
                      {t.paciente ? `${t.paciente.apellido}, ${t.paciente.nombre}` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <AlertDialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button asChild variant="ghost" size="sm">
              <Link to="/turnos" target="_blank" rel="noopener">
                <ExternalLink className="h-4 w-4" />
                Ir a Turnos
              </Link>
            </Button>
            <div className="flex gap-2">
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={guardar} disabled={saving}>
                Crear bloqueo igual
              </AlertDialogAction>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
