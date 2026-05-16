import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import {
  DIENTE_ESTADOS,
  DIENTE_ESTADO_LABELS,
  DIENTE_ESTADO_CLASSES,
  DIENTE_ESTADO_DOT,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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

export default function Odontograma({ pacienteId }: { pacienteId: string }) {
  const { user } = useAuth();
  const { can } = usePermissions();
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [dienteFiltro, setDienteFiltro] = useState<string>("todos");

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
        {puedeAgregar && (
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
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
            {TODOS_DIENTES.map((n) => {
              const ult = estadoActualPorDiente.get(n);
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setDienteFiltro(String(n))}
                  className={`flex flex-col items-center gap-1 rounded-md border p-2 text-xs transition hover:border-primary ${
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
            })}
          </div>
        </CardContent>
      </Card>

      {/* Historial detallado */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Historial detallado</CardTitle>
            <CardDescription>Cronología de registros (más reciente primero)</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Diente</Label>
            <Select value={dienteFiltro} onValueChange={setDienteFiltro}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="todos">Todos</SelectItem>
                {TODOS_DIENTES.map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : historialFiltrado.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin registros para mostrar.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Diente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Profesional</TableHead>
                  <TableHead>Observaciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historialFiltrado.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{format(new Date(r.fecha), "dd/MM/yyyy HH:mm")}</TableCell>
                    <TableCell className="font-medium">{r.diente}</TableCell>
                    <TableCell>
                      <Badge className={DIENTE_ESTADO_CLASSES[r.estado]}>
                        {DIENTE_ESTADO_LABELS[r.estado]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {r.profesionales
                        ? `${r.profesionales.apellido}, ${r.profesionales.nombre}`
                        : "—"}
                    </TableCell>
                    <TableCell className="max-w-xs truncate" title={r.observaciones ?? ""}>
                      {r.observaciones ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
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
