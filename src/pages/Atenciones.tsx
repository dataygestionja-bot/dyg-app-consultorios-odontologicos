import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye, ArrowUp, ArrowDown } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

type TipoAtencion = "con_turno" | "urgencia" | "espontanea";

interface Row {
  id: string;
  fecha: string;
  diagnostico: string | null;
  tipo_atencion: TipoAtencion;
  paciente: { nombre: string; apellido: string } | null;
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

export default function Atenciones() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    document.title = "Atenciones | Consultorio";
    cargar();
  }, []);

  async function cargar() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("atenciones")
        .select("id, fecha, diagnostico, tipo_atencion, paciente:pacientes(nombre, apellido), profesional:profesionales(nombre, apellido), turno:turnos(motivo_consulta)")
        .order("fecha", { ascending: false });
      if (error) console.error("Error cargando atenciones:", error);
      setRows((data ?? []) as unknown as Row[]);
    } catch (e) {
      console.error("Error inesperado cargando atenciones:", e);
    } finally {
      setLoading(false);
    }
  }

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (r.paciente && (`${r.paciente.apellido} ${r.paciente.nombre}`.toLowerCase().includes(s))) ||
      (r.turno?.motivo_consulta ?? "").toLowerCase().includes(s) ||
      (r.diagnostico ?? "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Atenciones</h1>
          <p className="text-sm text-muted-foreground">Historial de atenciones clínicas</p>
        </div>
        <Button asChild>
          <Link to="/atenciones/nuevo"><Plus className="h-4 w-4" /> Nueva atención</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Listado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="Buscar por paciente, motivo o diagnóstico..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Fecha</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead className="hidden lg:table-cell">Profesional</TableHead>
                  <TableHead className="whitespace-nowrap">Tipo</TableHead>
                  <TableHead className="min-w-[180px]">Motivo del turno</TableHead>
                  <TableHead className="hidden md:table-cell">Diagnóstico</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Cargando...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Sin atenciones</TableCell></TableRow>
                ) : (
                  filtered.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="whitespace-nowrap">{format(parseISO(a.fecha), "dd/MM/yyyy", { locale: es })}</TableCell>
                      <TableCell className="font-medium">
                        <div>{a.paciente ? `${a.paciente.apellido}, ${a.paciente.nombre}` : "—"}</div>
                        <div className="text-xs text-muted-foreground lg:hidden">
                          {a.profesional ? `${a.profesional.apellido}, ${a.profesional.nombre}` : "—"}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {a.profesional ? `${a.profesional.apellido}, ${a.profesional.nombre}` : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={TIPO_VARIANT[a.tipo_atencion]} className="whitespace-nowrap">
                          {TIPO_LABEL[a.tipo_atencion]}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[180px] sm:max-w-[240px]">
                        <div className="truncate" title={a.turno?.motivo_consulta ?? ""}>
                          {a.turno?.motivo_consulta ?? (a.tipo_atencion !== "con_turno" ? TIPO_LABEL[a.tipo_atencion] : "—")}
                        </div>
                        <div className="text-xs text-muted-foreground truncate md:hidden" title={a.diagnostico ?? ""}>
                          {a.diagnostico ?? ""}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell max-w-[200px] truncate">{a.diagnostico ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link to={`/atenciones/${a.id}`}><Eye className="h-4 w-4" /></Link>
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
    </div>
  );
}
