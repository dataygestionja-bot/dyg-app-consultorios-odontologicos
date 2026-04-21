import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { PrestacionQuickDialog } from "@/components/prestaciones/PrestacionQuickDialog";

interface Paciente { id: string; nombre: string; apellido: string; dni: string; }
interface Profesional { id: string; nombre: string; apellido: string; }
interface Prestacion { id: string; codigo: string; descripcion: string; precio_base: number; }
interface TurnoOpcion { id: string; fecha: string; hora_inicio: string; motivo_consulta: string; paciente_id: string; profesional_id: string; }

type TipoAtencion = "con_turno" | "urgencia" | "espontanea";

const TIPO_ATENCION_LABELS: Record<TipoAtencion, string> = {
  con_turno: "Con turno",
  urgencia: "Urgencia",
  espontanea: "Espontánea",
};

interface PracticaRow {
  id?: string;
  prestacion_id: string;
  pieza_dental: string;
  cara_dental: string;
  cantidad: number;
  observacion: string;
  orden: number;
}

const empty = {
  paciente_id: "",
  profesional_id: "",
  fecha: format(new Date(), "yyyy-MM-dd"),
  diagnostico: "",
  indicaciones: "",
  observaciones: "",
  proxima_visita_sugerida: "",
  turno_id: null as string | null,
  tipo_atencion: "con_turno" as TipoAtencion,
};

const newPractica = (orden: number): PracticaRow => ({
  prestacion_id: "",
  pieza_dental: "",
  cara_dental: "",
  cantidad: 1,
  observacion: "",
  orden,
});

