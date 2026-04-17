import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import CobroDialog from "@/components/cobros/CobroDialog";

const MEDIO_LABEL: Record<string, string> = {
  efectivo: "Efectivo", transferencia: "Transferencia", debito: "Débito",
  credito: "Crédito", mercadopago: "MercadoPago", otro: "Otro",
};

interface PacienteOpt { id: string; nombre: string; apellido: string; dni: string }

interface Row {
  id: string;
  fecha: string;
  importe: number;
  medio_pago: string;
  referencia: string | null;
  paciente: { nombre: string; apellido: string } | null;
}

export default function Cobros() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [pacientes, setPacientes] = useState<PacienteOpt[]>([]);

  const [filterDesde, setFilterDesde] = useState("");
  const [filterHasta, setFilterHasta] = useState("");
  const [filterPaciente, setFilterPaciente] = useState("");

  useEffect(() => {
    document.title = "Cobros | Consultorio";
    cargar();
    cargarPacientes();
  }, []);

  async function cargar() {
    setLoading(true);
    let q = supabase
      .from("cobros")
      .select("id, fecha, importe, medio_pago, referencia, paciente:pacientes(nombre,apellido)")
      .order("fecha", { ascending: false });
    if (filterDesde) q = q.gte("fecha", filterDesde);
    if (filterHasta) q = q.lte("fecha", filterHasta);
    if (filterPaciente) q = q.eq("paciente_id", filterPaciente);
    const { data, error } = await q;
    if (error) toast.error("Error al cargar", { description: error.message });
    setRows((data ?? []) as any);
    setLoading(false);
  }

  async function cargarPacientes() {
    const { data } = await supabase.from("pacientes").select("id,nombre,apellido,dni").eq("activo", true).order("apellido");
    setPacientes((data ?? []) as PacienteOpt[]);
  }

  const totalDia = rows
    .filter((r) => r.fecha === new Date().toISOString().slice(0, 10))
    .reduce((acc, r) => acc + Number(r.importe), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cobros</h1>
          <p className="text-sm text-muted-foreground">Registro de pagos y aplicación a presupuestos</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nuevo cobro</Button>
        <CobroDialog open={open} onOpenChange={setOpen} onSaved={cargar} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="space-y-2">
            <Label>Desde</Label>
            <Input type="date" value={filterDesde} onChange={(e) => setFilterDesde(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Hasta</Label>
            <Input type="date" value={filterHasta} onChange={(e) => setFilterHasta(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Paciente</Label>
            <Select value={filterPaciente || "todos"} onValueChange={(v) => setFilterPaciente(v === "todos" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {pacientes.map((p) => <SelectItem key={p.id} value={p.id}>{p.apellido}, {p.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={cargar}>Aplicar</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Listado</CardTitle>
          <div className="text-sm text-muted-foreground">
            Caja del día: <span className="font-mono font-semibold">${totalDia.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Medio</TableHead>
                <TableHead>Referencia</TableHead>
                <TableHead className="text-right">Importe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sin resultados</TableCell></TableRow>
              ) : rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{new Date(r.fecha).toLocaleDateString("es-AR")}</TableCell>
                  <TableCell className="font-medium">{r.paciente ? `${r.paciente.apellido}, ${r.paciente.nombre}` : "-"}</TableCell>
                  <TableCell><Badge variant="secondary">{MEDIO_LABEL[r.medio_pago] ?? r.medio_pago}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{r.referencia ?? "-"}</TableCell>
                  <TableCell className="text-right font-mono">${Number(r.importe).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
