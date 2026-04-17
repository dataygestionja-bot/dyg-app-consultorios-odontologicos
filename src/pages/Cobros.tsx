import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const MEDIOS = ["efectivo", "transferencia", "debito", "credito", "mercadopago", "otro"] as const;
const MEDIO_LABEL: Record<string, string> = {
  efectivo: "Efectivo", transferencia: "Transferencia", debito: "Débito",
  credito: "Crédito", mercadopago: "MercadoPago", otro: "Otro",
};

interface PacienteOpt { id: string; nombre: string; apellido: string; dni: string }
interface PresupuestoOpt { id: string; fecha: string; total: number; aplicado: number }

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
  const [presupuestos, setPresupuestos] = useState<PresupuestoOpt[]>([]);

  // filtros
  const [filterDesde, setFilterDesde] = useState("");
  const [filterHasta, setFilterHasta] = useState("");
  const [filterPaciente, setFilterPaciente] = useState("");

  // form
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [pacienteId, setPacienteId] = useState("");
  const [importe, setImporte] = useState(0);
  const [medio, setMedio] = useState<string>("efectivo");
  const [referencia, setReferencia] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [presupuestoId, setPresupuestoId] = useState<string>("none");

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

  async function cargarPresupuestosPaciente(pid: string) {
    if (!pid) { setPresupuestos([]); return; }
    const { data: ps } = await supabase
      .from("presupuestos")
      .select("id,fecha,total")
      .eq("paciente_id", pid)
      .in("estado", ["aceptado", "parcialmente_ejecutado", "entregado"])
      .order("fecha", { ascending: false });
    if (!ps) { setPresupuestos([]); return; }
    const ids = ps.map((p) => p.id);
    const { data: aplics } = await supabase
      .from("cobro_aplicaciones")
      .select("presupuesto_id, importe_aplicado")
      .in("presupuesto_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const sumPorPres: Record<string, number> = {};
    (aplics ?? []).forEach((a) => {
      if (a.presupuesto_id) sumPorPres[a.presupuesto_id] = (sumPorPres[a.presupuesto_id] ?? 0) + Number(a.importe_aplicado);
    });
    setPresupuestos(ps.map((p) => ({
      id: p.id, fecha: p.fecha, total: Number(p.total), aplicado: sumPorPres[p.id] ?? 0,
    })));
  }

  function abrirNuevo() {
    setFecha(new Date().toISOString().slice(0, 10));
    setPacienteId(""); setImporte(0); setMedio("efectivo");
    setReferencia(""); setObservaciones(""); setPresupuestoId("none");
    setPresupuestos([]);
    setOpen(true);
  }

  async function onPacienteChange(v: string) {
    setPacienteId(v);
    setPresupuestoId("none");
    cargarPresupuestosPaciente(v);
  }

  async function guardar() {
    if (!pacienteId) return toast.error("Seleccioná un paciente");
    if (!importe || importe <= 0) return toast.error("Importe inválido");

    const userRes = await supabase.auth.getUser();
    const { data: cobro, error } = await supabase
      .from("cobros")
      .insert({
        fecha, paciente_id: pacienteId, importe, medio_pago: medio as any,
        referencia: referencia || null, observaciones: observaciones || null,
        usuario_registro: userRes.data.user?.id,
      })
      .select("id")
      .single();
    if (error) return toast.error("No se pudo guardar el cobro", { description: error.message });

    if (presupuestoId !== "none") {
      const { error: e2 } = await supabase.from("cobro_aplicaciones").insert({
        cobro_id: cobro.id,
        presupuesto_id: presupuestoId,
        importe_aplicado: importe,
      });
      if (e2) toast.error("Cobro registrado, pero no se pudo aplicar al presupuesto", { description: e2.message });
    }
    toast.success("Cobro registrado");
    setOpen(false);
    cargar();
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
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={abrirNuevo}><Plus className="h-4 w-4" /> Nuevo cobro</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Registrar cobro</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Paciente</Label>
                <Select value={pacienteId} onValueChange={onPacienteChange}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {pacientes.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.apellido}, {p.nombre} — {p.dni}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Importe</Label>
                <Input type="number" min="0" step="0.01" value={importe}
                  onChange={(e) => setImporte(parseFloat(e.target.value) || 0)} />
              </div>
              <div className="space-y-2">
                <Label>Medio de pago</Label>
                <Select value={medio} onValueChange={setMedio}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MEDIOS.map((m) => <SelectItem key={m} value={m}>{MEDIO_LABEL[m]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Aplicar a presupuesto (opcional)</Label>
                <Select value={presupuestoId} onValueChange={setPresupuestoId} disabled={!pacienteId}>
                  <SelectTrigger><SelectValue placeholder={pacienteId ? "Sin aplicar" : "Elegí un paciente primero"} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin aplicar (a cuenta)</SelectItem>
                    {presupuestos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {new Date(p.fecha).toLocaleDateString("es-AR")} · Total ${p.total.toLocaleString("es-AR")} · Saldo ${(p.total - p.aplicado).toLocaleString("es-AR")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Referencia</Label>
                <Input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="N° de operación, etc." />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Observaciones</Label>
                <Textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={guardar}>Registrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