export default function AtencionForm() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const turnoIdParam = params.get("turno");
  const navigate = useNavigate();
  const isEdit = id && id !== "nuevo";
  const [form, setForm] = useState(empty);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [prestaciones, setPrestaciones] = useState<Prestacion[]>([]);
  const [practicas, setPracticas] = useState<PracticaRow[]>([newPractica(1)]);
  const [submitting, setSubmitting] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickTargetIdx, setQuickTargetIdx] = useState<number | null>(null);

  const [turnosDisponibles, setTurnosDisponibles] = useState<TurnoOpcion[]>([]);

  useEffect(() => {
    document.title = isEdit ? "Editar atención | Consultorio" : "Nueva atención | Consultorio";
    Promise.all([
      supabase.from("pacientes").select("id, nombre, apellido, dni").eq("activo", true).order("apellido"),
      supabase.from("profesionales").select("id, nombre, apellido").eq("activo", true).order("apellido"),
      supabase.from("prestaciones").select("id, codigo, descripcion, precio_base").eq("activo", true).order("codigo"),
    ]).then(([pa, pr, pe]) => {
      setPacientes((pa.data ?? []) as Paciente[]);
      setProfesionales((pr.data ?? []) as Profesional[]);
      setPrestaciones(((pe.data ?? []) as any[]).map((p) => ({ ...p, precio_base: Number(p.precio_base) })));
    });

    if (isEdit) {
      supabase.from("atenciones").select("*").eq("id", id).maybeSingle()
        .then(({ data }) => {
          if (data) setForm({
            paciente_id: data.paciente_id,
            profesional_id: data.profesional_id,
            fecha: data.fecha,
            diagnostico: data.diagnostico ?? "",
            indicaciones: data.indicaciones ?? "",
            observaciones: data.observaciones ?? "",
            proxima_visita_sugerida: (data as any).proxima_visita_sugerida ?? "",
            turno_id: data.turno_id,
            tipo_atencion: ((data as any).tipo_atencion ?? "con_turno") as TipoAtencion,
          });
        });
      supabase.from("atencion_practicas").select("*").eq("atencion_id", id).order("orden")
        .then(({ data }) => {
          if (data && data.length > 0) {
            setPracticas(data.map((p) => ({
              id: p.id,
              prestacion_id: p.prestacion_id,
              pieza_dental: p.pieza_dental ?? "",
              cara_dental: p.cara_dental ?? "",
              cantidad: p.cantidad,
              observacion: p.observacion ?? "",
              orden: p.orden,
            })));
          }
        });
    } else if (turnoIdParam) {
      supabase.from("turnos").select("paciente_id, profesional_id, fecha, motivo_consulta").eq("id", turnoIdParam).maybeSingle()
        .then(({ data }) => {
          if (data) setForm((f) => ({
            ...f,
            paciente_id: data.paciente_id,
            profesional_id: data.profesional_id,
            fecha: data.fecha,
            turno_id: turnoIdParam,
            tipo_atencion: "con_turno",
          }));
        });
    }
  }, [id, isEdit, turnoIdParam]);

  // Cargar turnos disponibles del paciente cuando es "con_turno"
  useEffect(() => {
    if (form.tipo_atencion !== "con_turno" || !form.paciente_id) {
      setTurnosDisponibles([]);
      return;
    }
    supabase
      .from("turnos")
      .select("id, fecha, hora_inicio, motivo_consulta, paciente_id, profesional_id")
      .eq("paciente_id", form.paciente_id)
      .in("estado", ["confirmado", "en_atencion", "reservado"])
      .order("fecha", { ascending: true })
      .order("hora_inicio", { ascending: true })
      .limit(50)
      .then(({ data }) => setTurnosDisponibles((data ?? []) as TurnoOpcion[]));
  }, [form.tipo_atencion, form.paciente_id]);

  function setTipoAtencion(tipo: TipoAtencion) {
    setForm((f) => ({
      ...f,
      tipo_atencion: tipo,
      // Si pasa a urgencia/espontanea, limpiar turno
      turno_id: tipo === "con_turno" ? f.turno_id : null,
    }));
  }


  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function updatePractica(idx: number, patch: Partial<PracticaRow>) {
    setPracticas((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function addPractica() {
    setPracticas((rows) => [...rows, newPractica(rows.length + 1)]);
  }

  function removePractica(idx: number) {
    setPracticas((rows) => {
      const next = rows.filter((_, i) => i !== idx).map((r, i) => ({ ...r, orden: i + 1 }));
      return next.length > 0 ? next : [newPractica(1)];
    });
  }

  function openQuickPrestacion(idx: number) {
    setQuickTargetIdx(idx);
    setQuickOpen(true);
  }

  function onPrestacionCreada(p: { id: string; codigo: string; descripcion: string; precio_base: number }) {
    setPrestaciones((list) => [...list, p].sort((a, b) => a.codigo.localeCompare(b.codigo)));
    if (quickTargetIdx !== null) updatePractica(quickTargetIdx, { prestacion_id: p.id });
    setQuickTargetIdx(null);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();

    // Validación de coherencia tipo_atencion ↔ turno
    if (form.tipo_atencion === "con_turno" && !form.turno_id) {
      return toast.error("Falta el turno", {
        description: "Una atención 'con turno' debe tener un turno seleccionado. Si fue espontánea o de urgencia, cambiá el tipo de atención.",
      });
    }
    if (form.tipo_atencion !== "con_turno" && form.turno_id) {
      return toast.error("Inconsistencia en el tipo", {
        description: "Una atención de urgencia o espontánea no puede estar vinculada a un turno.",
      });
    }

    const validas = practicas.filter((p) => p.prestacion_id);
    setSubmitting(true);

    const payload: any = {
      paciente_id: form.paciente_id,
      profesional_id: form.profesional_id,
      fecha: form.fecha,
      diagnostico: form.diagnostico || null,
      indicaciones: form.indicaciones || null,
      observaciones: form.observaciones || null,
      proxima_visita_sugerida: form.proxima_visita_sugerida || null,
      turno_id: form.tipo_atencion === "con_turno" ? form.turno_id : null,
      tipo_atencion: form.tipo_atencion,
    };

    let atencionId = id as string | undefined;

    if (isEdit) {
      const { error } = await supabase.from("atenciones").update(payload).eq("id", id!);
      if (error) { setSubmitting(false); return toast.error("No se pudo guardar", { description: error.message }); }
    } else {
      const { data, error } = await supabase.from("atenciones").insert(payload).select("id").single();
      if (error || !data) { setSubmitting(false); return toast.error("No se pudo guardar", { description: error?.message }); }
      atencionId = data.id;
    }

    if (atencionId) {
      // Reemplazar prácticas: borrar todas y reinsertar (simple y consistente)
      await supabase.from("atencion_practicas").delete().eq("atencion_id", atencionId);
      if (validas.length > 0) {
        const rows = validas.map((p, i) => ({
          atencion_id: atencionId!,
          prestacion_id: p.prestacion_id,
          pieza_dental: p.pieza_dental || null,
          cara_dental: p.cara_dental || null,
          cantidad: p.cantidad || 1,
          observacion: p.observacion || null,
          orden: i + 1,
        }));
        const { error: errIns } = await supabase.from("atencion_practicas").insert(rows);
        if (errIns) { setSubmitting(false); return toast.error("Atención guardada, pero falló el detalle", { description: errIns.message }); }
      }
    }

    setSubmitting(false);
    toast.success(isEdit ? "Atención actualizada" : "Atención registrada");
    navigate("/atenciones");
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/atenciones")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEdit ? "Editar atención" : "Nueva atención"}
          </h1>
        </div>
      </div>

      <form onSubmit={guardar} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Datos generales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Fecha *</Label>
                <Input type="date" value={form.fecha} onChange={(e) => set("fecha", e.target.value)} required />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Paciente *</Label>
                <Select value={form.paciente_id} onValueChange={(v) => set("paciente_id", v)} required>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {pacientes.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.apellido}, {p.nombre} · {p.dni}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Profesional *</Label>
                <Select value={form.profesional_id} onValueChange={(v) => set("profesional_id", v)} required>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {profesionales.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.apellido}, {p.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Próxima visita sugerida</Label>
                <Input type="date" value={form.proxima_visita_sugerida}
                  onChange={(e) => set("proxima_visita_sugerida", e.target.value)} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo de atención *</Label>
                <Select
                  value={form.tipo_atencion}
                  onValueChange={(v) => setTipoAtencion(v as TipoAtencion)}
                  disabled={!!turnoIdParam}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TIPO_ATENCION_LABELS) as TipoAtencion[]).map((t) => (
                      <SelectItem key={t} value={t}>{TIPO_ATENCION_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {turnoIdParam && (
                  <p className="text-xs text-muted-foreground">
                    Atención iniciada desde un turno: el tipo queda fijo en "Con turno".
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>
                  Turno asociado {form.tipo_atencion === "con_turno" ? "*" : ""}
                </Label>
                <Select
                  value={form.turno_id ?? ""}
                  onValueChange={(v) => set("turno_id", v || null)}
                  disabled={form.tipo_atencion !== "con_turno" || !form.paciente_id || !!turnoIdParam}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      form.tipo_atencion !== "con_turno"
                        ? "No aplica para urgencia/espontánea"
                        : !form.paciente_id
                          ? "Primero seleccioná un paciente"
                          : turnosDisponibles.length === 0
                            ? "Sin turnos disponibles"
                            : "Seleccionar turno..."
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {turnosDisponibles.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {format(new Date(t.fecha + "T00:00:00"), "dd/MM/yyyy")} · {t.hora_inicio?.slice(0, 5)} · {t.motivo_consulta}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.turno_id && turnosDisponibles.find((t) => t.id === form.turno_id) && (
                  <p className="text-xs text-muted-foreground">
                    Motivo del turno: {turnosDisponibles.find((t) => t.id === form.turno_id)?.motivo_consulta}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Prácticas realizadas</CardTitle>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => openQuickPrestacion(-1)}>
                <Plus className="h-4 w-4" /> Crear nueva práctica
              </Button>
              <Button type="button" size="sm" onClick={addPractica}>
                <Plus className="h-4 w-4" /> Agregar fila
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Prestación</TableHead>
                    <TableHead className="w-[100px]">Pieza</TableHead>
                    <TableHead className="w-[100px]">Cara</TableHead>
                    <TableHead className="w-[90px]">Cantidad</TableHead>
                    <TableHead>Observación</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {practicas.map((p, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <div className="flex gap-1">
                          <Select value={p.prestacion_id} onValueChange={(v) => updatePractica(idx, { prestacion_id: v })}>
                            <SelectTrigger><SelectValue placeholder="Seleccionar prestación..." /></SelectTrigger>
                            <SelectContent>
                              {prestaciones.map((pr) => (
                                <SelectItem key={pr.id} value={pr.id}>{pr.codigo} · {pr.descripcion}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button type="button" variant="ghost" size="icon" title="Crear nueva"
                            onClick={() => openQuickPrestacion(idx)}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input value={p.pieza_dental} onChange={(e) => updatePractica(idx, { pieza_dental: e.target.value })} />
                      </TableCell>
                      <TableCell>
                        <Input value={p.cara_dental} onChange={(e) => updatePractica(idx, { cara_dental: e.target.value })} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" min={1} value={p.cantidad}
                          onChange={(e) => updatePractica(idx, { cantidad: parseInt(e.target.value) || 1 })} />
                      </TableCell>
                      <TableCell>
                        <Input value={p.observacion} onChange={(e) => updatePractica(idx, { observacion: e.target.value })} />
                      </TableCell>
                      <TableCell>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removePractica(idx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notas clínicas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Diagnóstico</Label>
              <Textarea value={form.diagnostico} onChange={(e) => set("diagnostico", e.target.value)} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Indicaciones</Label>
              <Textarea value={form.indicaciones} onChange={(e) => set("indicaciones", e.target.value)} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Observaciones</Label>
              <Textarea value={form.observaciones} onChange={(e) => set("observaciones", e.target.value)} rows={2} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate("/atenciones")}>Cancelar</Button>
          <Button type="submit" disabled={submitting}>{submitting ? "Guardando..." : "Guardar"}</Button>
        </div>
      </form>

      <PrestacionQuickDialog open={quickOpen} onOpenChange={setQuickOpen} onCreated={onPrestacionCreada} />
    </div>
  );
}
