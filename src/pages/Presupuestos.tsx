import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

const ESTADO_LABEL: Record<string, string> = {
  borrador: "Borrador",
  entregado: "Entregado",
  aceptado: "Aceptado",
  rechazado: "Rechazado",
  parcialmente_ejecutado: "Parcialmente ejecutado",
  finalizado: "Finalizado",
};

interface Row {
  id: string;
  fecha: string;
  estado: string;
  total: number;
  paciente: { nombre: string; apellido: string; dni: string } | null;
  profesional: { nombre: string; apellido: string } | null;
}

interface PacienteOpt { id: string; nombre: string; apellido: string; dni: string }

export default function Presupuestos() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [pacientes, setPacientes] = useState<PacienteOpt[]>([]);
  const [pacienteId, setPacienteId] = useState<string>("");
  const [filter, setFilter] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<string>("todos");

  useEffect(() => {
    document.title = "Presupuestos | Consultorio";
    cargar();
    cargarPacientes();
  }, []);

  async function cargar() {
    setLoading(true);
    const { data, error } = await supabase
      .from("presupuestos")
      .select("id, fecha, estado, total, paciente:pacientes(nombre,apellido,dni), profesional:profesionales(nombre,apellido)")
      .order("fecha", { ascending: false });
    if (error) toast.error("Error al cargar", { description: error.message });
    setRows((data ?? []) as any);
    setLoading(false);
  }

  async function cargarPacientes() {
    const { data } = await supabase.from("pacientes").select("id,nombre,apellido,dni").eq("activo", true).order("apellido");
    setPacientes((data ?? []) as PacienteOpt[]);
  }

  async function crear() {
    if (!pacienteId) return toast.error("Seleccioná un paciente");
    const { data, error } = await supabase
      .from("presupuestos")
      .insert({ paciente_id: pacienteId, estado: "borrador", created_by: (await supabase.auth.getUser()).data.user?.id })
      .select("id")
      .single();
    if (error) return toast.error("No se pudo crear", { description: error.message });
    setOpen(false);
    navigate(`/presupuestos/${data.id}`);
  }

  const filtered = rows.filter((r) => {
    const q = filter.toLowerCase();
    const pacText = r.paciente ? `${r.paciente.apellido} ${r.paciente.nombre} ${r.paciente.dni}`.toLowerCase() : "";
    const okText = !q || pacText.includes(q);
    const okEstado = estadoFilter === "todos" || r.estado === estadoFilter;
    return okText && okEstado;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Presupuestos</h1>
          <p className="text-sm text-muted-foreground">Planes de tratamiento y presupuestos por paciente</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4" /> Nuevo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuevo presupuesto</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Paciente</Label>
                <Select value={pacienteId} onValueChange={setPacienteId}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar paciente..." /></SelectTrigger>
                  <SelectContent>
                    {pacientes.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.apellido}, {p.nombre} — {p.dni}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={crear}>Crear y continuar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Listado</CardTitle></CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-3">
            <Input placeholder="Buscar por paciente o DNI..." value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-md" />
            <Select value={estadoFilter} onValueChange={setEstadoFilter}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                {Object.entries(ESTADO_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Profesional</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sin resultados</TableCell></TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{new Date(r.fecha).toLocaleDateString("es-AR")}</TableCell>
                    <TableCell className="font-medium">{r.paciente ? `${r.paciente.apellido}, ${r.paciente.nombre}` : "-"}</TableCell>
                    <TableCell>{r.profesional ? `${r.profesional.apellido}, ${r.profesional.nombre}` : "-"}</TableCell>
                    <TableCell><Badge variant="secondary">{ESTADO_LABEL[r.estado] ?? r.estado}</Badge></TableCell>
                    <TableCell className="text-right font-mono">${Number(r.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/presupuestos/${r.id}`}><ExternalLink className="h-4 w-4" /></Link>
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
