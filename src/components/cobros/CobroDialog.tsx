import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const MEDIOS = ["efectivo", "transferencia", "debito", "credito", "mercadopago", "otro"] as const;
const MEDIO_LABEL: Record<string, string> = {
  efectivo: "Efectivo", transferencia: "Transferencia", debito: "Débito",
  credito: "Crédito", mercadopago: "MercadoPago", otro: "Otro",
};

interface PacienteOpt { id: string; nombre: string; apellido: string; dni: string }
interface PresupuestoOpt { id: string; fecha: string; total: number; aplicado: number }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Si se provee, el paciente queda fijo (no editable) */
  pacienteId?: string;
  onSaved?: () => void;
}

export default function CobroDialog({ open, onOpenChange, pacienteId: fixedPacienteId, onSaved }: Props) {
  const [pacientes, setPacientes] = useState<PacienteOpt[]>([]);
  const [presupuestos, setPresupuestos] = useState<PresupuestoOpt[]>([]);

  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [pacienteId, setPacienteId] = useState("");
  const [importe, setImporte] = useState(0);
  const [medio, setMedio] = useState<string>("efectivo");
  const [referencia, setReferencia] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [presupuestoId, setPresupuestoId] = useState<string>("none");

  // Reset al abrir
  useEffect(() => {
    if (!open) return;
    setFecha(new Date().toISOString().slice(0, 10));
    setImporte(0);
    setMedio("efectivo");
    setReferencia("");
    setObservaciones("");
    setPresupuestoId("none");
    const pid = fixedPacienteId ?? "";
    setPacienteId(pid);
    if (pid) cargarPresupuestosPaciente(pid);
    else setPresupuestos([]);
    if (!fixedPacienteId) cargarPacientes();
  }, [open, fixedPacienteId]);

  async function cargarPacientes() {
    const { data } = await supabase
      .from("pacientes")
      .select("id,nombre,apellido,dni")
      .eq("activo", true)
      .order("apellido");
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
    onOpenChange(false);
    onSaved?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Registrar cobro</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="space-y-2">
            <Label>Fecha</Label>
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Paciente</Label>
            {fixedPacienteId ? (
              <Input value="Paciente actual" disabled />
            ) : (
              <Select value={pacienteId} onValueChange={onPacienteChange}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {pacientes.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.apellido}, {p.nombre} — {p.dni}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
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
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={guardar}>Registrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
