import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format, addDays, startOfWeek, parseISO, isSameDay, isValid } from "date-fns";
import { es } from "date-fns/locale";
import { TURNO_ESTADOS, TURNO_ESTADO_LABELS, TURNO_ESTADO_CLASSES, type TurnoEstado } from "@/lib/constants";

const safeFormat = (d: Date | null | undefined, fmt: string, opts?: Parameters<typeof format>[2]) => {
  if (!d || !isValid(d)) return "";
  try { return format(d, fmt, opts); } catch { return ""; }
};
const safeParseISO = (s: string | null | undefined): Date | null => {
  if (!s) return null;
  const d = parseISO(s);
  return isValid(d) ? d : null;
};
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";

interface Profesional { id: string; nombre: string; apellido: string; color_agenda: string; }
interface Horario { id: string; profesional_id: string; dia_semana: number; hora_inicio: string; hora_fin: string; duracion_slot_min: number; activo: boolean; }
interface Paciente { id: string; nombre: string; apellido: string; dni: string; }
interface Turno {
  id: string;
  paciente_id: string;
  profesional_id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  motivo_consulta: string | null;
  estado: TurnoEstado;
  es_sobreturno: boolean;
  paciente?: { nombre: string; apellido: string } | null;
}

interface Slot { hora_inicio: string; hora_fin: string; }

function generarSlots(horarios: Horario[], dia: number): Slot[] {
  const slots: Slot[] = [];
  const propios = horarios.filter((h) => h.activo && h.dia_semana === dia);
  for (const h of propios) {
    const [hi, mi] = h.hora_inicio.split(":").map(Number);
    const [hf, mf] = h.hora_fin.split(":").map(Number);
    let cur = hi * 60 + mi;
    const end = hf * 60 + mf;
    while (cur + h.duracion_slot_min <= end) {
      const next = cur + h.duracion_slot_min;
      slots.push({
        hora_inicio: `${String(Math.floor(cur / 60)).padStart(2, "0")}:${String(cur % 60).padStart(2, "0")}`,
        hora_fin: `${String(Math.floor(next / 60)).padStart(2, "0")}:${String(next % 60).padStart(2, "0")}`,
      });
      cur = next;
    }
  }
  return slots;
}

