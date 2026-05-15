import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Pencil } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";

interface Row {
  id: string;
  nombre: string;
  apellido: string;
  matricula: string | null;
  especialidad: string | null;
  telefono: string | null;
  color_agenda: string;
  activo: boolean;
  foto_url: string | null;
}

export default function Profesionales() {
  const { can } = usePermissions();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Profesionales | Consultorio";
    cargar();
  }, []);

  async function cargar() {
    setLoading(true);
    const { data } = await supabase.from("profesionales").select("*").order("apellido");
    setRows((data ?? []) as Row[]);
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Profesionales</h1>
          <p className="text-sm text-muted-foreground">Equipo del consultorio y horarios de atención</p>
        </div>
        {can("profesionales", "create") && (
          <Button asChild>
            <Link to="/profesionales/nuevo"><Plus className="h-4 w-4" /> Nuevo profesional</Link>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Listado</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Apellido y nombre</TableHead>
                <TableHead>Matrícula</TableHead>
                <TableHead>Especialidad</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Sin profesionales cargados</TableCell></TableRow>
              ) : (
                rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          {p.foto_url && <AvatarImage src={p.foto_url} alt={`${p.apellido} ${p.nombre}`} />}
                          <AvatarFallback className="text-xs">{(p.apellido[0] ?? "") + (p.nombre[0] ?? "")}</AvatarFallback>
                        </Avatar>
                        <div className="h-3 w-3 rounded-full border" style={{ backgroundColor: p.color_agenda }} />
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{p.apellido}, {p.nombre}</TableCell>
                    <TableCell>{p.matricula ?? "—"}</TableCell>
                    <TableCell>{p.especialidad ?? "—"}</TableCell>
                    <TableCell>{p.telefono ?? "—"}</TableCell>
                    <TableCell>{p.activo ? <Badge>Activo</Badge> : <Badge variant="secondary">Inactivo</Badge>}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/profesionales/${p.id}`}><Pencil className="h-4 w-4" /></Link>
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
