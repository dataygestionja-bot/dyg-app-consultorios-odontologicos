import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DIENTE_ESTADO_DOT,
  DIENTE_ESTADO_LABELS,
  DIENTE_ESTADOS_SELECCIONABLES,
  type DienteEstado,
} from "@/lib/constants";
import { internoToFdi } from "@/lib/odontograma";

export interface RegistroPieza {
  id: string;
  diente: number;
  estado: DienteEstado;
  fecha: string;
  observaciones: string | null;
  profesional_id: string;
  profesionales?: { nombre: string; apellido: string } | null;
}

interface Profesional {
  id: string;
  nombre: string;
  apellido: string;
  user_id: string | null;
}

export default function PiezaDentalDialog({
  open,
  onOpenChange,
  dienteInterno,
  pacienteId,
  registros,
  profesionales,
  userId,
  onSaved,
  canCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dienteInterno: number | null;
  pacienteId: string;
  registros: RegistroPieza[];
  profesionales: Profesional[];
  userId: string | null;
  onSaved: () => void;
  canCreate: boolean;
}) {
  const [estado, setEstado] = useState<DienteEstado | "">("");
  const [profesionalId, setProfesionalId] = useState<string>("");
  const [fecha, setFecha] = useState<string>(() => format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [observaciones, setObservaciones] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<"nuevo" | "historial">("nuevo");

  const historialPieza = useMemo(
    () => (dienteInterno ? registros.filter((r) => r.diente === dienteInterno) : []),
    [registros, dienteInterno],
  );
  const ultimo = historialPieza[0] ?? null;
  const fdi = dienteInterno ? internoToFdi(dienteInterno) : null;

  useEffect(() => {
    if (open) {
      const propio = profesionales.find((p) => p.user_id === userId);
      setProfesionalId(propio?.id ?? "");
      setEstado("");
      setObservaciones("");
      setFecha(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
      setTab("nuevo");
    }
  }, [open, profesionales, userId, dienteInterno]);

  async function guardar() {
    if (!dienteInterno) return;
    if (!estado) return toast.error("Seleccioná una acción / diagnóstico");
    if (!profesionalId) return toast.error("El profesional es obligatorio");

    setSubmitting(true);
    const { error } = await supabase.from("odontograma_registros").insert({
      paciente_id: pacienteId,
      diente: dienteInterno,
      estado,
      fecha: new Date(fecha).toISOString(),
      profesional_id: profesionalId,
      observaciones: observaciones.trim() || null,
    });
    setSubmitting(false);
    if (error) return toast.error("No se pudo guardar", { description: error.message });
    toast.success(`Pieza ${fdi}: ${DIENTE_ESTADO_LABELS[estado]}`);
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            Pieza {fdi ?? "—"}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              (interno {dienteInterno})
            </span>
          </DialogTitle>
          <DialogDescription>
            {ultimo ? (
              <span className="flex flex-wrap items-center gap-2">
                Estado actual:
                <Badge variant="secondary" className="gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${DIENTE_ESTADO_DOT[ultimo.estado]}`} />
                  {DIENTE_ESTADO_LABELS[ultimo.estado]}
                </Badge>
                <span className="text-xs">
                  {format(new Date(ultimo.fecha), "dd/MM/yyyy HH:mm")}
                  {ultimo.profesionales
                    ? ` · ${ultimo.profesionales.apellido}, ${ultimo.profesionales.nombre}`
                    : ""}
                </span>
              </span>
            ) : (
              "Sin registros previos para esta pieza."
            )}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="nuevo" disabled={!canCreate}>
              Nueva acción
            </TabsTrigger>
            <TabsTrigger value="historial">
              Historial ({historialPieza.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="nuevo" className="space-y-4 pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Acción / diagnóstico *</Label>
                <Select value={estado} onValueChange={(v) => setEstado(v as DienteEstado)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {DIENTE_ESTADOS_SELECCIONABLES.map((e) => (
                      <SelectItem key={e} value={e}>
                        <span className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-sm ${DIENTE_ESTADO_DOT[e]}`} />
                          {DIENTE_ESTADO_LABELS[e]}
                        </span>
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
              <Label>Profesional *</Label>
              <Select value={profesionalId} onValueChange={setProfesionalId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
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
              <Label>Observaciones</Label>
              <Textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Notas opcionales..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={guardar} disabled={submitting || !canCreate}>
                {submitting ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="historial" className="pt-3">
            {historialPieza.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Sin registros para esta pieza.
              </p>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Profesional</TableHead>
                      <TableHead>Observaciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historialPieza.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(r.fecha), "dd/MM/yyyy HH:mm")}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-2">
                            <span
                              className={`h-2.5 w-2.5 rounded-sm ${DIENTE_ESTADO_DOT[r.estado]}`}
                            />
                            {DIENTE_ESTADO_LABELS[r.estado]}
                          </span>
                        </TableCell>
                        <TableCell>
                          {r.profesionales
                            ? `${r.profesionales.apellido}, ${r.profesionales.nombre}`
                            : "—"}
                        </TableCell>
                        <TableCell className="whitespace-pre-wrap text-xs">
                          {r.observaciones || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
