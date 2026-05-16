import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface RecetaExterna {
  id: string;
  numero_receta: string | null;
  link: string | null;
  archivo_url: string | null;
  observaciones: string | null;
  fecha: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  atencionId: string;
  pacienteId: string;
  profesionalId: string;
  receta?: RecetaExterna | null;
  onSaved: () => void;
}

export function RecetaExternaDialog({
  open,
  onOpenChange,
  atencionId,
  pacienteId,
  profesionalId,
  receta,
  onSaved,
}: Props) {
  const [numero, setNumero] = useState("");
  const [link, setLink] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setNumero(receta?.numero_receta ?? "");
      setLink(receta?.link ?? "");
      setObservaciones(receta?.observaciones ?? "");
      setArchivo(null);
    }
  }, [open, receta]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      let archivoUrl: string | null = receta?.archivo_url ?? null;
      if (archivo) {
        const ext = archivo.name.split(".").pop() ?? "bin";
        const path = `${atencionId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("recetas-externas")
          .upload(path, archivo, { upsert: false });
        if (upErr) throw upErr;
        archivoUrl = path;
      }

      const payload = {
        atencion_id: atencionId,
        paciente_id: pacienteId,
        profesional_id: profesionalId,
        integracion_codigo: "rcta",
        numero_receta: numero || null,
        link: link || null,
        archivo_url: archivoUrl,
        observaciones: observaciones || null,
      };

      if (receta) {
        const { error } = await supabase
          .from("recetas_externas")
          .update(payload)
          .eq("id", receta.id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
          .from("recetas_externas")
          .insert({ ...payload, created_by: user?.id });
        if (error) throw error;
      }

      toast.success(receta ? "Receta actualizada" : "Receta registrada");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("No se pudo guardar la receta", { description: e?.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{receta ? "Editar receta externa" : "Registrar receta externa"}</DialogTitle>
          <DialogDescription>
            Registre los datos de la receta emitida en RCTA para esta atención.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="rx-numero">Número de receta</Label>
            <Input id="rx-numero" value={numero} onChange={(e) => setNumero(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rx-link">Link</Label>
            <Input
              id="rx-link"
              type="url"
              placeholder="https://..."
              value={link}
              onChange={(e) => setLink(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rx-archivo">Archivo adjunto (PDF, imagen)</Label>
            <Input
              id="rx-archivo"
              type="file"
              accept=".pdf,image/*"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            />
            {receta?.archivo_url && !archivo && (
              <p className="text-xs text-muted-foreground">Ya hay un archivo cargado.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rx-obs">Observaciones</Label>
            <Textarea
              id="rx-obs"
              rows={3}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
