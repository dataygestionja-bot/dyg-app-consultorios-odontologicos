import { useEffect, useMemo, useState } from "react";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { es } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Profesional { id: string; nombre: string; apellido: string; }
interface Slot { hora_inicio: string; hora_fin: string; }

interface Props {
  turno: {
    id: string;
    profesional_id: string;
    fecha: string;
    hora_inicio: string;
    paciente_nombre: string;
    paciente_telefono: string | null;
    profesional_nombre: string;
  };
  onClose: () => void;
  onDone: () => void;
}

function addMinutes(hhmm: string, mins: number): string {
  const [h, m] = hhmm.slice(0, 5).split(":").map(Number);
  const total = h * 60 + m + mins;
  const hh = Math.floor(total / 60).toString().padStart(2, "0");
  const mm = (total % 60).toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

export function ReprogramarDialog({ turno, onClose, onDone }: Props) {
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [profId, setProfId] = useState(turno.profesional_id);
  const [fecha, setFecha] = useState<Date | undefined>(undefined);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profesionales")
        .select("id, nombre, apellido")
        .eq("activo", true)
        .order("apellido");
      setProfesionales(data ?? []);
    })();
  }, []);

  useEffect(() => {
    if (!profId || !fecha) { setSlots([]); return; }
    let activo = true;
    (async () => {
      setLoadingSlots(true); setSlot(null);
      try {
        const fechaStr = format(fecha, "yyyy-MM-dd");
        const diaSemana = fecha.getDay();

        const [horReq, turReq, bloReq] = await Promise.all([
          supabase.from("horarios_profesional")
            .select("hora_inicio, hora_fin, duracion_slot_min")
            .eq("profesional_id", profId).eq("dia_semana", diaSemana).eq("activo", true),
          supabase.from("turnos")
            .select("hora_inicio, hora_fin, estado, es_sobreturno, id")
            .eq("profesional_id", profId).eq("fecha", fechaStr)
            .in("estado", ["reservado","confirmado","en_atencion","atendido","pendiente_cierre","solicitado"]),
          supabase.from("bloqueos_agenda")
            .select("todo_el_dia, hora_desde, hora_hasta")
            .eq("profesional_id", profId).eq("estado", "activo")
            .lte("fecha_desde", fechaStr).gte("fecha_hasta", fechaStr),
        ]);

        const base: Slot[] = [];
        for (const h of horReq.data ?? []) {
          const dur = h.duracion_slot_min ?? 30;
          let cursor = h.hora_inicio.slice(0, 5);
          const fin = h.hora_fin.slice(0, 5);
          while (cursor < fin) {
            const next = addMinutes(cursor, dur);
            if (next > fin) break;
            base.push({ hora_inicio: cursor, hora_fin: next });
            cursor = next;
          }
        }

        const turnos = turReq.data ?? [];
        const bloqueos = bloReq.data ?? [];

        const libres = base.filter((s) => {
          const ocupado = turnos.some(
            (t) =>
              t.id !== turno.id &&
              !t.es_sobreturno &&
              t.hora_inicio.slice(0, 5) < s.hora_fin &&
              t.hora_fin.slice(0, 5) > s.hora_inicio,
          );
          if (ocupado) return false;
          const enBloqueo = bloqueos.some((b) => {
            if (b.todo_el_dia) return true;
            if (!b.hora_desde || !b.hora_hasta) return false;
            return s.hora_inicio < b.hora_hasta.slice(0, 5) && s.hora_fin > b.hora_desde.slice(0, 5);
          });
          return !enBloqueo;
        });

        if (activo) setSlots(libres);
      } finally {
        if (activo) setLoadingSlots(false);
      }
    })();
    return () => { activo = false; };
  }, [profId, fecha, turno.id]);

  async function handleGuardar() {
    if (!fecha || !slot) {
      toast.error("Elegí fecha y horario");
      return;
    }
    setSaving(true);
    try {
      const fechaStr = format(fecha, "yyyy-MM-dd");
      const { error } = await supabase
        .from("turnos")
        .update({
          profesional_id: profId,
          fecha: fechaStr,
          hora_inicio: slot.hora_inicio,
          hora_fin: slot.hora_fin,
          estado: "confirmado",
        })
        .eq("id", turno.id);
      if (error) throw error;

      // WhatsApp confirmación con nueva fecha
      const profNombre = profesionales.find((p) => p.id === profId);
      const profLabel = profNombre
        ? `${profNombre.nombre} ${profNombre.apellido}`.trim()
        : turno.profesional_nombre;
      const fechaLeg = format(fecha, "dd/MM/yyyy", { locale: es });
      const mensaje =
        `Hola ${turno.paciente_nombre}, tu turno fue confirmado con ${profLabel} ` +
        `el día ${fechaLeg} a las ${slot.hora_inicio.slice(0,5)}. Te esperamos.`;

      let resultadoTag = "enviado_reprogramacion";
      if (turno.paciente_telefono) {
        const { data, error: wpErr } = await supabase.functions.invoke("send_whatsapp", {
          body: { telefono: turno.paciente_telefono, mensaje },
        });
        if (wpErr || (data && data.success === false)) {
          resultadoTag = "error_enviado_reprogramacion";
        }
        await supabase.from("whatsapp_respuestas").insert({
          telefono: turno.paciente_telefono,
          mensaje,
          turno_id: turno.id,
          accion_detectada: null,
          resultado: resultadoTag,
        });
      }

      toast.success("Turno reprogramado y confirmado");
      onDone();
    } catch (e) {
      toast.error("No se pudo reprogramar", {
        description: e instanceof Error ? e.message : "Error desconocido",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reprogramar turno</DialogTitle>
          <DialogDescription>
            Elegí nueva fecha y horario. El turno quedará confirmado y se notificará al paciente por WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label>Profesional</Label>
            <Select value={profId} onValueChange={setProfId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {profesionales.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre} {p.apellido}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Fecha</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !fecha && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {fecha ? format(fecha, "PPP", { locale: es }) : "Elegí una fecha"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={fecha}
                  onSelect={(d) => setFecha(d ?? undefined)}
                  disabled={(date) => {
                    const hoy = new Date(); hoy.setHours(0,0,0,0);
                    return date < hoy;
                  }}
                  locale={es}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {fecha && (
            <div className="grid gap-2">
              <Label>Horario disponible</Label>
              {loadingSlots ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                  <Loader2 className="h-4 w-4 animate-spin" /> Buscando horarios...
                </div>
              ) : slots.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  No hay horarios disponibles ese día.
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                  {slots.map((s) => {
                    const sel = slot?.hora_inicio === s.hora_inicio;
                    return (
                      <Button
                        key={`${s.hora_inicio}-${s.hora_fin}`}
                        type="button"
                        variant={sel ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSlot(s)}
                      >
                        {s.hora_inicio.slice(0,5)}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleGuardar} disabled={saving || !slot}>
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : "Confirmar reprogramación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
