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
  profesionalId,
  fechaAtencion,
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
  /** Profesional del turno/atención actual (prioritario). */
  profesionalId?: string | null;
  /** Fecha de la atención (YYYY-MM-DD). Si no viene, se usa ahora. */
  fechaAtencion?: string | null;
}) {
  const [submitting, setSubmitting] = useState<DienteEstado | null>(null);
  const [verHistorial, setVerHistorial] = useState(false);

  const historialPieza = useMemo(
    () => (dienteInterno ? registros.filter((r) => r.diente === dienteInterno) : []),
    [registros, dienteInterno],
  );
  const ultimo = historialPieza[0] ?? null;
  const fdi = dienteInterno ? internoToFdi(dienteInterno) : null;

  // Profesional efectivo: el del turno > el del usuario logueado
  const profEfectivoId = useMemo(() => {
    if (profesionalId) return profesionalId;
    const propio = profesionales.find((p) => p.user_id === userId);
    return propio?.id ?? null;
  }, [profesionalId, profesionales, userId]);

  const profEfectivo = useMemo(
    () => profesionales.find((p) => p.id === profEfectivoId) ?? null,
    [profesionales, profEfectivoId],
  );

  useEffect(() => {
    if (open) {
      setSubmitting(null);
      setVerHistorial(false);
    }
  }, [open, dienteInterno]);

  async function registrar(estado: DienteEstado) {
    if (!dienteInterno) return;
    if (!profEfectivoId) {
      toast.error("Falta el profesional", {
        description: "No se pudo determinar el profesional del turno.",
      });
      return;
    }
    setSubmitting(estado);
    const fechaIso = fechaAtencion
      ? new Date(`${fechaAtencion}T${format(new Date(), "HH:mm:ss")}`).toISOString()
      : new Date().toISOString();
    const { error } = await supabase.from("odontograma_registros").insert({
      paciente_id: pacienteId,
      diente: dienteInterno,
      estado,
      fecha: fechaIso,
      profesional_id: profEfectivoId,
      observaciones: null,
    });
    setSubmitting(null);
    if (error) {
      toast.error("No se pudo registrar", { description: error.message });
      return;
    }
    toast.success(`Pieza ${fdi}: ${DIENTE_ESTADO_LABELS[estado]}`);
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pieza {fdi ?? "—"}</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-1">
              {ultimo ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Estado actual:</span>
                  <Badge variant="secondary" className="gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${DIENTE_ESTADO_DOT[ultimo.estado]}`} />
                    {DIENTE_ESTADO_LABELS[ultimo.estado]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(ultimo.fecha), "dd/MM/yyyy")}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Sin registros previos.</span>
              )}
              {profEfectivo && canCreate && (
                <div className="text-xs text-muted-foreground">
                  Se registrará a nombre de{" "}
                  <span className="font-medium text-foreground">
                    {profEfectivo.apellido}, {profEfectivo.nombre}
                  </span>
                </div>
              )}
              {!profEfectivoId && canCreate && (
                <div className="text-xs text-destructive">
                  No hay profesional asociado. Seleccioná un profesional en el turno antes de registrar.
                </div>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        {!verHistorial ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              {DIENTE_ESTADOS_SELECCIONABLES.map((e) => (
                <Button
                  key={e}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="justify-start gap-2"
                  disabled={!canCreate || !profEfectivoId || submitting !== null}
                  onClick={() => registrar(e)}
                >
                  <span className={`h-3 w-3 shrink-0 rounded-sm ${DIENTE_ESTADO_DOT[e]}`} />
                  <span className="truncate text-sm">{DIENTE_ESTADO_LABELS[e]}</span>
                </Button>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setVerHistorial(true)}
              >
                Ver historial ({historialPieza.length})
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cerrar
              </Button>
            </div>
          </>
        ) : (
          <>
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historialPieza.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {format(new Date(r.fecha), "dd/MM/yyyy HH:mm")}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-2 text-xs">
                            <span
                              className={`h-2.5 w-2.5 rounded-sm ${DIENTE_ESTADO_DOT[r.estado]}`}
                            />
                            {DIENTE_ESTADO_LABELS[r.estado]}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs">
                          {r.profesionales
                            ? `${r.profesionales.apellido}, ${r.profesionales.nombre}`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="flex justify-between pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setVerHistorial(false)}>
                ← Volver
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cerrar
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
