import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/hooks/usePermissions";

interface Row {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string | null;
  activo: boolean;
  obra_social: { nombre: string } | null;
}

export default function Pacientes() {
  const { can } = usePermissions();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState<"todos" | "activos" | "inactivos">("activos");

  useEffect(() => {
    document.title = "Pacientes | Consultorio";
    cargar();
  }, []);

  async function cargar() {
    setLoading(true);
    const { data } = await supabase
      .from("pacientes")
      .select("id, nombre, apellido, dni, telefono, activo, obra_social:obras_sociales(nombre)")
      .order("apellido");
    setRows((data ?? []) as unknown as Row[]);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (estado === "activos" && !r.activo) return false;
      if (estado === "inactivos" && r.activo) return false;
      if (!s) return true;
      return (
        r.nombre.toLowerCase().includes(s) ||
        r.apellido.toLowerCase().includes(s) ||
        r.dni.includes(s) ||
        (r.telefono ?? "").includes(s)
      );
    });
  }, [rows, search, estado]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pacientes</h1>
          <p className="text-sm text-muted-foreground">Gestión de pacientes del consultorio</p>
        </div>
        {can("pacientes", "create") && (
          <Button asChild>
            <Link to="/pacientes/nuevo"><Plus className="h-4 w-4" /> Nuevo paciente</Link>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Listado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 mb-4">
            <Input
              placeholder="Buscar por nombre, apellido, DNI o teléfono..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />
            <Select value={estado} onValueChange={(v) => setEstado(v as typeof estado)}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="activos">Activos</SelectItem>
                <SelectItem value="inactivos">Inactivos</SelectItem>
                <SelectItem value="todos">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Apellido y nombre</TableHead>
                <TableHead>DNI</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Obra social</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sin resultados</TableCell></TableRow>
              ) : (
                filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.apellido}, {p.nombre}</TableCell>
                    <TableCell>{p.dni}</TableCell>
                    <TableCell>{p.telefono ?? "—"}</TableCell>
                    <TableCell>{p.obra_social?.nombre ?? "—"}</TableCell>
                    <TableCell>
                      {p.activo ? <Badge>Activo</Badge> : <Badge variant="secondary">Inactivo</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      {can("pacientes", "update") && (
                        <Button asChild variant="ghost" size="sm">
                          <Link to={`/pacientes/${p.id}`}><Pencil className="h-4 w-4" /></Link>
                        </Button>
                      )}
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
