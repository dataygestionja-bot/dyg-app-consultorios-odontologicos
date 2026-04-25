import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, XCircle, CalendarClock, Loader2, RefreshCw } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { es } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { TURNO_ESTADO_LABELS, TURNO_ESTADO_CLASSES, type TurnoEstado } from "@/lib/constants";
import { ReprogramarDialog } from "@/components/turnos/ReprogramarDialog";

interface Solicitud {
  id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: TurnoEstado;
  motivo_consulta: string | null;
  origen: string;
  paciente_id: string;
  profesional_id: string;
  paciente: { nombre: string; apellido: string; telefono: string | null } | null;
  profesional: { nombre: string; apellido: string } | null;
}

const ESTADOS_FILTRO: Array<{ value: string; label: string }> = [
  { value: "solicitado", label: "Pendientes" },
  { value: "confirmado", label: "Confirmados" },
  { value: "rechazado", label: "Rechazados" },
  { value: "todos", label: "Todos" },
];

function fmtFecha(s: string) {
  const d = parseISO(s);
  return isValid(d) ? format(d, "dd/MM/yyyy", { locale: es }) : s;
}

async function enviarWhatsApp(
  telefono: string | null,
  mensaje: string,
  turnoId: string,
  resultadoTag: string,
) {
  if (!telefono) {
    return { ok: false, error: "Paciente sin teléfono" };
  }
  try {
    const { data, error } = await supabase.functions.invoke("send_whatsapp", {
      body: { telefono, mensaje },
    });
    const ok = !error && !(data && data.success === false);
    await supabase.from("whatsapp_respuestas").insert({
      telefono,
      mensaje,
      turno_id: turnoId,
      accion_detectada: null,
      resultado: ok ? resultadoTag : `error_${resultadoTag}`,
    });
    if (!ok) {
      return {
        ok: false,
        error: (data?.error as string) || error?.message || "Error al enviar WhatsApp",
      };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al enviar WhatsApp" };
  }
}

function buildMensaje(
  tipo: "confirmado" | "rechazado",
  nombre: string,
  profesional: string,
  fecha: string,
  hora: string,
) {
  const fechaLeg = (() => {
    const d = parseISO(fecha);
    return isValid(d) ? format(d, "dd/MM/yyyy", { locale: es }) : fecha;
  })();
  const horaLeg = hora.slice(0, 5);
  if (tipo === "confirmado") {
    return `Hola ${nombre}, tu turno fue confirmado con ${profesional} el día ${fechaLeg} a las ${horaLeg}. Te esperamos.`;
  }
  return `Hola ${nombre}, no pudimos confirmar tu solicitud de turno para el día ${fechaLeg} a las ${horaLeg}. Por favor contactanos para coordinar otro horario.`;
}

export default function TurnosSolicitados() {
  const [items, setItems] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<string>("solicitado");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [confirmRechazoId, setConfirmRechazoId] = useState<string | null>(null);
  const [reprogramarItem, setReprogramarItem] = useState<Solicitud | null>(null);

  async function fetchItems() {
    setLoading(true);
    let q = supabase
      .from("turnos")
      .select(
        "id, fecha, hora_inicio, hora_fin, estado, motivo_consulta, origen, paciente_id, profesional_id, paciente:pacientes!inner(nombre, apellido, telefono), profesional:profesionales!inner(nombre, apellido)",
      )
      .eq("origen", "publico")
      .order("created_at", { ascending: false });

    if (filtroEstado !== "todos") {
      q = q.eq("estado", filtroEstado as TurnoEstado);
    }

    const { data, error } = await q;
    if (error) {
      toast.error("Error cargando solicitudes", { description: error.message });
      setItems([]);
    } else {
      setItems((data ?? []) as unknown as Solicitud[]);
    }
    setLoading(false);
  }

  useEffect(() => { fetchItems(); /* eslint-disable-next-line */ }, [filtroEstado]);

  const pendientesCount = useMemo(
    () => items.filter((i) => i.estado === "solicitado").length,
    [items],
  );

  // ----- Confirmar -----
  async function handleConfirmar(s: Solicitud) {
    setActionLoadingId(s.id);
    try {
      // Re-chequear que el slot siga libre (excluyendo este mismo turno)
      const { data: choques, error: errCh } = await supabase
        .from("turnos")
        .select("id")
        .eq("profesional_id", s.profesional_id)
        .eq("fecha", s.fecha)
        .neq("id", s.id)
        .in("estado", ["reservado","confirmado","en_atencion","atendido","pendiente_cierre"])
        .lt("hora_inicio", s.hora_fin)
        .gt("hora_fin", s.hora_inicio)
        .eq("es_sobreturno", false);

      if (errCh) throw errCh;
      if ((choques ?? []).length > 0) {
        toast.error("El horario fue tomado por otro turno", {
          description: "Reprogramá la solicitud para elegir otro horario.",
        });
        return;
      }

      const { error } = await supabase
        .from("turnos")
        .update({ estado: "confirmado" })
        .eq("id", s.id);
      if (error) throw error;

      const profesional = s.profesional
        ? `${s.profesional.nombre} ${s.profesional.apellido}`.trim()
        : "el profesional";
      const nombre = s.paciente?.nombre ?? "";
      const mensaje = buildMensaje("confirmado", nombre, profesional, s.fecha, s.hora_inicio);
      const wp = await enviarWhatsApp(
        s.paciente?.telefono ?? null, mensaje, s.id, "enviado_confirmacion",
      );

      toast.success("Turno confirmado", {
        description: wp.ok ? "Se envió WhatsApp al paciente." : `WhatsApp: ${wp.error}`,
      });
      await fetchItems();
    } catch (e) {
      toast.error("No se pudo confirmar", {
        description: e instanceof Error ? e.message : "Error desconocido",
      });
    } finally {
      setActionLoadingId(null);
    }
  }

  // ----- Rechazar -----
  async function handleRechazar(s: Solicitud) {
    setActionLoadingId(s.id);
    setConfirmRechazoId(null);
    try {
      const { error } = await supabase
        .from("turnos")
        .update({ estado: "rechazado" })
        .eq("id", s.id);
      if (error) throw error;

      const profesional = s.profesional
        ? `${s.profesional.nombre} ${s.profesional.apellido}`.trim()
        : "el profesional";
      const nombre = s.paciente?.nombre ?? "";
      const mensaje = buildMensaje("rechazado", nombre, profesional, s.fecha, s.hora_inicio);
      const wp = await enviarWhatsApp(
        s.paciente?.telefono ?? null, mensaje, s.id, "enviado_rechazo",
      );

      toast.success("Solicitud rechazada", {
        description: wp.ok ? "Se notificó al paciente." : `WhatsApp: ${wp.error}`,
      });
      await fetchItems();
    } catch (e) {
      toast.error("No se pudo rechazar", {
        description: e instanceof Error ? e.message : "Error desconocido",
      });
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start sm:items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              Turnos solicitados
              {pendientesCount > 0 && (
                <Badge variant="secondary">{pendientesCount} pendientes</Badge>
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Solicitudes recibidas desde el formulario público.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ESTADOS_FILTRO.map((e) => (
                  <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchItems} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-6">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No hay solicitudes para mostrar.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Hora</TableHead>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Profesional</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((s) => {
                    const acting = actionLoadingId === s.id;
                    const esPendiente = s.estado === "solicitado";
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="whitespace-nowrap">{fmtFecha(s.fecha)}</TableCell>
                        <TableCell className="whitespace-nowrap">{s.hora_inicio.slice(0,5)}</TableCell>
                        <TableCell>
                          {s.paciente ? `${s.paciente.nombre} ${s.paciente.apellido}` : "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {s.paciente?.telefono || (
                            <span className="text-muted-foreground italic text-xs">sin teléfono</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {s.profesional ? `${s.profesional.nombre} ${s.profesional.apellido}` : "—"}
                        </TableCell>
                        <TableCell className="max-w-[260px]">
                          <p className="text-sm line-clamp-2">{s.motivo_consulta}</p>
                        </TableCell>
                        <TableCell>
                          <Badge className={TURNO_ESTADO_CLASSES[s.estado]}>
                            {TURNO_ESTADO_LABELS[s.estado]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {esPendiente ? (
                            <div className="inline-flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleConfirmar(s)}
                                disabled={acting}
                                className="text-success hover:text-success"
                              >
                                {acting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                <span className="ml-1">Confirmar</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setReprogramarItem(s)}
                                disabled={acting}
                              >
                                <CalendarClock className="h-3.5 w-3.5" />
                                <span className="ml-1">Reprogramar</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setConfirmRechazoId(s.id)}
                                disabled={acting}
                                className="text-destructive hover:text-destructive"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                <span className="ml-1">Rechazar</span>
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmación de rechazo */}
      <AlertDialog
        open={confirmRechazoId !== null}
        onOpenChange={(v) => !v && setConfirmRechazoId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Rechazar la solicitud?</AlertDialogTitle>
            <AlertDialogDescription>
              Se notificará al paciente por WhatsApp para que coordine otro horario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const it = items.find((x) => x.id === confirmRechazoId);
                if (it) handleRechazar(it);
              }}
            >
              Rechazar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de reprogramación */}
      {reprogramarItem && (
        <ReprogramarDialog
          turno={{
            id: reprogramarItem.id,
            profesional_id: reprogramarItem.profesional_id,
            fecha: reprogramarItem.fecha,
            hora_inicio: reprogramarItem.hora_inicio,
            paciente_nombre: reprogramarItem.paciente?.nombre ?? "",
            paciente_telefono: reprogramarItem.paciente?.telefono ?? null,
            profesional_nombre: reprogramarItem.profesional
              ? `${reprogramarItem.profesional.nombre} ${reprogramarItem.profesional.apellido}`
              : "",
          }}
          onClose={() => setReprogramarItem(null)}
          onDone={() => { setReprogramarItem(null); fetchItems(); }}
        />
      )}
    </div>
  );
}
