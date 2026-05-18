import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

interface DocRow {
  referencia: string;
  fecha: string;
  file: File | null;
}

const newRow = (): DocRow => ({
  referencia: "",
  fecha: format(new Date(), "yyyy-MM-dd"),
  file: null,
});

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  atencionId: string | null;
  onSaved?: () => void;
}

export function AgregarDocumentacionDialog({ open, onOpenChange, atencionId, onSaved }: Props) {
  const { user } = useAuth();
  const [rows, setRows] = useState<DocRow[]>([newRow()]);
  const [saving, setSaving] = useState(false);

  const reset = () => setRows([newRow()]);

  const update = (idx: number, patch: Partial<DocRow>) => {
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };
  const add = () => setRows((r) => [...r, newRow()]);
  const remove = (idx: number) => setRows((r) => (r.length === 1 ? [newRow()] : r.filter((_, i) => i !== idx)));

  const handleSave = async () => {
    if (!atencionId) {
      toast.error("Primero guardá la atención para poder adjuntar documentación.");
      return;
    }
    const valid = rows.filter((r) => r.referencia.trim() && r.file);
    if (!valid.length) {
      toast.error("Completá al menos una referencia y un archivo.");
      return;
    }
    setSaving(true);
    try {
      for (const row of valid) {
        const file = row.file!;
        const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
        const path = `${atencionId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("atencion-documentos")
          .upload(path, file, { contentType: file.type || undefined, upsert: false });
        if (upErr) throw upErr;
        const { error: insErr } = await supabase.from("atencion_documentos").insert({
          atencion_id: atencionId,
          referencia: row.referencia.trim(),
          fecha: row.fecha,
          archivo_path: path,
          archivo_nombre: file.name,
          archivo_mime: file.type || null,
          archivo_size: file.size,
          created_by: user?.id ?? null,
        });
        if (insErr) throw insErr;
      }
      toast.success(`Se ${valid.length === 1 ? "agregó 1 documento" : `agregaron ${valid.length} documentos`}.`);
      reset();
      onOpenChange(false);
      onSaved?.();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar la documentación.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!saving) onOpenChange(v); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Agregar documentación</DialogTitle>
          <DialogDescription>
            Adjuntá uno o más archivos relacionados a esta atención.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {rows.map((row, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-end border rounded-md p-3">
              <div className="col-span-12 md:col-span-5 space-y-1">
                <Label className="text-xs">Referencia</Label>
                <Input
                  value={row.referencia}
                  onChange={(e) => update(idx, { referencia: e.target.value })}
                  placeholder="Ej: Radiografía panorámica"
                  maxLength={200}
                />
              </div>
              <div className="col-span-6 md:col-span-3 space-y-1">
                <Label className="text-xs">Fecha</Label>
                <Input
                  type="date"
                  value={row.fecha}
                  onChange={(e) => update(idx, { fecha: e.target.value })}
                />
              </div>
              <div className="col-span-5 md:col-span-3 space-y-1">
                <Label className="text-xs">Archivo</Label>
                <label className="flex items-center gap-2 h-10 rounded-md border border-input bg-background px-3 text-sm cursor-pointer hover:bg-accent">
                  <Paperclip className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {row.file ? row.file.name : "Adjuntar"}
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => update(idx, { file: e.target.files?.[0] ?? null })}
                  />
                </label>
              </div>
              <div className="col-span-1 flex justify-end">
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(idx)} title="Quitar">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          <Button type="button" variant="outline" size="sm" onClick={add}>
            <Plus className="h-4 w-4" /> Agregar otro documento
          </Button>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
