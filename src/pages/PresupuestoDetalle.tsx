import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ArrowLeft, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const ESTADOS = ["borrador", "entregado", "aceptado", "rechazado", "parcialmente_ejecutado", "finalizado"] as const;
const ESTADO_LABEL: Record<string, string> = {
  borrador: "Borrador", entregado: "Entregado", aceptado: "Aceptado",
  rechazado: "Rechazado", parcialmente_ejecutado: "Parcialmente ejecutado", finalizado: "Finalizado",
};

interface Prestacion { id: string; codigo: string; descripcion: string; precio_base: number }
interface Profesional { id: string; nombre: string; apellido: string }
interface Detalle {
  id: string;
  prestacion_id: string;
  pieza_dental: string | null;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  prestacion: { codigo: string; descripcion: string } | null;
}

export default function PresupuestoDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [presupuesto, setPresupuesto] = useState<any>(null);
  const [paciente, setPaciente] = useState<any>(null);
  const [detalles, setDetalles] = useState<Detalle[]>([]);
  const [prestaciones, setPrestaciones] = useState<Prestacion[]>([]);
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);

  // form item
  const [prestId, setPrestId] = useState("");
  const [pieza, setPieza] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [precio, setPrecio] = useState(0);

  useEffect(() => {
    document.title = "Presupuesto | Consultorio";
    cargar();
  }, [id]);

  async function cargar() {
    if (!id) return;
    setLoading(true);
    const [{ data: pres }, { data: det }, { data: prest }, { data: profs }] = await Promise.all([
      supabase.from("presupuestos").select("*, paciente:pacientes(*)").eq("id", id).single(),
      supabase.from("presupuesto_detalle").select("*, prestacion:prestaciones(codigo,descripcion)").eq("presupuesto_id", id).order("created_at"),
      supabase.from("prestaciones").select("id,codigo,descripcion,precio_base").eq("activo", true).order("codigo"),
      supabase.from("profesionales").select("id,nombre,apellido").eq("activo", true).order("apellido"),
    ]);
    setPresupuesto(pres);
    setPaciente(pres?.paciente ?? null);
    setDetalles((det ?? []) as any);
    setPrestaciones((prest ?? []) as any);
    setProfesionales((profs ?? []) as any);
    setLoading(false);
  }

  async function actualizarCabecera(patch: Record<string, any>) {
    if (!id) return;
    const { error } = await supabase.from("presupuestos").update(patch as any).eq("id", id);
    if (error) return toast.error("No se pudo guardar", { description: error.message });
    toast.success("Guardado");
    cargar();
  }

  function onPrestChange(v: string) {
    setPrestId(v);
    const p = prestaciones.find((x) => x.id === v);
    if (p) setPrecio(Number(p.precio_base));
  }

  async function agregarItem() {
    if (!id || !prestId) return toast.error("Seleccioná una prestación");
    const { error } = await supabase.from("presupuesto_detalle").insert({
      presupuesto_id: id,
      prestacion_id: prestId,
      pieza_dental: pieza.trim() || null,
      cantidad: Number(cantidad) || 1,
      precio_unitario: Number(precio) || 0,
    });
    if (error) return toast.error("No se pudo agregar", { description: error.message });
    setPrestId(""); setPieza(""); setCantidad(1); setPrecio(0);
    cargar();
  }

  async function eliminarItem(detId: string) {
    const { error } = await supabase.from("presupuesto_detalle").delete().eq("id", detId);
    if (error) return toast.error("No se pudo eliminar", { description: error.message });
    cargar();
  }

  if (loading) return <div className="text-muted-foreground">Cargando...</div>;
  if (!presupuesto) return <div className="text-muted-foreground">Presupuesto no encontrado</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/presupuestos")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Presupuesto {paciente ? `— ${paciente.apellido}, ${paciente.nombre}` : ""}
            </h1>
            <p className="text-sm text-muted-foreground">
              Fecha: {new Date(presupuesto.fecha).toLocaleDateString("es-AR")} · DNI: {paciente?.dni}
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="text-sm">{ESTADO_LABEL[presupuesto.estado]}</Badge>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Cabecera</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Estado</Label>
            <Select value={presupuesto.estado} onValueChange={(v) => actualizarCabecera({ estado: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ESTADOS.map((e) => <SelectItem key={e} value={e}>{ESTADO_LABEL[e]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Profesional</Label>
            <Select
              value={presupuesto.profesional_id ?? ""}
              onValueChange={(v) => actualizarCabecera({ profesional_id: v || null })}
            >
              <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
              <SelectContent>
                {profesionales.map((p) => <SelectItem key={p.id} value={p.id}>{p.apellido}, {p.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-3">
            <Label>Observaciones</Label>
            <Textarea
              defaultValue={presupuesto.observaciones ?? ""}
              onBlur={(e) => {
                if (e.target.value !== (presupuesto.observaciones ?? "")) {
                  actualizarCabecera({ observaciones: e.target.value || null });
                }
              }}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Ítems del presupuesto</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end p-3 rounded-md border bg-muted/30">
            <div className="md:col-span-5 space-y-2">
              <Label>Prestación</Label>
              <Select value={prestId} onValueChange={onPrestChange}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {prestaciones.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.codigo} — {p.descripcion}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Pieza</Label>
              <Input value={pieza} onChange={(e) => setPieza(e.target.value)} placeholder="Ej: 16" />
            </div>
            <div className="md:col-span-1 space-y-2">
              <Label>Cant.</Label>
              <Input type="number" min="1" value={cantidad} onChange={(e) => setCantidad(parseInt(e.target.value) || 1)} />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Precio unit.</Label>
              <Input type="number" min="0" step="0.01" value={precio} onChange={(e) => setPrecio(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="md:col-span-2">
              <Button onClick={agregarItem} className="w-full"><Plus className="h-4 w-4" /> Agregar</Button>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Pieza</TableHead>
                <TableHead className="text-right">Cant.</TableHead>
                <TableHead className="text-right">P. unit.</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detalles.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Sin ítems</TableCell></TableRow>
              ) : detalles.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-sm">{d.prestacion?.codigo}</TableCell>
                  <TableCell>{d.prestacion?.descripcion}</TableCell>
                  <TableCell>{d.pieza_dental ?? "-"}</TableCell>
                  <TableCell className="text-right">{d.cantidad}</TableCell>
                  <TableCell className="text-right font-mono">${Number(d.precio_unitario).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right font-mono">${Number(d.subtotal).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => eliminarItem(d.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex justify-end pt-2 border-t">
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Total</div>
              <div className="text-2xl font-bold font-mono">
                ${Number(presupuesto.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
