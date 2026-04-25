import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2, XCircle, CalendarClock, Loader2, RefreshCw,
  AlertTriangle, UserPlus, UserCog, ShieldCheck,
} from "lucide-react";
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
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  requiere_validacion: boolean;
  nombre_solicitante: string | null;
  apellido_solicitante: string | null;
  dni_solicitante: string | null;
  telefono_solicitante: string | null;
  email_solicitante: string | null;
  paciente: {
    nombre: string; apellido: string; dni: string;
    telefono: string | null; email: string | null;
    pendiente_validacion: boolean;
  } | null;
  profesional: { nombre: string; apellido: string } | null;
}

const ESTADOS_FILTRO: Array<{ value: string; label: string }> = [
  { value: "solicitado", label: "Pendientes" },
  { value: "validacion", label: "Requieren validación" },
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
  if (!telefono) return { ok: false, error: "Paciente sin teléfono" };
  try {
    const { data, error } = await supabase.functions.invoke("send_whatsapp", {
      body: { telefono, mensaje },
    });
    const ok = !error && !(data && data.success === false);
    await supabase.from("whatsapp_respuestas").insert({
      telefono, mensaje, turno_id: turnoId,
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

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

function diffsDePaciente(s: Solicitud): string[] {
  if (!s.paciente) return [];
  const out: string[] = [];
  if (norm(s.paciente.nombre) !== norm(s.nombre_solicitante)) out.push("nombre");
  if (norm(s.paciente.apellido) !== norm(s.apellido_solicitante)) out.push("apellido");
  if ((s.paciente.dni ?? "") !== (s.dni_solicitante ?? "")) out.push("DNI");
  return out;
}

// Helper: ¿la solicitud requiere validación manual?
function necesitaValidar(s: Solicitud): boolean {
  if (s.estado !== "solicitado") return false;
  return s.requiere_validacion === true || s.paciente?.pendiente_validacion === true;
}

// Helper: ¿es un paciente nuevo provisorio (sin paciente previo con el cual comparar)?
function esPacienteNuevoProvisorio(s: Solicitud): boolean {
  return (
    s.paciente?.pendiente_validacion === true &&
    diffsDePaciente(s).length === 0
  );
}

export default function TurnosSolicitados() {
  const [items, setItems] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<string>("solicitado");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [confirmRechazoId, setConfirmRechazoId] = useState<string | null>(null);
  const [reprogramarItem, setReprogramarItem] = useState<Solicitud | null>(null);
  const [validarItem, setValidarItem] = useState<Solicitud | null>(null);

  async function fetchItems() {
    setLoading(true);
    let q = supabase
      .from("turnos")
      .select(
        "id, fecha, hora_inicio, hora_fin, estado, motivo_consulta, origen, paciente_id, profesional_id, requiere_validacion, nombre_solicitante, apellido_solicitante, dni_solicitante, telefono_solicitante, email_solicitante, paciente:pacientes!inner(nombre, apellido, dni, telefono, email, pendiente_validacion), profesional:profesionales!inner(nombre, apellido)",
      )
      .eq("origen", "publico")
      .order("created_at", { ascending: false });

    if (filtroEstado === "validacion") {
      // Traemos todos los solicitados y filtramos en cliente con el helper
      // (necesario porque no se puede OR sobre columna de tabla embebida).
      q = q.eq("estado", "solicitado" as TurnoEstado);
    } else if (filtroEstado !== "todos") {
      q = q.eq("estado", filtroEstado as TurnoEstado);
    }

    const { data, error } = await q;
    if (error) {
      toast.error("Error cargando solicitudes", { description: error.message });
      setItems([]);
    } else {
      let rows = (data ?? []) as unknown as Solicitud[];
      if (filtroEstado === "validacion") {
        rows = rows.filter(necesitaValidar);
      }
      setItems(rows);
    }
    setLoading(false);
  }

  useEffect(() => { fetchItems(); /* eslint-disable-next-line */ }, [filtroEstado]);

  const pendientesCount = useMemo(
    () => items.filter((i) => i.estado === "solicitado").length,
    [items],
  );
  const requierenValidacionCount = useMemo(
    () => items.filter(necesitaValidar).length,
    [items],
  );

  // ----- Confirmar -----
  async function handleConfirmar(s: Solicitud) {
    setActionLoadingId(s.id);
    try {
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
        .update({ estado: "confirmado", requiere_validacion: false })
        .eq("id", s.id);
      if (error) throw error;

      const profesional = s.profesional
        ? `${s.profesional.nombre} ${s.profesional.apellido}`.trim()
        : "el profesional";
      const nombre = s.paciente?.nombre ?? "";
      const mensaje = buildMensaje("confirmado", nombre, profesional, s.fecha, s.hora_inicio);
      const wp = await enviarWhatsApp(
        s.paciente?.telefono ?? s.telefono_solicitante ?? null,
        mensaje, s.id, "enviado_confirmacion",
      );

      toast.success("Turno confirmado", {
        description: wp.ok ? "Se envió WhatsApp al paciente." : `WhatsApp: ${wp.error}`,
      });
      setValidarItem(null);
      await fetchItems();
    } catch (e) {
      toast.error("No se pudo confirmar", {
        description: e instanceof Error ? e.message : "Error desconocido",
      });
    } finally {
      setActionLoadingId(null);
    }
  }

  // ----- Actualizar datos del paciente con los del solicitante -----
  async function handleActualizarPaciente(s: Solicitud) {
    if (!s.paciente_id) return;
    setActionLoadingId(s.id);
    try {
      const upd: {
        nombre?: string; apellido?: string; dni?: string;
      } = {};
      if (s.nombre_solicitante) upd.nombre = s.nombre_solicitante.trim();
      if (s.apellido_solicitante) upd.apellido = s.apellido_solicitante.trim();
      if (s.dni_solicitante) upd.dni = s.dni_solicitante.trim();

      const { error } = await supabase
        .from("pacientes")
        .update(upd)
        .eq("id", s.paciente_id);
      if (error) throw error;

      await supabase
        .from("turnos")
        .update({ requiere_validacion: false })
        .eq("id", s.id);

      toast.success("Datos del paciente actualizados");
      await fetchItems();
      // Refrescar el dialog con el item actualizado
      setValidarItem((prev) => (prev && prev.id === s.id ? null : prev));
    } catch (e) {
      toast.error("No se pudo actualizar el paciente", {
        description: e instanceof Error ? e.message : "Error desconocido",
      });
    } finally {
      setActionLoadingId(null);
    }
  }

  // ----- Crear paciente nuevo y vincular el turno -----
  async function handleCrearPacienteNuevo(s: Solicitud) {
    setActionLoadingId(s.id);
    try {
      const { data: nuevo, error: errPac } = await supabase
        .from("pacientes")
        .insert({
          nombre: (s.nombre_solicitante ?? "").trim(),
          apellido: (s.apellido_solicitante ?? "").trim(),
          dni: (s.dni_solicitante ?? "").trim(),
          telefono: s.telefono_solicitante,
          email: s.email_solicitante,
          pendiente_validacion: true,
        })
        .select("id")
        .single();
      if (errPac || !nuevo) throw errPac ?? new Error("No se pudo crear el paciente");

      const { error: errT } = await supabase
        .from("turnos")
        .update({ paciente_id: nuevo.id, requiere_validacion: false })
        .eq("id", s.id);
      if (errT) throw errT;

      toast.success("Paciente nuevo creado y vinculado");
      setValidarItem(null);
      await fetchItems();
    } catch (e) {
      toast.error("No se pudo crear el paciente", {
        description: e instanceof Error ? e.message : "Error desconocido",
      });
    } finally {
      setActionLoadingId(null);
    }
  }

  // ----- Confirmar y marcar paciente como validado (paciente nuevo provisorio) -----
  async function handleConfirmarYValidarPaciente(s: Solicitud) {
    if (!s.paciente_id) return;
    setActionLoadingId(s.id);
    try {
      const { error: errPac } = await supabase
        .from("pacientes")
        .update({ pendiente_validacion: false })
        .eq("id", s.paciente_id);
      if (errPac) throw errPac;
    } catch (e) {
      toast.error("No se pudo marcar el paciente como validado", {
        description: e instanceof Error ? e.message : "Error desconocido",
      });
      setActionLoadingId(null);
      return;
    }
    setActionLoadingId(null);
    await handleConfirmar(s);
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
        s.paciente?.telefono ?? s.telefono_solicitante ?? null,
        mensaje, s.id, "enviado_rechazo",
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
            <CardTitle className="flex items-center gap-2 flex-wrap">
              Turnos solicitados
              {pendientesCount > 0 && (
                <Badge variant="secondary">{pendientesCount} pendientes</Badge>
              )}
              {requierenValidacionCount > 0 && (
                <Badge className="bg-warning text-warning-foreground hover:bg-warning/90">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {requierenValidacionCount} a validar
                </Badge>
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Solicitudes recibidas desde el formulario público.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger className="w-[200px]">
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
                    const validar = necesitaValidar(s);
                    return (
                      <TableRow
                        key={s.id}
                        className={validar ? "bg-warning/5" : undefined}
                      >
                        <TableCell className="whitespace-nowrap">{fmtFecha(s.fecha)}</TableCell>
                        <TableCell className="whitespace-nowrap">{s.hora_inicio.slice(0,5)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>
                              {s.paciente ? `${s.paciente.nombre} ${s.paciente.apellido}` : "—"}
                            </span>
                            {validar && (
                              <Badge
                                variant="outline"
                                className="border-warning text-warning gap-1"
                              >
                                <AlertTriangle className="h-3 w-3" />
                                validar
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {s.paciente?.telefono || s.telefono_solicitante || (
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
                            <div className="inline-flex items-center gap-1 flex-wrap justify-end">
                              {validar && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setValidarItem(s)}
                                  disabled={acting}
                                  className="border-warning text-warning hover:text-warning"
                                >
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  <span className="ml-1">Validar</span>
                                </Button>
                              )}
                              {!validar && (
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
                              )}
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

      {/* Diálogo de validación de datos */}
      <Dialog
        open={validarItem !== null}
        onOpenChange={(v) => !v && setValidarItem(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Validar datos del solicitante</DialogTitle>
            <DialogDescription>
              Comparación entre el paciente vinculado por teléfono y los datos
              ingresados en el formulario público.
            </DialogDescription>
          </DialogHeader>

          {validarItem && (
            <div className="space-y-4">
              <Alert variant="default" className="border-warning/40 bg-warning/5">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertTitle>Diferencias detectadas</AlertTitle>
                <AlertDescription>
                  Los datos ingresados no coinciden con el paciente existente
                  {(() => {
                    const d = diffsDePaciente(validarItem);
                    return d.length ? ` (${d.join(", ")}). ` : ". ";
                  })()}
                  Validar antes de confirmar.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-md border border-border p-3">
                  <h4 className="text-sm font-semibold mb-2">Paciente existente</h4>
                  <dl className="text-sm space-y-1">
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground w-20">Nombre:</dt>
                      <dd>{validarItem.paciente?.nombre || "—"}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground w-20">Apellido:</dt>
                      <dd>{validarItem.paciente?.apellido || "—"}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground w-20">DNI:</dt>
                      <dd>{validarItem.paciente?.dni || "—"}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground w-20">Teléfono:</dt>
                      <dd>{validarItem.paciente?.telefono || "—"}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground w-20">Email:</dt>
                      <dd className="break-all">{validarItem.paciente?.email || "—"}</dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-md border border-warning/40 bg-warning/5 p-3">
                  <h4 className="text-sm font-semibold mb-2">Datos del formulario</h4>
                  <dl className="text-sm space-y-1">
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground w-20">Nombre:</dt>
                      <dd>{validarItem.nombre_solicitante || "—"}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground w-20">Apellido:</dt>
                      <dd>{validarItem.apellido_solicitante || "—"}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground w-20">DNI:</dt>
                      <dd>{validarItem.dni_solicitante || "—"}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground w-20">Teléfono:</dt>
                      <dd>{validarItem.telefono_solicitante || "—"}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground w-20">Email:</dt>
                      <dd className="break-all">{validarItem.email_solicitante || "—"}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-2">
            {validarItem && (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleCrearPacienteNuevo(validarItem)}
                  disabled={actionLoadingId === validarItem.id}
                  className="sm:mr-auto"
                >
                  <UserPlus className="h-4 w-4 mr-1" />
                  Crear paciente nuevo
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleActualizarPaciente(validarItem)}
                  disabled={actionLoadingId === validarItem.id || !validarItem.paciente_id}
                >
                  <UserCog className="h-4 w-4 mr-1" />
                  Actualizar datos del paciente
                </Button>
                <Button
                  onClick={() => handleConfirmar(validarItem)}
                  disabled={actionLoadingId === validarItem.id}
                >
                  {actionLoadingId === validarItem.id ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                  )}
                  Confirmar usando paciente existente
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de reprogramación */}
      {reprogramarItem && (
        <ReprogramarDialog
          turno={{
            id: reprogramarItem.id,
            profesional_id: reprogramarItem.profesional_id,
            fecha: reprogramarItem.fecha,
            hora_inicio: reprogramarItem.hora_inicio,
            paciente_nombre: reprogramarItem.paciente?.nombre ?? "",
            paciente_telefono: reprogramarItem.paciente?.telefono ?? reprogramarItem.telefono_solicitante ?? null,
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
