import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { Check, ChevronsUpDown } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface PacienteOpt {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
}

interface HorarioDia {
  hora_inicio: string;
  hora_fin: string;
  duracion_slot_min: number;
}

interface TurnoOcupado {
  hora_inicio: string;
  hora_fin: string;
  estado: string;
}

interface BloqueoParcial {
  hora_desde: string | null;
  hora_hasta: string | null;
  todo_el_dia: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profesionalId: string;
  profesionalNombre: string;
  fecha: Date;
  horariosDia: HorarioDia[];
  turnosOcupados: TurnoOcupado[];
  bloqueosDia: BloqueoParcial[];
  onSaved?: () => void;
}

const ESTADOS_OCUPAN = new Set([
  "reservado",
  "confirmado",
  "en_atencion",
  "pendiente_cierre",
  "atendido",
]);

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}
function fromMin(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default function NuevoTurnoDialog({
  open,
  onOpenChange,
  profesionalId,
  profesionalNombre,
  fecha,
  horariosDia,
  turnosOcupados,
  bloqueosDia,
  onSaved,
}: Props) {
  const [pacientes, setPacientes] = useState<PacienteOpt[]>([]);
  const [pacienteId, setPacienteId] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [slot, setSlot] = useState("");
  const [motivo, setMotivo] = useState("");
  const [sobreturno, setSobreturno] = useState(false);
  const [horaManual, setHoraManual] = useState("");
  const [duracionManual, setDuracionManual] = useState(30);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPacienteId("");
    setBusqueda("");
    setSlot("");
    setMotivo("");
    setSobreturno(false);
    setHoraManual("");
    setDuracionManual(30);
    supabase
      .from("pacientes")
      .select("id,nombre,apellido,dni")
      .eq("activo", true)
      .order("apellido")
      .limit(500)
      .then(({ data }) => setPacientes((data ?? []) as PacienteOpt[]));
  }, [open]);

  // Generar slots libres del día
  const slotsLibres = useMemo(() => {
    const slots: { inicio: string; fin: string; key: string }[] = [];
    const ocupados = turnosOcupados
      .filter((t) => ESTADOS_OCUPAN.has(t.estado))
      .map((t) => ({ from: toMin(t.hora_inicio.slice(0, 5)), to: toMin(t.hora_fin.slice(0, 5)) }));
    const bloqs = bloqueosDia
      .filter((b) => !b.todo_el_dia && b.hora_desde && b.hora_hasta)
      .map((b) => ({
        from: toMin(b.hora_desde!.slice(0, 5)),
        to: toMin(b.hora_hasta!.slice(0, 5)),
      }));

    for (const h of horariosDia) {
      const start = toMin(h.hora_inicio.slice(0, 5));
      const end = toMin(h.hora_fin.slice(0, 5));
      const dur = h.duracion_slot_min || 30;
      for (let t = start; t + dur <= end; t += dur) {
        const tEnd = t + dur;
        const overlapTurno = ocupados.some((o) => t < o.to && tEnd > o.from);
        const overlapBloqueo = bloqs.some((b) => t < b.to && tEnd > b.from);
        if (overlapTurno || overlapBloqueo) continue;
        const inicio = fromMin(t);
        const fin = fromMin(tEnd);
        slots.push({ inicio, fin, key: `${inicio}-${fin}` });
      }
    }
    return slots;
  }, [horariosDia, turnosOcupados, bloqueosDia]);

  const pacientesFiltrados = useMemo(() => {
    if (!busqueda) return pacientes.slice(0, 50);
    const s = busqueda.toLowerCase();
    return pacientes
      .filter(
        (p) =>
          p.apellido.toLowerCase().includes(s) ||
          p.nombre.toLowerCase().includes(s) ||
          p.dni.toLowerCase().includes(s),
      )
      .slice(0, 50);
  }, [pacientes, busqueda]);

  async function guardar() {
    if (!pacienteId) return toast.error("Seleccioná un paciente");
    if (!motivo.trim()) return toast.error("Ingresá el motivo de consulta");

    let hora_inicio: string;
    let hora_fin: string;

    if (sobreturno) {
      if (!horaManual) return toast.error("Indicá la hora del sobreturno");
      const start = toMin(horaManual);
      const end = start + (duracionManual || 30);
      hora_inicio = `${horaManual}:00`;
      hora_fin = `${fromMin(end)}:00`;
    } else {
      if (!slot) return toast.error("Elegí un horario disponible");
      const [hi, hf] = slot.split("-");
      hora_inicio = `${hi}:00`;
      hora_fin = `${hf}:00`;
    }

    setGuardando(true);
    const userRes = await supabase.auth.getUser();
    const { error } = await supabase.from("turnos").insert({
      profesional_id: profesionalId,
      paciente_id: pacienteId,
      fecha: format(fecha, "yyyy-MM-dd"),
      hora_inicio,
      hora_fin,
      motivo_consulta: motivo.trim(),
      estado: "confirmado",
      es_sobreturno: sobreturno,
      origen: "interno",
      created_by: userRes.data.user?.id ?? null,
    });
    setGuardando(false);

    if (error) {
      toast.error("No se pudo crear el turno", { description: error.message });
      return;
    }
    toast.success("Turno agendado");
    onOpenChange(false);
    onSaved?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Agendar turno</DialogTitle>
          <DialogDescription>
            {profesionalNombre} · {format(fecha, "EEEE d 'de' MMMM yyyy", { locale: es })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Paciente</Label>
            <Input
              placeholder="Buscar por nombre, apellido o DNI..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            <Select value={pacienteId} onValueChange={setPacienteId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar paciente..." />
              </SelectTrigger>
              <SelectContent>
                {pacientesFiltrados.length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    Sin resultados
                  </div>
                ) : (
                  pacientesFiltrados.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.apellido}, {p.nombre} — {p.dni}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="sobreturno"
              checked={sobreturno}
              onCheckedChange={(v) => setSobreturno(!!v)}
            />
            <Label htmlFor="sobreturno" className="cursor-pointer">
              Sobreturno (fuera de los slots disponibles)
            </Label>
          </div>

          {!sobreturno ? (
            <div className="space-y-2">
              <Label>Horario disponible</Label>
              {slotsLibres.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay slots libres este día. Marcá "Sobreturno" para agendar fuera de horario.
                </p>
              ) : (
                <Select value={slot} onValueChange={setSlot}>
                  <SelectTrigger>
                    <SelectValue placeholder="Elegí un horario..." />
                  </SelectTrigger>
                  <SelectContent>
                    {slotsLibres.map((s) => (
                      <SelectItem key={s.key} value={s.key}>
                        {s.inicio} - {s.fin}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Hora inicio</Label>
                <Input
                  type="time"
                  value={horaManual}
                  onChange={(e) => setHoraManual(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Duración (min)</Label>
                <Input
                  type="number"
                  min={5}
                  step={5}
                  value={duracionManual}
                  onChange={(e) => setDuracionManual(parseInt(e.target.value) || 30)}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Motivo de consulta</Label>
            <Textarea
              rows={2}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Consulta odontológica, control, etc."
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando..." : "Agendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
