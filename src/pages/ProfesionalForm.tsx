import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Plus, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { DIAS_SEMANA } from "@/lib/constants";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const COLOR_OPTIONS = [
  "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
];

interface Horario {
  id?: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  duracion_slot_min: number;
  activo: boolean;
}

const empty = {
  nombre: "",
  apellido: "",
  matricula: "",
  especialidad: "",
  telefono: "",
  email: "",
  color_agenda: "#0ea5e9",
  activo: true,
  foto_url: "" as string | "",
};

export default function ProfesionalForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = id && id !== "nuevo";
  const [form, setForm] = useState(empty);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    document.title = isEdit ? "Editar profesional | Consultorio" : "Nuevo profesional | Consultorio";
    if (isEdit) {
      supabase.from("profesionales").select("*").eq("id", id).maybeSingle()
        .then(({ data }) => {
          if (data) setForm({
            nombre: data.nombre, apellido: data.apellido,
            matricula: data.matricula ?? "", especialidad: data.especialidad ?? "",
            telefono: data.telefono ?? "", email: data.email ?? "",
            color_agenda: data.color_agenda, activo: data.activo,
            foto_url: (data as any).foto_url ?? "",
          });
        });
      supabase.from("horarios_profesional").select("*").eq("profesional_id", id).order("dia_semana")
        .then(({ data }) => setHorarios((data ?? []) as Horario[]));
    }
  }, [id, isEdit]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      ...form,
      matricula: form.matricula || null,
      especialidad: form.especialidad || null,
      telefono: form.telefono || null,
      email: form.email || null,
      foto_url: form.foto_url || null,
    };
    const res = isEdit
      ? await supabase.from("profesionales").update(payload).eq("id", id!)
      : await supabase.from("profesionales").insert(payload).select().single();
    setSubmitting(false);
    if (res.error) return toast.error("No se pudo guardar", { description: res.error.message });
    toast.success(isEdit ? "Profesional actualizado" : "Profesional creado");
    navigate("/profesionales");
  }

  async function onFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Debe ser una imagen");
    if (file.size > 2 * 1024 * 1024) return toast.error("Máximo 2 MB");
    if (!isEdit) return toast.error("Guardá primero el profesional");
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("profesionales-fotos").upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) { setUploading(false); return toast.error("No se pudo subir", { description: upErr.message }); }
    const { data: pub } = supabase.storage.from("profesionales-fotos").getPublicUrl(path);
    const url = pub.publicUrl;
    const { error: updErr } = await supabase.from("profesionales").update({ foto_url: url } as any).eq("id", id!);
    setUploading(false);
    if (updErr) return toast.error("No se pudo guardar la foto", { description: updErr.message });
    set("foto_url", url);
    toast.success("Foto actualizada");
  }

  async function quitarFoto() {
    if (!isEdit) return;
    const { error } = await supabase.from("profesionales").update({ foto_url: null } as any).eq("id", id!);
    if (error) return toast.error("Error", { description: error.message });
    set("foto_url", "");
    toast.success("Foto eliminada");
  }


  function addHorario() {
    setHorarios((h) => [...h, { dia_semana: 1, hora_inicio: "09:00", hora_fin: "13:00", duracion_slot_min: 30, activo: true }]);
  }

  async function saveHorario(idx: number) {
    if (!isEdit) return toast.error("Guardá primero el profesional");
    const h = horarios[idx];
    const payload = { ...h, profesional_id: id! };
    const res = h.id
      ? await supabase.from("horarios_profesional").update(payload).eq("id", h.id)
      : await supabase.from("horarios_profesional").insert(payload).select().single();
    if (res.error) return toast.error("Error", { description: res.error.message });
    if (!h.id && res.data) {
      setHorarios((arr) => arr.map((x, i) => i === idx ? { ...x, id: (res.data as Horario).id } : x));
    }
    toast.success("Horario guardado");
  }

  async function delHorario(idx: number) {
    const h = horarios[idx];
    if (h.id) {
      const { error } = await supabase.from("horarios_profesional").delete().eq("id", h.id);
      if (error) return toast.error("Error", { description: error.message });
    }
    setHorarios((arr) => arr.filter((_, i) => i !== idx));
  }

  function updateH(idx: number, patch: Partial<Horario>) {
    setHorarios((arr) => arr.map((h, i) => i === idx ? { ...h, ...patch } : h));
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/profesionales")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEdit ? "Editar profesional" : "Nuevo profesional"}
          </h1>
        </div>
      </div>

      <Tabs defaultValue="datos">
        <TabsList>
          <TabsTrigger value="datos">Datos</TabsTrigger>
          <TabsTrigger value="horarios" disabled={!isEdit}>Horarios</TabsTrigger>
        </TabsList>

        <TabsContent value="datos">
          <form onSubmit={guardar}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Datos del profesional</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2 flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    {form.foto_url && <AvatarImage src={form.foto_url} alt="Foto" />}
                    <AvatarFallback>{(form.apellido[0] ?? "") + (form.nombre[0] ?? "") || "?"}</AvatarFallback>
                  </Avatar>
                  <div className="space-y-2">
                    <Label className="block">Foto de perfil</Label>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" disabled={!isEdit || uploading} asChild>
                        <label className="cursor-pointer">
                          <Upload className="h-4 w-4" /> {uploading ? "Subiendo..." : "Subir foto"}
                          <input type="file" accept="image/*" className="hidden" onChange={onFotoChange} disabled={!isEdit || uploading} />
                        </label>
                      </Button>
                      {form.foto_url && (
                        <Button type="button" variant="ghost" size="sm" onClick={quitarFoto}>
                          <X className="h-4 w-4" /> Quitar
                        </Button>
                      )}
                    </div>
                    {!isEdit && <p className="text-xs text-muted-foreground">Guardá el profesional para poder subir la foto.</p>}
                  </div>
                </div>
                <Field label="Nombre *" required value={form.nombre} onChange={(v) => set("nombre", v)} />
                <Field label="Apellido *" required value={form.apellido} onChange={(v) => set("apellido", v)} />
                <Field label="Matrícula" value={form.matricula} onChange={(v) => set("matricula", v)} />
                <Field label="Especialidad" value={form.especialidad} onChange={(v) => set("especialidad", v)} />
                <Field label="Teléfono" value={form.telefono} onChange={(v) => set("telefono", v)} />
                <Field label="Email" type="email" value={form.email} onChange={(v) => set("email", v)} />

                <div className="space-y-2 md:col-span-2">
                  <Label>Color en agenda</Label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_OPTIONS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => set("color_agenda", c)}
                        className={`h-8 w-8 rounded-full border-2 transition ${form.color_agenda === c ? "ring-2 ring-offset-2 ring-ring" : ""}`}
                        style={{ backgroundColor: c, borderColor: form.color_agenda === c ? c : "transparent" }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between md:col-span-2 pt-2">
                  <Label htmlFor="activo">Profesional activo</Label>
                  <Switch id="activo" checked={form.activo} onCheckedChange={(v) => set("activo", v)} />
                </div>
              </CardContent>
            </Card>
            <div className="flex justify-end gap-2 mt-6">
              <Button type="button" variant="outline" onClick={() => navigate("/profesionales")}>Cancelar</Button>
              <Button type="submit" disabled={submitting}>{submitting ? "Guardando..." : "Guardar"}</Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="horarios">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Horarios de atención</CardTitle>
                <CardDescription>Días, horarios y duración de turnos</CardDescription>
              </div>
              <Button type="button" size="sm" onClick={addHorario}><Plus className="h-4 w-4" /> Agregar</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {horarios.length === 0 && (
                <p className="text-sm text-muted-foreground">No hay horarios cargados.</p>
              )}
              {horarios.map((h, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end p-3 border rounded-md">
                  <div className="md:col-span-3 space-y-1">
                    <Label className="text-xs">Día</Label>
                    <Select value={String(h.dia_semana)} onValueChange={(v) => updateH(idx, { dia_semana: Number(v) })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DIAS_SEMANA.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <Label className="text-xs">Desde</Label>
                    <Input type="time" value={h.hora_inicio} onChange={(e) => updateH(idx, { hora_inicio: e.target.value })} />
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <Label className="text-xs">Hasta</Label>
                    <Input type="time" value={h.hora_fin} onChange={(e) => updateH(idx, { hora_fin: e.target.value })} />
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <Label className="text-xs">Duración (min)</Label>
                    <Input type="number" min={5} step={5} value={h.duracion_slot_min} onChange={(e) => updateH(idx, { duracion_slot_min: Number(e.target.value) })} />
                  </div>
                  <div className="md:col-span-3 flex gap-2 justify-end">
                    <Button type="button" size="sm" onClick={() => saveHorario(idx)}>Guardar</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => delHorario(idx)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} />
    </div>
  );
}
