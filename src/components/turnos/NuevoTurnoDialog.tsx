import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { Check, ChevronsUpDown, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [pacientePopoverOpen, setPacientePopoverOpen] = useState(false);
  const [slot, setSlot] = useState("");
  const [motivo, setMotivo] = useState("");
  const [sobreturno, setSobreturno] = useState(false);
  const [horaManual, setHoraManual] = useState("");
  const [duracionManual, setDuracionManual] = useState(30);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPacienteId("");
    setPacientePopoverOpen(false);
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
      .limit(2000)
      .then(({ data }) => setPacientes((data ?? []) as PacienteOpt[]));
  }, [open]);

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

  const pacienteSeleccionado = useMemo(
    () => pacientes.find((p) => p.id === pacienteId) ?? null,
    [pacientes, pacienteId],
  );

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

  if (!open) return null;

  return (
    // Overlay propio — reemplaza Dialog de shadcn para tener control total del layout
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onOpenChange(false); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg mx-4 bg-background rounded-lg shadow-xl border flex flex-col"
        style={{ maxHeight: "90vh" }}
      >
        {/* Header — fijo */}
        <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b shrink-0">
          <div>
            <h2 className="text-base font-semibold leading-tight">Agendar turno</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {profesionalNombre} · {format(fecha, "EEEE d 'de' MMMM yyyy", { locale: es })}
            </p>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:text-foreground transition-colors ml-4 mt-0.5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Contenido — scrolleable */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">

          {/* Paciente */}
          <div className="space-y-1">
            <Label className="text-xs font-medium">Paciente</Label>
            <Popover open={pacientePopoverOpen} onOpenChange={setPacientePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={pacientePopoverOpen}
                  className="w-full justify-between font-normal h-8 text-xs"
                >
                  <span className={cn("truncate", !pacienteSeleccionado && "text-muted-foreground")}>
                    {pacienteSeleccionado
                      ? `${pacienteSeleccionado.apellido}, ${pacienteSeleccionado.nombre} — ${pacienteSeleccionado.dni}`
                      : "Buscar paciente por nombre, apellido o DNI..."}
                  </span>
                  <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command
                  filter={(value, search) => {
                    if (!search) return 1;
                    return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
                  }}
                >
                  <CommandInput placeholder="Escribí nombre, apellido o DNI..." />
                  <CommandList>
                    <CommandEmpty>Sin resultados.</CommandEmpty>
                    <CommandGroup>
                      {pacientes.map((p) => {
                        const label = `${p.apellido}, ${p.nombre} — ${p.dni}`;
                        return (
                          <CommandItem
                            key={p.id}
                            value={`${p.apellido} ${p.nombre} ${p.dni}`}
                            onSelect={() => {
                              setPacienteId(p.id);
                              setPacientePopoverOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                pacienteId === p.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            {label}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Sobreturno */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="sobreturno"
              checked={sobreturno}
              onCheckedChange={(v) => setSobreturno(!!v)}
            />
            <Label htmlFor="sobreturno" className="cursor-pointer text-xs">
              Sobreturno (fuera de los slots disponibles)
            </Label>
          </div>

          {/* Slots o sobreturno manual */}
          {!sobreturno ? (
            <div className="space-y-1">
              <Label className="text-xs font-medium">Horario disponible</Label>
              {slotsLibres.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No hay slots libres este día. Marcá "Sobreturno" para agendar fuera de horario.
                </p>
              ) : (
                <div className="max-h-28 overflow-y-auto rounded-md border p-1.5">
                  <div className="grid grid-cols-4 gap-1">
                    {slotsLibres.map((s) => {
                      const selected = slot === s.key;
                      return (
                        <Button
                          key={s.key}
                          type="button"
                          variant={selected ? "default" : "outline"}
                          size="sm"
                          className={cn(
                            "h-7 px-1 text-xs font-medium transition-all",
                            selected && "ring-2 ring-primary ring-offset-1 shadow-sm",
                          )}
                          onClick={() => setSlot(s.key)}
                        >
                          {s.inicio}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Hora inicio</Label>
                <Input
                  type="time"
                  className="h-8 text-xs"
                  value={horaManual}
                  onChange={(e) => setHoraManual(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Duración (min)</Label>
                <Input
                  type="number"
                  min={5}
                  step={5}
                  className="h-8 text-xs"
                  value={duracionManual}
                  onChange={(e) => setDuracionManual(parseInt(e.target.value) || 30)}
                />
              </div>
            </div>
          )}

                    {/* Motivo */}
          <div className="space-y-1">
            <Label className="text-xs font-medium">Motivo de consulta</Label>
            <textarea
              style={{ height: "56px", minHeight: "56px", maxHeight: "56px", resize: "none" }}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Consulta odontológica, control, etc."
              maxLength={500}
            />
          </div>
        </div>

        {/* Footer — fijo */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t shrink-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button size="sm" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando..." : "Agendar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
