import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { PrestacionQuickDialog } from "@/components/prestaciones/PrestacionQuickDialog";
import { useAuth } from "@/hooks/useAuth";
import Odontograma from "@/components/paciente/Odontograma";
import HistorialAtenciones from "@/components/paciente/HistorialAtenciones";
import HistorialOdontograma from "@/components/paciente/HistorialOdontograma";
import { Badge } from "@/components/ui/badge";

interface Paciente { id: string; nombre: string; apellido: string; dni: string; alergias?: string | null; medicacion_actual?: string | null; antecedentes_medicos?: string | null; }
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
  const { hasRole } = useAuth();
  const isEdit = id && id !== "nuevo";
  const esProfRestringido = hasRole("profesional") && !hasRole("admin") && !hasRole("recepcion");
  const camposGeneralesBloqueados = !!isEdit && esProfRestringido;
  const [form, setForm] = useState(empty);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [prestaciones, setPrestaciones] = useState<Prestacion[]>([]);
  const [practicas, setPracticas] = useState<PracticaRow[]>([newPractica(1)]);
  const [submitting, setSubmitting] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickTargetIdx, setQuickTargetIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [turnosDisponibles, setTurnosDisponibles] = useState<TurnoOpcion[]>([]);

  // Helpers para mergear (sin duplicar) un registro a una lista
  function mergeUnique<T extends { id: string }>(list: T[], item: T | null | undefined): T[] {
    if (!item) return list;
    return list.some((x) => x.id === item.id) ? list : [...list, item];
  }

  useEffect(() => {
    document.title = isEdit ? "Editar atención | Consultorio" : "Nueva atención | Consultorio";
    let cancelled = false;

    async function cargar() {
      setLoading(true);

      // ============ FASE 1: Traer la atención (o el turno param) y obtener los IDs ============
      let pacienteIdActual: string | null = null;
      let profesionalIdActual: string | null = null;
      let turnoIdActual: string | null = null;
      let tipoActual: TipoAtencion = "con_turno";
      let formInicial = empty;
      let practicasIniciales: PracticaRow[] | null = null;

      if (isEdit) {
        const [{ data: at }, { data: prs }] = await Promise.all([
          supabase.from("atenciones").select("*").eq("id", id!).maybeSingle(),
          supabase.from("atencion_practicas").select("*").eq("atencion_id", id!).order("orden"),
        ]);

        if (cancelled) return;

        if (at) {
          pacienteIdActual = at.paciente_id;
          profesionalIdActual = at.profesional_id;
          turnoIdActual = at.turno_id;
          tipoActual = ((at as any).tipo_atencion ?? "con_turno") as TipoAtencion;
          formInicial = {
            paciente_id: at.paciente_id,
            profesional_id: at.profesional_id,
            fecha: at.fecha,
            diagnostico: at.diagnostico ?? "",
            indicaciones: at.indicaciones ?? "",
            observaciones: at.observaciones ?? "",
            proxima_visita_sugerida: (at as any).proxima_visita_sugerida ?? "",
            turno_id: at.turno_id,
            tipo_atencion: tipoActual,
          };
        }

        if (prs && prs.length > 0) {
          practicasIniciales = prs.map((p) => ({
            id: p.id,
            prestacion_id: p.prestacion_id,
            pieza_dental: p.pieza_dental ?? "",
            cara_dental: p.cara_dental ?? "",
            cantidad: p.cantidad,
            observacion: p.observacion ?? "",
            orden: p.orden,
          }));
        }
      } else if (turnoIdParam) {
        const { data: t } = await supabase
          .from("turnos")
          .select("id, paciente_id, profesional_id, fecha, hora_inicio, motivo_consulta")
          .eq("id", turnoIdParam)
          .maybeSingle();

        if (cancelled) return;

        if (t) {
          pacienteIdActual = t.paciente_id;
          profesionalIdActual = t.profesional_id;
          turnoIdActual = turnoIdParam;
          tipoActual = "con_turno";
          formInicial = {
            ...empty,
            paciente_id: t.paciente_id,
            profesional_id: t.profesional_id,
            fecha: t.fecha,
            turno_id: turnoIdParam,
            tipo_atencion: "con_turno",
          };
        }
      }

      // ============ FASE 2: Cargar listas y asegurar los valores vinculados en paralelo ============
      const [
        pacientesRes,
        profesionalesRes,
        prestacionesRes,
        pacienteVinculadoRes,
        profesionalVinculadoRes,
        turnoVinculadoRes,
      ] = await Promise.all([
        supabase.from("pacientes").select("id, nombre, apellido, dni, alergias, medicacion_actual, antecedentes_medicos").eq("activo", true).order("apellido"),
        supabase.from("profesionales").select("id, nombre, apellido").eq("activo", true).order("apellido"),
        supabase.from("prestaciones").select("id, codigo, descripcion, precio_base").eq("activo", true).order("codigo"),
        pacienteIdActual
          ? supabase.from("pacientes").select("id, nombre, apellido, dni, alergias, medicacion_actual, antecedentes_medicos").eq("id", pacienteIdActual).maybeSingle()
          : Promise.resolve({ data: null } as any),
        profesionalIdActual
          ? supabase.from("profesionales").select("id, nombre, apellido").eq("id", profesionalIdActual).maybeSingle()
          : Promise.resolve({ data: null } as any),
        turnoIdActual
          ? supabase
              .from("turnos")
              .select("id, fecha, hora_inicio, motivo_consulta, paciente_id, profesional_id")
              .eq("id", turnoIdActual)
              .maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);

      if (cancelled) return;

      // Merge: lista activa + el registro vinculado (aunque esté inactivo / atendido / filtrado por RLS list)
      const pacientesList = mergeUnique(
        (pacientesRes.data ?? []) as Paciente[],
        pacienteVinculadoRes.data as Paciente | null,
      );
      const profesionalesList = mergeUnique(
        (profesionalesRes.data ?? []) as Profesional[],
        profesionalVinculadoRes.data as Profesional | null,
      );
      const turnosList = turnoVinculadoRes.data
        ? [turnoVinculadoRes.data as TurnoOpcion]
        : [];

      // Validaciones de consistencia: si el turno vinculado no coincide, avisar
      if (turnoIdActual && !turnoVinculadoRes.data) {
        toast.warning("Turno vinculado no encontrado", {
          description: "La atención referencia un turno que ya no existe. Podés reasignarlo o cambiar el tipo de atención.",
        });
      } else if (
        turnoVinculadoRes.data &&
        pacienteIdActual &&
        (turnoVinculadoRes.data as any).paciente_id !== pacienteIdActual
      ) {
        toast.warning("Inconsistencia en el turno", {
          description: "El turno vinculado no corresponde al paciente de la atención.",
        });
      }

      // Aplicar todo el estado de una vez (evita renders intermedios con selects vacíos)
      setPacientes(pacientesList);
      setProfesionales(profesionalesList);
      setPrestaciones(((prestacionesRes.data ?? []) as any[]).map((p) => ({ ...p, precio_base: Number(p.precio_base) })));
      setTurnosDisponibles(turnosList);
      if (isEdit || turnoIdParam) setForm(formInicial);
      if (practicasIniciales) setPracticas(practicasIniciales);

      setLoading(false);
    }

    cargar();
    return () => {
      cancelled = true;
    };
  }, [id, isEdit, turnoIdParam]);

  // Cargar turnos disponibles del paciente cuando es "con_turno".
  // Importante: solo corre después de que terminó la fase 2 (loading=false),
  // así no pisa el turno vinculado que se cargó en la fase inicial.
  useEffect(() => {
    if (loading) return;
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
      .then(async ({ data }) => {
        let lista = (data ?? []) as TurnoOpcion[];
        // Si la atención ya tiene un turno vinculado que no quedó en la lista
        // (típicamente porque ya está en estado "atendido"), lo agregamos.
        if (form.turno_id && !lista.some((t) => t.id === form.turno_id)) {
          const { data: vinc } = await supabase
            .from("turnos")
            .select("id, fecha, hora_inicio, motivo_consulta, paciente_id, profesional_id")
            .eq("id", form.turno_id)
            .maybeSingle();
          if (vinc) lista = [...lista, vinc as TurnoOpcion];
        }
        setTurnosDisponibles(lista);
      });
  }, [loading, form.tipo_atencion, form.paciente_id, form.turno_id]);

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

    // 1) Paciente obligatorio + debe existir
    if (!form.paciente_id) {
      return toast.error("Falta el paciente", {
        description: "Seleccioná un paciente antes de guardar la atención.",
      });
    }
    const { data: pacOk } = await supabase
      .from("pacientes").select("id").eq("id", form.paciente_id).maybeSingle();
    if (!pacOk) {
      return toast.error("Paciente inválido", {
        description: "El paciente seleccionado no existe o ya no está disponible.",
      });
    }

    // 2) Profesional obligatorio + debe existir
    if (!form.profesional_id) {
      return toast.error("Falta el profesional", {
        description: "Seleccioná el profesional que realiza la atención.",
      });
    }
    const { data: profOk } = await supabase
      .from("profesionales").select("id").eq("id", form.profesional_id).maybeSingle();
    if (!profOk) {
      return toast.error("Profesional inválido", {
        description: "El profesional seleccionado no existe o ya no está disponible.",
      });
    }

    // 3) Fecha obligatoria
    if (!form.fecha) {
      return toast.error("Falta la fecha", { description: "Indicá la fecha de la atención." });
    }

    // 4) Coherencia tipo_atencion ↔ turno
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

    // 5) Si hay turno, validar que exista y que corresponda al paciente y profesional
    if (form.turno_id) {
      const { data: turno } = await supabase
        .from("turnos")
        .select("id, paciente_id, profesional_id")
        .eq("id", form.turno_id)
        .maybeSingle();
      if (!turno) {
        return toast.error("Turno inexistente", {
          description: "El turno seleccionado no existe o fue eliminado. Elegí otro o cambiá el tipo de atención.",
        });
      }
      if (turno.paciente_id !== form.paciente_id) {
        return toast.error("El turno no corresponde al paciente", {
          description: "El turno seleccionado pertenece a otro paciente. Verificá la selección.",
        });
      }
      if (turno.profesional_id !== form.profesional_id) {
        return toast.error("El turno no corresponde al profesional", {
          description: "El turno seleccionado fue asignado a otro profesional. Verificá la selección.",
        });
      }
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

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/atenciones")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEdit ? "Editar atención" : "Nueva atención"}
          </h1>
        </div>
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            Cargando datos de la atención...
          </CardContent>
        </Card>
      </div>
    );
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
        {/* Cabecera compacta */}
        <Card>
          <CardContent className="py-4">
            {turnoIdParam ? (
              <div className="grid gap-3 md:grid-cols-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Fecha</Label>
                  <div className="text-sm font-medium">
                    {form.fecha ? format(new Date(form.fecha + "T00:00:00"), "dd/MM/yyyy") : "—"}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Paciente</Label>
                  <div className="text-sm font-medium">
                    {(() => {
                      const p = pacientes.find((x) => x.id === form.paciente_id);
                      return p ? `${p.apellido}, ${p.nombre} · ${p.dni}` : "—";
                    })()}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Profesional</Label>
                  <Select
                    value={form.profesional_id}
                    onValueChange={(v) => set("profesional_id", v)}
                    disabled={camposGeneralesBloqueados}
                  >
                    <SelectTrigger className="h-8"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    <SelectContent>
                      {profesionales.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.apellido}, {p.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Tipo de atención</Label>
                  <div><Badge variant="secondary">{TIPO_ATENCION_LABELS[form.tipo_atencion]}</Badge></div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Fecha *</Label>
                    <Input type="date" value={form.fecha} onChange={(e) => set("fecha", e.target.value)} required disabled={camposGeneralesBloqueados} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Paciente *</Label>
                    <Select value={form.paciente_id} onValueChange={(v) => set("paciente_id", v)} required disabled={camposGeneralesBloqueados}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                      <SelectContent>
                        {pacientes.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.apellido}, {p.nombre} · {p.dni}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Profesional *</Label>
                    <Select value={form.profesional_id} onValueChange={(v) => set("profesional_id", v)} required disabled={camposGeneralesBloqueados}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                      <SelectContent>
                        {profesionales.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.apellido}, {p.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de atención *</Label>
                    <Select value={form.tipo_atencion} onValueChange={(v) => setTipoAtencion(v as TipoAtencion)} disabled={camposGeneralesBloqueados}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(TIPO_ATENCION_LABELS) as TipoAtencion[]).map((t) => (
                          <SelectItem key={t} value={t}>{TIPO_ATENCION_LABELS[t]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {form.tipo_atencion === "con_turno" && (
                  <div className="space-y-2">
                    <Label>Turno asociado *</Label>
                    <Select
                      value={form.turno_id ?? ""}
                      onValueChange={(v) => {
                        const turnoId = v || null;
                        const turno = turnoId ? turnosDisponibles.find((t) => t.id === turnoId) : null;
                        setForm((f) => ({
                          ...f,
                          turno_id: turnoId,
                          profesional_id: turno?.profesional_id ?? f.profesional_id,
                        }));
                      }}
                      disabled={!form.paciente_id || camposGeneralesBloqueados}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={!form.paciente_id ? "Primero seleccioná un paciente" : turnosDisponibles.length === 0 ? "Sin turnos disponibles" : "Seleccionar turno..."} />
                      </SelectTrigger>
                      <SelectContent>
                        {turnosDisponibles.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {format(new Date(t.fecha + "T00:00:00"), "dd/MM/yyyy")} · {t.hora_inicio?.slice(0, 5)} · {t.motivo_consulta}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Odontograma inline */}
        {form.paciente_id && (
          <Card>
            <CardContent className="py-4">
              <Odontograma
                pacienteId={form.paciente_id}
                mode="inline"
                profesionalId={form.profesional_id}
                fechaAtencion={form.fecha}
              />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <CardTitle className="text-base">Prácticas realizadas</CardTitle>
            <Button type="button" size="sm" onClick={addPractica}>
              <Plus className="h-4 w-4" /> Agregar fila
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Prestación</Label>
              {practicas.map((p, idx) => (
                <div key={idx} className="flex gap-2 items-center">
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
                  <Button type="button" variant="ghost" size="icon" onClick={() => removePractica(idx)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-1">
              <Label>Diagnóstico</Label>
              <Textarea value={form.diagnostico} onChange={(e) => set("diagnostico", e.target.value)} rows={2} />
            </div>
            <div className="space-y-1">
              <Label>Indicaciones</Label>
              <Textarea value={form.indicaciones} onChange={(e) => set("indicaciones", e.target.value)} rows={2} />
            </div>
            <div className="space-y-1 max-w-xs">
              <Label>Próxima visita sugerida</Label>
              <Input type="date" value={form.proxima_visita_sugerida}
                onChange={(e) => set("proxima_visita_sugerida", e.target.value)} disabled={camposGeneralesBloqueados} />
            </div>
          </CardContent>
        </Card>

        {/* Solapas: ficha clínica, historial odontograma, historial atenciones */}
        {form.paciente_id && (() => {
          const p = pacientes.find((x) => x.id === form.paciente_id);
          return (
            <Card>
              <CardContent className="py-4">
                <Tabs defaultValue="ficha">
                  <TabsList>
                    <TabsTrigger value="ficha">Ficha clínica</TabsTrigger>
                    <TabsTrigger value="odontograma">Historial odontograma</TabsTrigger>
                    <TabsTrigger value="atenciones">Historial de atenciones</TabsTrigger>
                  </TabsList>
                  <TabsContent value="ficha" className="grid gap-3 md:grid-cols-3 pt-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Alergias</Label>
                      <p className="text-sm whitespace-pre-wrap">{p?.alergias?.trim() || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Medicación actual</Label>
                      <p className="text-sm whitespace-pre-wrap">{p?.medicacion_actual?.trim() || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Antecedentes médicos</Label>
                      <p className="text-sm whitespace-pre-wrap">{p?.antecedentes_medicos?.trim() || "—"}</p>
                    </div>
                  </TabsContent>
                  <TabsContent value="odontograma" className="pt-4">
                    <HistorialOdontograma pacienteId={form.paciente_id} />
                  </TabsContent>
                  <TabsContent value="atenciones" className="pt-4">
                    <HistorialAtenciones pacienteId={form.paciente_id} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          );
        })()}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate("/atenciones")}>Cancelar</Button>
          <Button type="submit" disabled={submitting}>{submitting ? "Guardando..." : "Guardar"}</Button>
        </div>
      </form>

      <PrestacionQuickDialog open={quickOpen} onOpenChange={setQuickOpen} onCreated={onPrestacionCreada} />
    </div>
  );
}
