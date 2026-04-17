import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (prestacion: { id: string; codigo: string; descripcion: string; precio_base: number }) => void;
}

const empty = { codigo: "", descripcion: "", categoria: "", precio_base: 0, duracion_estimada_min: 30 };

export function PrestacionQuickDialog({ open, onOpenChange, onCreated }: Props) {
  const [form, setForm] = useState(empty);
  const [submitting, setSubmitting] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      codigo: form.codigo.trim(),
      descripcion: form.descripcion.trim(),
      categoria: form.categoria.trim() || null,
      precio_base: Number(form.precio_base) || 0,
      duracion_estimada_min: Number(form.duracion_estimada_min) || 30,
      activo: true,
    };
    const { data, error } = await supabase
      .from("prestaciones")
      .insert(payload)
      .select("id, codigo, descripcion, precio_base")
      .single();
    setSubmitting(false);
    if (error || !data) return toast.error("No se pudo crear", { description: error?.message });
    toast.success("Prestación creada");
    onCreated({ ...data, precio_base: Number(data.precio_base) });
    setForm(empty);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={guardar}>
          <DialogHeader>
            <DialogTitle>Nueva prestación</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Código *</Label>
              <Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Descripción *</Label>
              <Input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Precio base</Label>
              <Input type="number" min="0" step="0.01" value={form.precio_base}
                onChange={(e) => setForm({ ...form, precio_base: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>Duración (min)</Label>
              <Input type="number" min="5" step="5" value={form.duracion_estimada_min}
                onChange={(e) => setForm({ ...form, duracion_estimada_min: parseInt(e.target.value) || 30 })} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={submitting}>{submitting ? "Guardando..." : "Crear"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
