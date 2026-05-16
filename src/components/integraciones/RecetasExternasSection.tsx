import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, Pencil, Plus, Trash2, ExternalLink } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { usePermissions } from "@/hooks/usePermissions";
import { RecetaExternaDialog } from "./RecetaExternaDialog";
import { toast } from "sonner";

interface RecetaRow {
  id: string;
  fecha: string;
  integracion_codigo: string;
  numero_receta: string | null;
  link: string | null;
  archivo_url: string | null;
  observaciones: string | null;
  profesional: { nombre: string; apellido: string } | null;
}

interface Props {
  atencionId: string;
  pacienteId: string;
  profesionalId: string;
}

export function RecetasExternasSection({ atencionId, pacienteId, profesionalId }: Props) {
  const { can } = usePermissions();
  const [rows, setRows] = useState<RecetaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RecetaRow | null>(null);

  const canCreate = can("recetas_externas", "create");
  const canUpdate = can("recetas_externas", "update");
  const canDelete = can("recetas_externas", "delete");

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("recetas_externas")
      .select("id, fecha, integracion_codigo, numero_receta, link, archivo_url, observaciones, profesional:profesionales(nombre, apellido)")
      .eq("atencion_id", atencionId)
      .order("fecha", { ascending: false });
    setRows((data as any) ?? []);
    setLoading(false);
  }, [atencionId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const abrirArchivo = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("recetas-externas")
      .createSignedUrl(path, 60);
    if (error || !data) {
      toast.error("No se pudo abrir el archivo");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const eliminar = async (r: RecetaRow) => {
    if (!confirm("¿Eliminar esta receta registrada?")) return;
    const { error } = await supabase.from("recetas_externas").delete().eq("id", r.id);
    if (error) {
      toast.error("No se pudo eliminar", { description: error.message });
      return;
    }
    if (r.archivo_url) {
      await supabase.storage.from("recetas-externas").remove([r.archivo_url]);
    }
    toast.success("Receta eliminada");
    cargar();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">Recetas registradas</CardTitle>
          <CardDescription>Recetas emitidas en plataformas externas</CardDescription>
        </div>
        {canCreate && (
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Agregar receta
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin recetas registradas.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="hidden sm:table-cell">Profesional</TableHead>
                  <TableHead>Plataforma</TableHead>
                  <TableHead>Nº</TableHead>
                  <TableHead>Link / Archivo</TableHead>
                  <TableHead className="hidden md:table-cell">Observaciones</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{format(parseISO(r.fecha), "dd/MM/yyyy", { locale: es })}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {r.profesional ? `${r.profesional.apellido}, ${r.profesional.nombre}` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="uppercase">{r.integracion_codigo}</Badge>
                    </TableCell>
                    <TableCell>{r.numero_receta || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-2 items-center">
                        {r.link && (
                          <a
                            href={r.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline inline-flex items-center gap-1 text-sm"
                          >
                            Link <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {r.archivo_url && (
                          <button
                            type="button"
                            onClick={() => abrirArchivo(r.archivo_url!)}
                            className="text-primary hover:underline inline-flex items-center gap-1 text-sm"
                          >
                            <FileText className="h-3 w-3" /> Archivo
                          </button>
                        )}
                        {!r.link && !r.archivo_url && <span className="text-muted-foreground text-sm">—</span>}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell max-w-[200px]">
                      <div className="truncate text-sm" title={r.observaciones ?? ""}>
                        {r.observaciones ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {canUpdate && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setEditing(r);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button size="icon" variant="ghost" onClick={() => eliminar(r)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <RecetaExternaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        atencionId={atencionId}
        pacienteId={pacienteId}
        profesionalId={profesionalId}
        receta={editing as any}
        onSaved={cargar}
      />
    </Card>
  );
}
