import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import rctaLogoFallback from "@/assets/rcta-logo.jpg";

interface Integracion {
  id: string;
  codigo: string;
  nombre: string;
  url: string;
  logo_url: string | null;
  activa: boolean;
  abrir_nueva_pestana: boolean;
}

export default function Integraciones() {
  const [items, setItems] = useState<Integracion[]>([]);
  const [loading, setLoading] = useState(true);

  const cargar = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("integraciones_externas")
      .select("*")
      .order("nombre");
    setItems((data as Integracion[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    cargar();
  }, []);

  const guardar = async (it: Integracion) => {
    const { error } = await supabase
      .from("integraciones_externas")
      .update({
        nombre: it.nombre,
        url: it.url,
        activa: it.activa,
        abrir_nueva_pestana: it.abrir_nueva_pestana,
        logo_url: it.logo_url,
      })
      .eq("id", it.id);
    if (error) {
      toast.error("No se pudo guardar", { description: error.message });
      return;
    }
    toast.success("Integración actualizada");
    cargar();
  };

  const subirLogo = async (it: Integracion, file: File) => {
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${it.codigo}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("integraciones-logos")
      .upload(path, file, { upsert: true });
    if (upErr) {
      toast.error("No se pudo subir el logo", { description: upErr.message });
      return;
    }
    const { data } = supabase.storage.from("integraciones-logos").getPublicUrl(path);
    await guardar({ ...it, logo_url: data.publicUrl });
  };

  if (loading) return <div className="p-6 text-muted-foreground">Cargando...</div>;

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold">Integraciones externas</h1>
        <p className="text-sm text-muted-foreground">
          Configurá las plataformas externas que se muestran en las atenciones.
        </p>
      </div>

      {items.map((it) => (
        <IntegracionEditor
          key={it.id}
          integracion={it}
          onGuardar={guardar}
          onSubirLogo={(f) => subirLogo(it, f)}
        />
      ))}
    </div>
  );
}

function IntegracionEditor({
  integracion,
  onGuardar,
  onSubirLogo,
}: {
  integracion: Integracion;
  onGuardar: (it: Integracion) => void;
  onSubirLogo: (f: File) => void;
}) {
  const [form, setForm] = useState(integracion);

  useEffect(() => setForm(integracion), [integracion]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-3">
          <img
            src={form.logo_url || rctaLogoFallback}
            alt={form.nombre}
            className="h-8 w-auto object-contain rounded"
          />
          {form.nombre}
          <span className="text-xs text-muted-foreground uppercase">({form.codigo})</span>
        </CardTitle>
        <CardDescription>Configuración de la integración</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Nombre</Label>
          <Input
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>URL</Label>
          <Input
            type="url"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Logo (imagen)</Label>
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onSubirLogo(f);
            }}
          />
          {form.logo_url && (
            <p className="text-xs text-muted-foreground truncate">{form.logo_url}</p>
          )}
        </div>
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <Label className="text-sm">Integración activa</Label>
            <p className="text-xs text-muted-foreground">Si está apagada, no se muestra a los profesionales.</p>
          </div>
          <Switch
            checked={form.activa}
            onCheckedChange={(v) => setForm({ ...form, activa: v })}
          />
        </div>
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <Label className="text-sm">Abrir en nueva pestaña</Label>
            <p className="text-xs text-muted-foreground">Recomendado para no perder la atención.</p>
          </div>
          <Switch
            checked={form.abrir_nueva_pestana}
            onCheckedChange={(v) => setForm({ ...form, abrir_nueva_pestana: v })}
          />
        </div>
        <div className="sm:col-span-2 flex justify-end">
          <Button onClick={() => onGuardar(form)}>Guardar cambios</Button>
        </div>
      </CardContent>
    </Card>
  );
}
