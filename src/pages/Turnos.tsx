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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
  const [pacienteSearch, setPacienteSearch] = useState("");

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
    setPacienteSearch("");
    setOpen(true);
  }

  function abrirTurno(t: Turno) {
    setEditing(t);
    setSlot(null);
    setPacienteId(t.paciente_id);
    setMotivo(t.motivo_consulta ?? "");
    setEstado(t.estado);
    setPacienteSearch("");
    setOpen(true);
  }

  async function guardar() {
    if (editing) {
      const { error } = await supabase
        .from("turnos")
        .update({ motivo_consulta: motivo || null, estado })
        .eq("id", editing.id);
      if (error) return toast.error("No se pudo actualizar", { description: error.message });
      toast.success("Turno actualizado");
    } else if (slot) {
      if (!pacienteId) return toast.error("Seleccioná un paciente");
      const { error } = await supabase.from("turnos").insert({
        paciente_id: pacienteId,
        profesional_id: slot.profesional_id,
        fecha: slot.fecha,
        hora_inicio: slot.hora_inicio,
        hora_fin: slot.hora_fin,
        motivo_consulta: motivo || null,
        estado,
      });
      if (error) {
        const msg = error.message.includes("turnos_no_overlap")
          ? "Ese horario ya tiene un turno para el profesional"
          : error.message;
        return toast.error("No se pudo crear", { description: msg });
      }
      toast.success("Turno creado");
    }
    setOpen(false);
    cargarTurnos();
  }

  async function eliminar() {
    if (!editing) return;
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
          <div className="space-y-4 py-2">
            {slot && (
              <p className="text-sm text-muted-foreground">
                {safeFormat(safeParseISO(slot.fecha), "EEEE d 'de' MMMM", { locale: es })} · {slot.hora_inicio} - {slot.hora_fin}
              </p>
            )}
            {editing && (
              <p className="text-sm text-muted-foreground">
                {safeFormat(safeParseISO(editing.fecha), "EEEE d 'de' MMMM", { locale: es })} · {editing.hora_inicio.slice(0, 5)} - {editing.hora_fin.slice(0, 5)}
              </p>
            )}

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

            {editing && (
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
              <Select value={estado} onValueChange={(v) => setEstado(v as TurnoEstado)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TURNO_ESTADOS.map((e) => (
                    <SelectItem key={e} value={e}>{TURNO_ESTADO_LABELS[e]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex justify-between sm:justify-between">
            {editing && canEdit ? (
              <Button type="button" variant="destructive" onClick={eliminar}>Eliminar</Button>
            ) : <div />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              {canEdit && <Button onClick={guardar}>Guardar</Button>}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
                const turno = turnos.find((t) =>
                  t.profesional_id === profesional.id &&
                  t.fecha === format(d, "yyyy-MM-dd") &&
                  t.hora_inicio.startsWith(slot.hora_inicio)
                );
                if (turno) {
                  return (
                    <button
                      key={d.toISOString()}
                      onClick={() => onTurno(turno)}
                      className="text-left p-2 rounded border-l-4 hover:opacity-90 transition text-xs min-h-[44px]"
                      style={{
                        backgroundColor: `${profesional.color_agenda}22`,
                        borderLeftColor: profesional.color_agenda,
                      }}
                    >
                      <div className="font-medium truncate">
                        {turno.paciente ? `${turno.paciente.apellido}, ${turno.paciente.nombre}` : "—"}
                      </div>
                      <Badge className={`${TURNO_ESTADO_CLASSES[turno.estado]} text-[10px] px-1 py-0 mt-1`}>
                        {TURNO_ESTADO_LABELS[turno.estado]}
                      </Badge>
                    </button>
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
