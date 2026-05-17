import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import {
  DIENTE_ESTADOS,
  DIENTE_ESTADO_LABELS,
  DIENTE_ESTADO_CLASSES,
  DIENTE_ESTADO_DOT,
  DIENTE_ESTADOS_SELECCIONABLES,
  type DienteEstado,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import OdontogramaAnatomico from "./OdontogramaAnatomico";
import PiezaDentalDialog from "./odontograma/PiezaDentalDialog";
import { internoToFdi } from "@/lib/odontograma";

interface Profesional {
  id: string;
  nombre: string;
  apellido: string;
  user_id: string | null;
}

interface Registro {
  id: string;
  paciente_id: string;
  diente: number;
  estado: DienteEstado;
  fecha: string;
  profesional_id: string;
  observaciones: string | null;
  profesionales?: { nombre: string; apellido: string } | null;
}

const TODOS_DIENTES = Array.from({ length: 32 }, (_, i) => i + 1);

export default function Odontograma({
  pacienteId,
  mode = "full",
  profesionalId,
  fechaAtencion,
}: {
  pacienteId: string;
  mode?: "full" | "inline";
  profesionalId?: string;
  fechaAtencion?: string;
}) {
  const { user } = useAuth();
  const { can } = usePermissions();
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [dienteFiltro, setDienteFiltro] = useState<string>("todos");
  const [piezaSeleccionada, setPiezaSeleccionada] = useState<number | null>(null);

  async function cargar() {
    setLoading(true);
    const [regsRes, profsRes] = await Promise.all([
      supabase
        .from("odontograma_registros")
        .select("*, profesionales(nombre, apellido)")
        .eq("paciente_id", pacienteId)
        .order("fecha", { ascending: false }),
      supabase
        .from("profesionales")
        .select("id, nombre, apellido, user_id")
        .eq("activo", true)
        .order("apellido"),
    ]);
    if (regsRes.error) toast.error("No se pudo cargar el odontograma", { description: regsRes.error.message });
    setRegistros((regsRes.data ?? []) as Registro[]);
    setProfesionales(profsRes.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (pacienteId) cargar();
  }, [pacienteId]);

  // Estado actual por diente = último registro
  const estadoActualPorDiente = useMemo(() => {
    const map = new Map<number, Registro>();
    // registros ya vienen ordenados desc por fecha
    for (const r of registros) {
      if (!map.has(r.diente)) map.set(r.diente, r);
    }
    return map;
  }, [registros]);

  const historialFiltrado = useMemo(() => {
    if (dienteFiltro === "todos") return registros;
    const d = parseInt(dienteFiltro, 10);
    return registros.filter((r) => r.diente === d);
  }, [registros, dienteFiltro]);

  const puedeAgregar = can("odontograma", "create");

  async function registrarEstadoInline(diente: number, estado: DienteEstado) {
    if (!profesionalId) {
      toast.error("Falta el profesional", { description: "Seleccioná un profesional antes de registrar." });
      return;
    }
    if (!puedeAgregar) {
      toast.error("Sin permiso para registrar en el odontograma");
      return;
    }
    const fechaIso = fechaAtencion
      ? new Date(`${fechaAtencion}T${format(new Date(), "HH:mm:ss")}`).toISOString()
      : new Date().toISOString();
    const { error } = await supabase.from("odontograma_registros").insert({
      paciente_id: pacienteId,
      diente,
      estado,
      fecha: fechaIso,
      profesional_id: profesionalId,
      observaciones: null,
    });
    if (error) {
      toast.error("No se pudo registrar", { description: error.message });
      return;
    }
    toast.success(`Pieza ${diente}: ${DIENTE_ESTADO_LABELS[estado]}`);
    cargar();
  }

  return (
    <div className="space-y-4">
      {/* Encabezado + botón */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Odontograma</h3>
          <p className="text-sm text-muted-foreground">
            Historial odontológico por pieza dental
          </p>
        </div>
        {puedeAgregar && mode === "full" && (
          <Button type="button" onClick={() => setOpenDialog(true)}>
            <Plus className="h-4 w-4" />
            Agregar registro
          </Button>
        )}
      </div>

      {/* Leyenda */}
      <Card>
        <CardContent className="flex flex-wrap gap-3 py-4">
          {DIENTE_ESTADOS.map((e) => (
            <div key={e} className="flex items-center gap-2 text-sm">
              <span className={`inline-block h-3 w-3 rounded-sm ${DIENTE_ESTADO_DOT[e]}`} />
              <span>{DIENTE_ESTADO_LABELS[e]}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Resumen por diente */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumen por diente</CardTitle>
          <CardDescription>Estado actual (último registro) de las piezas 1 a 32</CardDescription>
        </CardHeader>
        <CardContent>
          {mode === "inline" && (
            <p className="mb-3 text-xs text-muted-foreground">
              {profesionalId
                ? "Hacé clic sobre una pieza para registrar su estado."
                : "Seleccioná un profesional para poder registrar estados."}
            </p>
          )}
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
            {TODOS_DIENTES.map((n) => {
              const ult = estadoActualPorDiente.get(n);
              const btn = (
                <button
                  key={n}
                  type="button"
                  onClick={mode === "inline" ? undefined : () => setDienteFiltro(String(n))}
                  disabled={mode === "inline" && !profesionalId}
                  className={`flex w-full flex-col items-center gap-1 rounded-md border p-2 text-xs transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-60 ${
                    dienteFiltro === String(n) ? "border-primary ring-1 ring-primary" : ""
                  }`}
                  title={ult ? `${DIENTE_ESTADO_LABELS[ult.estado]} • ${format(new Date(ult.fecha), "dd/MM/yy")}` : "Sin registros"}
                >
                  <span className="font-semibold">{n}</span>
                  {ult ? (
                    <>
                      <span className={`h-2 w-full rounded-sm ${DIENTE_ESTADO_DOT[ult.estado]}`} />
                      <span className="truncate text-[10px] text-muted-foreground">
                        {format(new Date(ult.fecha), "dd/MM/yy")}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="h-2 w-full rounded-sm bg-muted" />
                      <span className="text-[10px] text-muted-foreground">—</span>
                    </>
                  )}
                </button>
              );

              if (mode === "inline") {
                return (
                  <ToothPopover
                    key={n}
                    diente={n}
                    trigger={btn}
                    onSelect={async (e) => {
                      await registrarEstadoInline(n, e);
                    }}
                  />
                );
              }
              return btn;
            })}
          </div>
        </CardContent>
      </Card>

      <AgregarRegistroDialog
        open={openDialog}
        onOpenChange={setOpenDialog}
        pacienteId={pacienteId}
        profesionales={profesionales}
        userId={user?.id ?? null}
        onSaved={cargar}
      />
    </div>
  );
}

function ToothPopover({
  diente,
  trigger,
  onSelect,
}: {
  diente: number;
  trigger: React.ReactNode;
  onSelect: (estado: DienteEstado) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="mb-2 px-1 text-xs font-medium">
          Pieza {diente} — elegir estado
        </div>
        <div className="flex flex-col">
          {DIENTE_ESTADOS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={async () => {
                setOpen(false);
                await onSelect(e);
              }}
              className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
            >
              <span className={`h-3 w-3 rounded-sm ${DIENTE_ESTADO_DOT[e]}`} />
              <span>{DIENTE_ESTADO_LABELS[e]}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function AgregarRegistroDialog({
  open,
  onOpenChange,
  pacienteId,
  profesionales,
  userId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pacienteId: string;
  profesionales: Profesional[];
  userId: string | null;
  onSaved: () => void;
}) {
  const [diente, setDiente] = useState<string>("");
  const [estado, setEstado] = useState<DienteEstado | "">("");
  const [profesionalId, setProfesionalId] = useState<string>("");
  const [fecha, setFecha] = useState<string>(() =>
    format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  );
  const [observaciones, setObservaciones] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Pre-seleccionar profesional del usuario logueado
  useEffect(() => {
    if (open) {
      const prop = profesionales.find((p) => p.user_id === userId);
      setProfesionalId(prop?.id ?? "");
      setDiente("");
      setEstado("");
      setObservaciones("");
      setFecha(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    }
  }, [open, profesionales, userId]);

  async function guardar() {
    if (!diente) return toast.error("El diente es obligatorio");
    if (!estado) return toast.error("El estado es obligatorio");
    if (!profesionalId) return toast.error("El profesional es obligatorio");

    setSubmitting(true);
    const { error } = await supabase.from("odontograma_registros").insert({
      paciente_id: pacienteId,
      diente: parseInt(diente, 10),
      estado,
      fecha: new Date(fecha).toISOString(),
      profesional_id: profesionalId,
      observaciones: observaciones.trim() || null,
    });
    setSubmitting(false);

    if (error) return toast.error("No se pudo guardar", { description: error.message });
    toast.success("Registro odontológico agregado");
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar registro odontológico</DialogTitle>
          <DialogDescription>
            Cada registro se guarda como historial. No se sobrescriben registros anteriores.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Diente *</Label>
              <Select value={diente} onValueChange={setDiente}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {TODOS_DIENTES.map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estado *</Label>
              <Select value={estado} onValueChange={(v) => setEstado(v as DienteEstado)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {DIENTE_ESTADOS.map((e) => (
                    <SelectItem key={e} value={e}>
                      <span className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-sm ${DIENTE_ESTADO_DOT[e]}`} />
                        {DIENTE_ESTADO_LABELS[e]}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Profesional *</Label>
              <Select value={profesionalId} onValueChange={setProfesionalId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {profesionales.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.apellido}, {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fecha y hora</Label>
              <Input
                type="datetime-local"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observaciones</Label>
            <Textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Notas opcionales..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={guardar} disabled={submitting}>
            {submitting ? "Guardando..." : "Guardar registro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