export default function Turnos() {
  const { hasAnyRole } = useAuth();
  const canEdit = hasAnyRole(["admin", "recepcion"]);

  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [profSel, setProfSel] = useState<string>("");
  const [fecha, setFecha] = useState<Date>(new Date());
  const [vista, setVista] = useState<"dia" | "semana">("dia");

  // Dialog
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Turno | null>(null);
  const [slot, setSlot] = useState<{ profesional_id: string; fecha: string; hora_inicio: string; hora_fin: string } | null>(null);
  const [pacienteId, setPacienteId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [estado, setEstado] = useState<TurnoEstado>("reservado");
  const [esSobreturno, setEsSobreturno] = useState(false);
  const [pacienteSearch, setPacienteSearch] = useState("");
  // Editable fields when editing
  const [editProfId, setEditProfId] = useState("");
  const [editFecha, setEditFecha] = useState("");
  const [editHoraInicio, setEditHoraInicio] = useState("");
  const [editHoraFin, setEditHoraFin] = useState("");
  const [saving, setSaving] = useState(false);
  // Confirmación de sobreturno cuando hay choque
  const [confirmSobreturno, setConfirmSobreturno] = useState(false);

  const ESTADOS_SISTEMA: TurnoEstado[] = ["atendido"] as TurnoEstado[];
  // System-managed states present in DB enum but not always in TURNO_ESTADOS
  const SYSTEM_STATES = new Set<string>(["atendido", "en_atencion", "pendiente_cierre"]);
  const ESTADOS_MANUALES: TurnoEstado[] = TURNO_ESTADOS.filter((e) => !SYSTEM_STATES.has(e)) as TurnoEstado[];
  const isSystemManaged = editing ? SYSTEM_STATES.has(editing.estado) : false;

  useEffect(() => {
    document.title = "Turnos | Consultorio";
    Promise.all([
      supabase.from("profesionales").select("id, nombre, apellido, color_agenda").eq("activo", true).order("apellido"),
      supabase.from("horarios_profesional").select("*").eq("activo", true),
      supabase.from("pacientes").select("id, nombre, apellido, dni").eq("activo", true).order("apellido"),
    ])
      .then(([pr, ho, pa]) => {
        if (pr.error) console.error("Error cargando profesionales:", pr.error);
        if (ho.error) console.error("Error cargando horarios:", ho.error);
        if (pa.error) console.error("Error cargando pacientes:", pa.error);
        const profs = (pr.data ?? []) as Profesional[];
        setProfesionales(profs);
        setHorarios((ho.data ?? []) as Horario[]);
        setPacientes((pa.data ?? []) as Paciente[]);
        if (profs.length > 0) setProfSel(profs[0].id);
      })
      .catch((e) => {
        console.error("Error inesperado cargando datos de turnos:", e);
        toast.error("No se pudieron cargar los datos de la agenda");
      });
  }, []);

  useEffect(() => {
    cargarTurnos();
  }, [fecha, vista, profSel]);

  async function cargarTurnos() {
    try {
      const desde = vista === "dia" ? fecha : startOfWeek(fecha, { weekStartsOn: 1 });
      const hasta = vista === "dia" ? fecha : addDays(desde, 6);
      let q = supabase
        .from("turnos")
        .select("*, paciente:pacientes(nombre, apellido)")
        .gte("fecha", format(desde, "yyyy-MM-dd"))
        .lte("fecha", format(hasta, "yyyy-MM-dd"));
      if (profSel) q = q.eq("profesional_id", profSel);
      const { data, error } = await q;
      if (error) {
        console.error("Error cargando turnos:", error);
        return;
      }
      setTurnos((data ?? []) as unknown as Turno[]);
    } catch (e) {
      console.error("Error inesperado cargando turnos:", e);
    }
  }

  function abrirSlot(profesional_id: string, dia: Date, s: Slot) {
    if (!canEdit) return;
    setEditing(null);
    setSlot({
      profesional_id,
      fecha: format(dia, "yyyy-MM-dd"),
      hora_inicio: s.hora_inicio,
      hora_fin: s.hora_fin,
    });
    setPacienteId("");
    setMotivo("");
    setEstado("reservado");
    setEsSobreturno(false);
    setConfirmSobreturno(false);
    setPacienteSearch("");
    setOpen(true);
  }

  function abrirTurno(t: Turno) {
    setEditing(t);
    setSlot(null);
    setPacienteId(t.paciente_id);
    setMotivo(t.motivo_consulta ?? "");
    setEstado(t.estado);
    setEsSobreturno(!!t.es_sobreturno);
    setConfirmSobreturno(false);
    setPacienteSearch("");
    setEditProfId(t.profesional_id);
    setEditFecha(t.fecha);
    setEditHoraInicio(t.hora_inicio.slice(0, 5));
    setEditHoraFin(t.hora_fin.slice(0, 5));
    setOpen(true);
  }

  function onChangeHoraInicio(nuevaHora: string) {
    if (editing && editHoraInicio && editHoraFin) {
      // Mantener duración original del turno editado
      const [h1, m1] = editHoraInicio.split(":").map(Number);
      const [h2, m2] = editHoraFin.split(":").map(Number);
      const dur = h2 * 60 + m2 - (h1 * 60 + m1);
      const [nh, nm] = nuevaHora.split(":").map(Number);
      if (!isNaN(nh) && !isNaN(nm) && dur > 0) {
        const tot = nh * 60 + nm + dur;
        const fh = String(Math.floor(tot / 60) % 24).padStart(2, "0");
        const fm = String(tot % 60).padStart(2, "0");
        setEditHoraFin(`${fh}:${fm}`);
      }
    }
    setEditHoraInicio(nuevaHora);
  }

  async function guardar(forceSobreturno?: boolean) {
    if (saving) return;
    setSaving(true);
    const sobreturnoFlag = forceSobreturno ?? esSobreturno;
    try {
      if (editing) {
        if (isSystemManaged) {
          // Solo permitir cambios menores en estados gestionados
          const { error } = await supabase
            .from("turnos")
            .update({ motivo_consulta: motivo.trim() || editing.motivo_consulta || "" })
            .eq("id", editing.id);
          if (error) return toast.error("No se pudo actualizar", { description: error.message });
          toast.success("Turno actualizado");
          setOpen(false);
          cargarTurnos();
          return;
        }

        // Validaciones
        if (!pacienteId) return toast.error("Seleccioná un paciente");
        if (!editProfId) return toast.error("Seleccioná un profesional");
        if (!editFecha) return toast.error("La fecha es obligatoria");
        if (!editHoraInicio || !editHoraFin) return toast.error("Las horas son obligatorias");
        if (editHoraFin <= editHoraInicio) return toast.error("La hora de fin debe ser mayor a la de inicio");
        if (motivo.trim() === "") return toast.error("El motivo es obligatorio");

        // El chequeo de superposición ahora lo hace el trigger en DB.
        const { error } = await supabase
          .from("turnos")
          .update({
            paciente_id: pacienteId,
            profesional_id: editProfId,
            fecha: editFecha,
            hora_inicio: editHoraInicio,
            hora_fin: editHoraFin,
            motivo_consulta: motivo.trim(),
            estado,
            es_sobreturno: sobreturnoFlag,
          })
          .eq("id", editing.id);
        if (error) {
          if (
            error.code === "23505" ||
            error.message.toLowerCase().includes("sobreturno") ||
            error.message.toLowerCase().includes("ya existe un turno")
          ) {
            setConfirmSobreturno(true);
            return;
          }
          const msg = error.message.includes("atendido sin una atención")
            ? "Para marcar como atendido, registrá la atención desde el módulo Atenciones."
            : error.message;
          return toast.error("No se pudo actualizar", { description: msg });
        }
        toast.success("Turno actualizado");
      } else if (slot) {
        if (!pacienteId) return toast.error("Seleccioná un paciente");
        if (motivo.trim() === "") return toast.error("El motivo es obligatorio");
        const { error } = await supabase.from("turnos").insert({
          paciente_id: pacienteId,
          profesional_id: slot.profesional_id,
          fecha: slot.fecha,
          hora_inicio: slot.hora_inicio,
          hora_fin: slot.hora_fin,
          motivo_consulta: motivo.trim(),
          estado,
          es_sobreturno: esSobreturno,
        });
        if (error) {
          if (
            error.code === "23505" ||
            error.message.toLowerCase().includes("sobreturno") ||
            error.message.toLowerCase().includes("ya existe un turno")
          ) {
            setConfirmSobreturno(true);
            return;
          }
          return toast.error("No se pudo crear", { description: error.message });
        }
        toast.success(esSobreturno ? "Sobreturno creado" : "Turno creado");
      }
      setOpen(false);
      cargarTurnos();
    } finally {
      setSaving(false);
    }
  }

  async function confirmarComoSobreturno() {
    setEsSobreturno(true);
    setConfirmSobreturno(false);
    // pequeño delay para que setEsSobreturno tome efecto en el próximo guardar
    setTimeout(() => guardar(), 0);
  }

  async function cancelarTurno() {
    if (!editing) return;
    if (!confirm("¿Confirmar la cancelación de este turno?")) return;
    const { error } = await supabase.from("turnos").update({ estado: "cancelado" }).eq("id", editing.id);
    if (error) return toast.error("No se pudo cancelar", { description: error.message });
    toast.success("Turno cancelado");
    setOpen(false);
    cargarTurnos();
  }

  async function eliminar() {
    if (!editing) return;
    if (!confirm("¿Eliminar definitivamente este turno?")) return;
    const { error } = await supabase.from("turnos").delete().eq("id", editing.id);
    if (error) return toast.error("No se pudo eliminar", { description: error.message });
    toast.success("Turno eliminado");
    setOpen(false);
    cargarTurnos();
  }

  const dias = useMemo(() => {
    if (vista === "dia") return [fecha];
    const start = startOfWeek(fecha, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [fecha, vista]);

  const profActual = profesionales.find((p) => p.id === profSel);

  const pacientesFiltrados = pacientes.filter((p) => {
    if (!pacienteSearch) return true;
    const s = pacienteSearch.toLowerCase();
    return p.apellido.toLowerCase().includes(s) || p.nombre.toLowerCase().includes(s) || p.dni.includes(s);
  }).slice(0, 50);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Turnos</h1>
          <p className="text-sm text-muted-foreground">Calendario de atención</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={profSel} onValueChange={setProfSel}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Profesional" /></SelectTrigger>
            <SelectContent>
              {profesionales.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.apellido}, {p.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1 border rounded-md">
            <Button variant="ghost" size="icon" onClick={() => setFecha(addDays(fecha, vista === "dia" ? -1 : -7))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="date"
              value={safeFormat(fecha, "yyyy-MM-dd")}
              onChange={(e) => {
                if (!e.target.value) return;
                const d = safeParseISO(e.target.value);
                if (d) setFecha(d);
              }}
              className="w-[150px] border-0 focus-visible:ring-0"
            />
            <Button variant="ghost" size="icon" onClick={() => setFecha(addDays(fecha, vista === "dia" ? 1 : 7))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setFecha(new Date())}>Hoy</Button>
        </div>
      </div>

      <Tabs value={vista} onValueChange={(v) => setVista(v as "dia" | "semana")}>
        <TabsList>
          <TabsTrigger value="dia">Día</TabsTrigger>
          <TabsTrigger value="semana">Semana</TabsTrigger>
        </TabsList>

        <TabsContent value="dia">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {safeFormat(fecha, "EEEE d 'de' MMMM yyyy", { locale: es })}
                {profActual && <span className="text-muted-foreground font-normal"> · {profActual.apellido}, {profActual.nombre}</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CalendarGrid
                dias={[fecha]}
                profesional={profActual}
                horarios={horarios.filter((h) => h.profesional_id === profSel)}
                turnos={turnos}
                onSlot={(d, s) => profSel && abrirSlot(profSel, d, s)}
                onTurno={abrirTurno}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="semana">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Semana del {safeFormat(dias[0], "d MMM", { locale: es })} al {safeFormat(dias[6], "d MMM yyyy", { locale: es })}
                {profActual && <span className="text-muted-foreground font-normal"> · {profActual.apellido}, {profActual.nombre}</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CalendarGrid
                dias={dias}
                profesional={profActual}
                horarios={horarios.filter((h) => h.profesional_id === profSel)}
                turnos={turnos}
                onSlot={(d, s) => profSel && abrirSlot(profSel, d, s)}
                onTurno={abrirTurno}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar turno" : "Nuevo turno"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
            {slot && (
              <p className="text-sm text-muted-foreground">
                {safeFormat(safeParseISO(slot.fecha), "EEEE d 'de' MMMM", { locale: es })} · {slot.hora_inicio} - {slot.hora_fin}
              </p>
            )}

            {/* NUEVO TURNO: paciente */}
            {!editing && (
              <div className="space-y-2">
                <Label>Paciente</Label>
                <Input
                  placeholder="Buscar por nombre, apellido o DNI..."
                  value={pacienteSearch}
                  onChange={(e) => setPacienteSearch(e.target.value)}
                />
                <Select value={pacienteId} onValueChange={setPacienteId}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar paciente" /></SelectTrigger>
                  <SelectContent>
                    {pacientesFiltrados.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.apellido}, {p.nombre} · {p.dni}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* EDITAR TURNO */}
            {editing && isSystemManaged && (
              <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                Este turno está en un estado gestionado por el sistema ({TURNO_ESTADO_LABELS[editing.estado as TurnoEstado] ?? editing.estado}).
                Solo se puede editar el motivo.
              </div>
            )}

            {editing && !isSystemManaged && (
              <>
                <div className="space-y-2">
                  <Label>Paciente</Label>
                  <Input
                    placeholder="Buscar por nombre, apellido o DNI..."
                    value={pacienteSearch}
                    onChange={(e) => setPacienteSearch(e.target.value)}
                  />
                  <Select value={pacienteId} onValueChange={setPacienteId}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar paciente" /></SelectTrigger>
                    <SelectContent>
                      {pacientesFiltrados.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.apellido}, {p.nombre} · {p.dni}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Profesional</Label>
                  <Select value={editProfId} onValueChange={setEditProfId}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar profesional" /></SelectTrigger>
                    <SelectContent>
                      {profesionales.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.apellido}, {p.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-2">
                    <Label>Fecha</Label>
                    <Input type="date" value={editFecha} onChange={(e) => setEditFecha(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Hora inicio</Label>
                    <Input type="time" value={editHoraInicio} onChange={(e) => onChangeHoraInicio(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Hora fin</Label>
                    <Input type="time" value={editHoraFin} onChange={(e) => setEditHoraFin(e.target.value)} />
                  </div>
                </div>
              </>
            )}

            {editing && isSystemManaged && (
              <div className="space-y-1">
                <Label>Paciente</Label>
                <p className="text-sm font-medium">
                  {editing.paciente ? `${editing.paciente.apellido}, ${editing.paciente.nombre}` : "—"}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Motivo de consulta</Label>
              <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} />
            </div>

            <div className="space-y-2">
              <Label>Estado</Label>
              {editing && isSystemManaged ? (
                <>
                  <Input value={TURNO_ESTADO_LABELS[editing.estado as TurnoEstado] ?? editing.estado} disabled />
                  <p className="text-xs text-muted-foreground">Estado gestionado por el sistema</p>
                </>
              ) : (
                <Select value={estado} onValueChange={(v) => setEstado(v as TurnoEstado)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(editing ? ESTADOS_MANUALES : TURNO_ESTADOS).map((e) => (
                      <SelectItem key={e} value={e}>{TURNO_ESTADO_LABELS[e]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Sobreturno */}
            {!isSystemManaged && (
              <div className="flex items-start gap-2 rounded-md border border-dashed p-3 bg-muted/30">
                <Checkbox
                  id="es-sobreturno"
                  checked={esSobreturno}
                  onCheckedChange={(v) => setEsSobreturno(v === true)}
                  className="mt-0.5"
                />
                <div className="space-y-1">
                  <Label htmlFor="es-sobreturno" className="cursor-pointer flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--estado-sobreturno))]" />
                    Marcar como sobreturno
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Permite registrar este turno aunque ya exista otro en el mismo horario.
                  </p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <div className="flex gap-2">
              {editing && canEdit && (
                <Button type="button" variant="destructive" onClick={eliminar}>Eliminar</Button>
              )}
              {editing && canEdit && !isSystemManaged && estado !== "cancelado" && (
                <Button type="button" variant="outline" onClick={cancelarTurno}>Cancelar turno</Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cerrar</Button>
              {canEdit && <Button onClick={guardar} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmSobreturno} onOpenChange={setConfirmSobreturno}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-[hsl(var(--estado-sobreturno))]" />
              Ya existe un turno en este horario
            </AlertDialogTitle>
            <AlertDialogDescription>
              El profesional ya tiene un turno asignado en este horario. ¿Desea registrar este como <strong>sobreturno</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarComoSobreturno}>
              Crear como sobreturno
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CalendarGrid({
  dias, profesional, horarios, turnos, onSlot, onTurno,
}: {
  dias: Date[];
  profesional?: Profesional;
  horarios: Horario[];
  turnos: Turno[];
  onSlot: (dia: Date, slot: Slot) => void;
  onTurno: (t: Turno) => void;
}) {
  if (!profesional) {
    return <p className="text-sm text-muted-foreground">Seleccioná un profesional para ver la agenda.</p>;
  }

  // Generar todos los slots únicos del rango
  const slotsByDay = dias.map((d) => ({
    dia: d,
    slots: generarSlots(horarios, d.getDay()),
  }));

  const totalSlots = slotsByDay.reduce((acc, s) => acc + s.slots.length, 0);
  if (totalSlots === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        El profesional no tiene horarios configurados para este día.
      </p>
    );
  }

  return (
    <div className="overflow-auto">
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `auto repeat(${dias.length}, minmax(140px, 1fr))` }}
      >
        <div />
        {dias.map((d) => (
          <div key={d.toISOString()} className="text-center text-xs font-medium text-muted-foreground pb-2">
            {safeFormat(d, "EEE d", { locale: es })}
          </div>
        ))}

        {/* Renderizar todos los slots posibles del día con más slots, alineando por hora */}
        {(() => {
          const allHoras = Array.from(new Set(slotsByDay.flatMap((s) => s.slots.map((sl) => sl.hora_inicio)))).sort();
          return allHoras.map((hora) => (
            <div key={hora} className="contents">
              <div className="text-xs text-muted-foreground pr-2 py-1 text-right">{hora}</div>
              {dias.map((d) => {
                const slot = slotsByDay.find((s) => isSameDay(s.dia, d))?.slots.find((sl) => sl.hora_inicio === hora);
                if (!slot) return <div key={d.toISOString()} className="bg-muted/30 rounded" />;
                const fechaStr = format(d, "yyyy-MM-dd");
                // Todos los turnos cuyo hora_inicio cae dentro de este slot (normales + sobreturnos)
                const turnosSlot = turnos
                  .filter((t) =>
                    t.profesional_id === profesional.id &&
                    t.fecha === fechaStr &&
                    t.hora_inicio.startsWith(slot.hora_inicio),
                  )
                  .sort((a, b) => Number(a.es_sobreturno) - Number(b.es_sobreturno));

                if (turnosSlot.length > 0) {
                  return (
                    <div key={d.toISOString()} className="flex flex-col gap-1 min-h-[44px]">
                      {turnosSlot.map((turno) => (
                        <button
                          key={turno.id}
                          onClick={() => onTurno(turno)}
                          className="text-left p-2 rounded border-l-4 hover:opacity-90 transition text-xs"
                          style={
                            turno.es_sobreturno
                              ? {
                                  backgroundColor: "hsl(var(--estado-sobreturno) / 0.15)",
                                  borderLeftColor: "hsl(var(--estado-sobreturno))",
                                }
                              : {
                                  backgroundColor: `${profesional.color_agenda}22`,
                                  borderLeftColor: profesional.color_agenda,
                                }
                          }
                        >
                          <div className="font-medium truncate flex items-center gap-1">
                            {turno.es_sobreturno && (
                              <AlertTriangle className="h-3 w-3 text-[hsl(var(--estado-sobreturno))] shrink-0" />
                            )}
                            <span className="truncate">
                              {turno.paciente ? `${turno.paciente.apellido}, ${turno.paciente.nombre}` : "—"}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            <Badge className={`${TURNO_ESTADO_CLASSES[turno.estado]} text-[10px] px-1 py-0`}>
                              {TURNO_ESTADO_LABELS[turno.estado]}
                            </Badge>
                            {turno.es_sobreturno && (
                              <Badge
                                className="text-[10px] px-1 py-0 text-white"
                                style={{ backgroundColor: "hsl(var(--estado-sobreturno))" }}
                              >
                                Sobreturno
                              </Badge>
                            )}
                          </div>
                        </button>
                      ))}
                      <button
                        onClick={() => onSlot(d, slot)}
                        className="rounded border border-dashed border-border/60 hover:border-[hsl(var(--estado-sobreturno))] hover:bg-[hsl(var(--estado-sobreturno)/0.08)] transition py-1 text-[10px] text-muted-foreground"
                        title="Agregar sobreturno en este horario"
                      >
                        + Sobreturno
                      </button>
                    </div>
                  );
                }
                return (
                  <button
                    key={d.toISOString()}
                    onClick={() => onSlot(d, slot)}
                    className="rounded border border-dashed border-border hover:border-primary hover:bg-accent/40 transition min-h-[44px] text-xs text-muted-foreground"
                  >
                    Libre
                  </button>
                );
              })}
            </div>
          ));
        })()}
      </div>
    </div>
  );
}
