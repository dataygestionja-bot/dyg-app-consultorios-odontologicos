import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Eye } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

type TipoAtencion = "con_turno" | "urgencia" | "espontanea";

interface Row {
  id: string;
  fecha: string;
  diagnostico: string | null;
  tipo_atencion: TipoAtencion;
  profesional: { nombre: string; apellido: string } | null;
  turno: { motivo_consulta: string } | null;
}

const TIPO_LABEL: Record<TipoAtencion, string> = {
  con_turno: "Con turno",
  urgencia: "Urgencia",
  espontanea: "Espontánea",
};

const TIPO_VARIANT: Record<TipoAtencion, "default" | "destructive" | "secondary"> = {
  con_turno: "default",
  urgencia: "destructive",
  espontanea: "secondary",
};

export default function HistorialAtenciones({ pacienteId }: { pacienteId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .from("atenciones")
      .select("id, fecha, diagnostico, tipo_atencion, profesional:profesionales(nombre, apellido), turno:turnos(motivo_consulta)")
      .eq("paciente_id", pacienteId)
      .order("fecha", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error("Error cargando historial atenciones:", error);
        setRows((data ?? []) as unknown as Row[]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pacienteId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Historial de atenciones</CardTitle>
        <CardDescription>Atenciones clínicas registradas para este paciente</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Fecha</TableHead>
                <TableHead className="whitespace-nowrap">Tipo</TableHead>
                <TableHead className="hidden md:table-cell">Profesional</TableHead>
                <TableHead className="min-w-[160px]">Motivo</TableHead>
                <TableHead className="hidden lg:table-cell">Diagnóstico</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Cargando atenciones...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Sin atenciones registradas
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(parseISO(a.fecha), "dd/MM/yyyy", { locale: es })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={TIPO_VARIANT[a.tipo_atencion]} className="whitespace-nowrap">
                        {TIPO_LABEL[a.tipo_atencion]}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {a.profesional ? `${a.profesional.apellido}, ${a.profesional.nombre}` : "—"}
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <div className="truncate" title={a.turno?.motivo_consulta ?? ""}>
                        {a.turno?.motivo_consulta ?? (a.tipo_atencion !== "con_turno" ? TIPO_LABEL[a.tipo_atencion] : "—")}
                      </div>
                      <div className="text-xs text-muted-foreground truncate md:hidden">
                        {a.profesional ? `${a.profesional.apellido}, ${a.profesional.nombre}` : ""}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell max-w-[240px]">
                      <div className="truncate" title={a.diagnostico ?? ""}>
                        {a.diagnostico ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/atenciones/${a.id}/ver`} aria-label="Ver atención">
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
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
