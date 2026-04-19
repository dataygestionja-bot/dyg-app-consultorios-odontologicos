import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Eye } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface Row {
  id: string;
  fecha: string;
  motivo: string | null;
  diagnostico: string | null;
  paciente: { nombre: string; apellido: string } | null;
  profesional: { nombre: string; apellido: string } | null;
}

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
        .select("id, fecha, motivo, diagnostico, paciente:pacientes(nombre, apellido), profesional:profesionales(nombre, apellido)")
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
      (r.motivo ?? "").toLowerCase().includes(s) ||
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Profesional</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Diagnóstico</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sin atenciones</TableCell></TableRow>
              ) : (
                filtered.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{format(parseISO(a.fecha), "dd/MM/yyyy", { locale: es })}</TableCell>
                    <TableCell className="font-medium">
                      {a.paciente ? `${a.paciente.apellido}, ${a.paciente.nombre}` : "—"}
                    </TableCell>
                    <TableCell>
                      {a.profesional ? `${a.profesional.apellido}, ${a.profesional.nombre}` : "—"}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">{a.motivo ?? "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{a.diagnostico ?? "—"}</TableCell>
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
        </CardContent>
      </Card>
    </div>
  );
}
