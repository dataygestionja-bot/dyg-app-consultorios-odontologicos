import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import CuentaCorriente from "@/components/paciente/CuentaCorriente";
import HistorialAtenciones from "@/components/paciente/HistorialAtenciones";
import Odontograma from "@/components/paciente/Odontograma";

interface ObraSocial { id: string; nombre: string; }

const empty = {
  nombre: "",
  apellido: "",
  dni: "",
  telefono: "",
  email: "",
  fecha_nacimiento: "",
  obra_social_id: "",
  numero_afiliado: "",
  domicilio: "",
  localidad: "",
  contacto_emergencia_nombre: "",
  contacto_emergencia_telefono: "",
  alergias: "",
  medicacion_actual: "",
  antecedentes_medicos: "",
  observaciones: "",
  activo: true,
};

export default function PacienteForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const isEdit = id && id !== "nuevo";
  const readOnly = !!isEdit && (searchParams.get("ver") === "1" || !can("pacientes", "update"));
  const [form, setForm] = useState(empty);
  const [obras, setObras] = useState<ObraSocial[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = readOnly
      ? "Ver paciente | Consultorio"
      : isEdit ? "Editar paciente | Consultorio" : "Nuevo paciente | Consultorio";
    supabase.from("obras_sociales").select("id, nombre").eq("activo", true).order("nombre")
      .then(({ data }) => setObras(data ?? []));
    if (isEdit) {
      setLoading(true);
      supabase.from("pacientes").select("*").eq("id", id).maybeSingle()
        .then(({ data }) => {
          if (data) {
            setForm({
              ...empty,
              ...data,
              obra_social_id: data.obra_social_id ?? "",
              telefono: data.telefono ?? "",
              email: data.email ?? "",
              fecha_nacimiento: data.fecha_nacimiento ?? "",
              numero_afiliado: data.numero_afiliado ?? "",
              domicilio: data.domicilio ?? "",
              localidad: data.localidad ?? "",
              contacto_emergencia_nombre: data.contacto_emergencia_nombre ?? "",
              contacto_emergencia_telefono: data.contacto_emergencia_telefono ?? "",
              alergias: data.alergias ?? "",
              medicacion_actual: data.medicacion_actual ?? "",
              antecedentes_medicos: data.antecedentes_medicos ?? "",
              observaciones: data.observaciones ?? "",
            });
          }
        })
        .then(() => setLoading(false));
    }
  }, [id, isEdit, readOnly]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      ...form,
      obra_social_id: form.obra_social_id || null,
      fecha_nacimiento: form.fecha_nacimiento || null,
      telefono: form.telefono || null,
      email: form.email || null,
      numero_afiliado: form.numero_afiliado || null,
      domicilio: form.domicilio || null,
      localidad: form.localidad || null,
      contacto_emergencia_nombre: form.contacto_emergencia_nombre || null,
      contacto_emergencia_telefono: form.contacto_emergencia_telefono || null,
      alergias: form.alergias || null,
      medicacion_actual: form.medicacion_actual || null,
      antecedentes_medicos: form.antecedentes_medicos || null,
      observaciones: form.observaciones || null,
    };

    const res = isEdit
      ? await supabase.from("pacientes").update(payload).eq("id", id!)
      : await supabase.from("pacientes").insert(payload);

    setSubmitting(false);
    if (res.error) return toast.error("No se pudo guardar", { description: res.error.message });
    toast.success(isEdit ? "Paciente actualizado" : "Paciente creado");
    navigate("/pacientes");
  }

  if (loading) return <div className="text-muted-foreground">Cargando...</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/pacientes")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {readOnly ? "Ver paciente" : isEdit ? "Editar paciente" : "Nuevo paciente"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {readOnly
              ? "Consulta de la ficha del paciente"
              : "Completá los datos del paciente y su ficha clínica"}
          </p>
        </div>
      </div>

      <form onSubmit={guardar}>
        <Tabs defaultValue="datos">
          <TabsList>
            <TabsTrigger value="datos">Datos personales</TabsTrigger>
            <TabsTrigger value="obra">Obra social</TabsTrigger>
            <TabsTrigger value="clinica">Ficha clínica</TabsTrigger>
            <TabsTrigger value="otros">Observaciones</TabsTrigger>
            {isEdit && <TabsTrigger value="atenciones">Atenciones</TabsTrigger>}
            {isEdit && <TabsTrigger value="cuenta">Cuenta corriente</TabsTrigger>}
          </TabsList>

          <TabsContent value="datos">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Datos personales</CardTitle>
                <CardDescription>Información básica de contacto</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <Field label="Nombre *" required value={form.nombre} onChange={(v) => set("nombre", v)} disabled={readOnly} />
                <Field label="Apellido *" required value={form.apellido} onChange={(v) => set("apellido", v)} disabled={readOnly} />
                <Field label="DNI *" required value={form.dni} onChange={(v) => set("dni", v)} disabled={readOnly} />
                <Field label="Fecha de nacimiento" type="date" value={form.fecha_nacimiento} onChange={(v) => set("fecha_nacimiento", v)} disabled={readOnly} />
                <Field label="Teléfono" value={form.telefono} onChange={(v) => set("telefono", v)} disabled={readOnly} />
                <Field label="Email" type="email" value={form.email} onChange={(v) => set("email", v)} disabled={readOnly} />
                <Field label="Domicilio" value={form.domicilio} onChange={(v) => set("domicilio", v)} disabled={readOnly} />
                <Field label="Localidad" value={form.localidad} onChange={(v) => set("localidad", v)} disabled={readOnly} />
                <Field label="Contacto emergencia" value={form.contacto_emergencia_nombre} onChange={(v) => set("contacto_emergencia_nombre", v)} disabled={readOnly} />
                <Field label="Tel. emergencia" value={form.contacto_emergencia_telefono} onChange={(v) => set("contacto_emergencia_telefono", v)} disabled={readOnly} />
                <div className="flex items-center justify-between md:col-span-2 pt-2">
                  <Label htmlFor="activo">Paciente activo</Label>
                  <Switch id="activo" checked={form.activo} onCheckedChange={(v) => set("activo", v)} disabled={readOnly} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="obra">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Obra social</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Obra social</Label>
                  <Select value={form.obra_social_id || "none"} onValueChange={(v) => set("obra_social_id", v === "none" ? "" : v)} disabled={readOnly}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Particular / Sin obra social</SelectItem>
                      {obras.map((o) => (
                        <SelectItem key={o.id} value={o.id}>{o.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Field label="Número de afiliado" value={form.numero_afiliado} onChange={(v) => set("numero_afiliado", v)} disabled={readOnly} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="clinica">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ficha clínica</CardTitle>
                <CardDescription>Datos médicos relevantes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <TextField label="Alergias" value={form.alergias} onChange={(v) => set("alergias", v)} disabled={readOnly} />
                <TextField label="Medicación actual" value={form.medicacion_actual} onChange={(v) => set("medicacion_actual", v)} disabled={readOnly} />
                <TextField label="Antecedentes médicos" value={form.antecedentes_medicos} onChange={(v) => set("antecedentes_medicos", v)} disabled={readOnly} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="otros">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Observaciones</CardTitle>
              </CardHeader>
              <CardContent>
                <TextField label="Observaciones generales" value={form.observaciones} onChange={(v) => set("observaciones", v)} rows={6} disabled={readOnly} />
              </CardContent>
            </Card>
          </TabsContent>

          {isEdit && (
            <TabsContent value="atenciones">
              <HistorialAtenciones pacienteId={id!} />
            </TabsContent>
          )}

          {isEdit && (
            <TabsContent value="cuenta">
              <CuentaCorriente pacienteId={id!} />
            </TabsContent>
          )}
        </Tabs>

        <div className="flex justify-end gap-2 mt-6">
          <Button type="button" variant="outline" onClick={() => navigate("/pacientes")}>
            {readOnly ? "Volver" : "Cancelar"}
          </Button>
          {!readOnly && (
            <Button type="submit" disabled={submitting}>{submitting ? "Guardando..." : "Guardar"}</Button>
          )}
        </div>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required, disabled }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} disabled={disabled} />
    </div>
  );
}

function TextField({ label, value, onChange, rows = 3, disabled }: {
  label: string; value: string; onChange: (v: string) => void; rows?: number; disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} disabled={disabled} />
    </div>
  );
}
