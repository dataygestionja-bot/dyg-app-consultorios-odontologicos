import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, ExternalLink } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

interface Row {
  id: string;
  fecha: string;
  integracion_codigo: string;
  numero_receta: string | null;
  link: string | null;
  archivo_url: string | null;
  observaciones: string | null;
  profesional: { nombre: string; apellido: string } | null;
}

export default function HistorialRecetasExternas({ pacienteId }: { pacienteId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .from("recetas_externas")
      .select("id, fecha, integracion_codigo, numero_receta, link, archivo_url, observaciones, profesional:profesionales(nombre, apellido)")
      .eq("paciente_id", pacienteId)
      .order("fecha", { ascending: false })
      .then(({ data }) => {
        if (cancelled) return;
        setRows(((data ?? []) as unknown) as Row[]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pacienteId]);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recetas externas</CardTitle>
        <CardDescription>Recetas emitidas en plataformas externas para este paciente</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead className="hidden md:table-cell">Profesional</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead>Nº</TableHead>
                <TableHead>Link / Archivo</TableHead>
                <TableHead className="hidden lg:table-cell">Observaciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">Cargando...</TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">Sin recetas externas registradas</TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{format(parseISO(r.fecha), "dd/MM/yyyy", { locale: es })}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {r.profesional ? `${r.profesional.apellido}, ${r.profesional.nombre}` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="uppercase">{r.integracion_codigo}</Badge>
                    </TableCell>
                    <TableCell>{r.numero_receta || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-2 items-center">
                        {r.link && (
                          <a href={r.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1 text-sm">
                            Link <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {r.archivo_url && (
                          <button type="button" onClick={() => abrirArchivo(r.archivo_url!)} className="text-primary hover:underline inline-flex items-center gap-1 text-sm">
                            <FileText className="h-3 w-3" /> Archivo
                          </button>
                        )}
                        {!r.link && !r.archivo_url && <span className="text-muted-foreground text-sm">—</span>}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell max-w-[240px]">
                      <div className="truncate text-sm" title={r.observaciones ?? ""}>{r.observaciones ?? "—"}</div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
