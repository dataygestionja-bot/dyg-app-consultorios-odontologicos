import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";

interface Paciente { id: string; nombre: string; apellido: string; dni: string; }
interface Profesional { id: string; nombre: string; apellido: string; }

const empty = {
  paciente_id: "",
  profesional_id: "",
  fecha: format(new Date(), "yyyy-MM-dd"),
  motivo: "",
  diagnostico: "",
  tratamiento_realizado: "",
  indicaciones: "",
  observaciones: "",
  turno_id: null as string | null,
};

export default function AtencionForm() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const turnoIdParam = params.get("turno");
  const navigate = useNavigate();
  const isEdit = id && id !== "nuevo";
  const [form, setForm] = useState(empty);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = isEdit ? "Editar atención | Consultorio" : "Nueva atención | Consultorio";
    Promise.all([
      supabase.from("pacientes").select("id, nombre, apellido, dni").eq("activo", true).order("apellido"),
      supabase.from("profesionales").select("id, nombre, apellido").eq("activo", true).order("apellido"),
    ]).then(([pa, pr]) => {
      setPacientes((pa.data ?? []) as Paciente[]);
      setProfesionales((pr.data ?? []) as Profesional[]);
    });

    if (isEdit) {
      supabase.from("atenciones").select("*").eq("id", id).maybeSingle()
        .then(({ data }) => {
          if (data) setForm({
            paciente_id: data.paciente_id,
            profesional_id: data.profesional_id,
            fecha: data.fecha,
            motivo: data.motivo ?? "",
            diagnostico: data.diagnostico ?? "",
            tratamiento_realizado: data.tratamiento_realizado ?? "",
            indicaciones: data.indicaciones ?? "",
            observaciones: data.observaciones ?? "",
            turno_id: data.turno_id,
          });
        });
    } else if (turnoIdParam) {
      supabase.from("turnos").select("paciente_id, profesional_id, fecha, motivo_consulta").eq("id", turnoIdParam).maybeSingle()
        .then(({ data }) => {
          if (data) setForm((f) => ({
            ...f,
            paciente_id: data.paciente_id,
            profesional_id: data.profesional_id,
            fecha: data.fecha,
            motivo: data.motivo_consulta ?? "",
            turno_id: turnoIdParam,
          }));
        });
    }
  }, [id, isEdit, turnoIdParam]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      ...form,
      motivo: form.motivo || null,
      diagnostico: form.diagnostico || null,
      tratamiento_realizado: form.tratamiento_realizado || null,
      indicaciones: form.indicaciones || null,
      observaciones: form.observaciones || null,
    };
    const res = isEdit
      ? await supabase.from("atenciones").update(payload).eq("id", id!)
      : await supabase.from("atenciones").insert(payload);
    setSubmitting(false);
    if (res.error) return toast.error("No se pudo guardar", { description: res.error.message });
    toast.success(isEdit ? "Atención actualizada" : "Atención registrada");
    navigate("/atenciones");
  }

  return (
    <div className="space-y-6 max-w-3xl">
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

      <form onSubmit={guardar}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Datos clínicos</CardTitle>
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
              <div className="space-y-2 md:col-span-3">
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
            </div>

            <div className="space-y-2">
              <Label>Motivo</Label>
              <Textarea value={form.motivo} onChange={(e) => set("motivo", e.target.value)} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Diagnóstico</Label>
              <Textarea value={form.diagnostico} onChange={(e) => set("diagnostico", e.target.value)} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Tratamiento realizado</Label>
              <Textarea value={form.tratamiento_realizado} onChange={(e) => set("tratamiento_realizado", e.target.value)} rows={3} />
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

        <div className="flex justify-end gap-2 mt-6">
          <Button type="button" variant="outline" onClick={() => navigate("/atenciones")}>Cancelar</Button>
          <Button type="submit" disabled={submitting}>{submitting ? "Guardando..." : "Guardar"}</Button>
        </div>
      </form>
    </div>
  );
}
