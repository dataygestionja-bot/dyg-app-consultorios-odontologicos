import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

type MedioPago = "efectivo" | "transferencia" | "debito" | "credito" | "mercadopago" | "otro";

const MEDIO_PAGO_LABELS: Record<MedioPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  debito: "Débito",
  credito: "Crédito",
  mercadopago: "MercadoPago",
  otro: "Otro",
};

interface Pago { importe: number; }

interface PagoHoy {
  id: string;
  importe: number;
  medio_pago: string;
  referencia: string | null;
}

interface Orden {
  id: string;
  tipo_trabajo: string;
  estado: "enviado" | "entregado";
  fecha_estimada_entrega: string | null;
  costo_presupuestado: number;
  costo_final: number;
  laboratorio: { id: string; nombre: string } | null;
  paciente: { nombre: string; apellido: string } | null;
  pagos_laboratorio?: Pago[];
}

interface Props {
  orden: Orden | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}

export function EditarOrdenDialog({ orden, open, onOpenChange, onSaved }: Props) {
  const { user } = useAuth();
  const [estado, setEstado] = useState<"enviado" | "entregado">("enviado");
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [costoFinal, setCostoFinal] = useState("");
  const [nuevoPago, setNuevoPago] = useState("");
  const [medioPago, setMedioPago] = useState<MedioPago>("efectivo");
  const [referencia, setReferencia] = useState("");
  const [pagoAcumulado, setPagoAcumulado] = useState(0);
  const [guardando, setGuardando] = useState(false);

  // Pagos del día
  const [pagosHoy, setPagosHoy] = useState<PagoHoy[]>([]);
  const [pagoEditId, setPagoEditId] = useState<string | null>(null);
  const [editImporte, setEditImporte] = useState("");
  const [editMedio, setEditMedio] = useState<MedioPago>("efectivo");
  const [editRef, setEditRef] = useState("");
  const [guardandoEdit, setGuardandoEdit] = useState(false);

  useEffect(() => {
    if (!open || !orden) return;
    setEstado(orden.estado);
    setFechaEntrega(orden.fecha_estimada_entrega ?? "");
    setCostoFinal(String(orden.costo_final || orden.costo_presupuestado));
    setNuevoPago("");
    setMedioPago("efectivo");
    setReferencia("");
    setPagoEditId(null);
    cargarPagos();
  }, [open, orden]);

  async function cargarPagos() {
    if (!orden) return;
    const hoy = new Date().toISOString().slice(0, 10);
    const [{ data: todos }, { data: hoyData }] = await Promise.all([
      supabase.from("pagos_laboratorio").select("importe").eq("orden_id", orden.id),
      supabase.from("pagos_laboratorio")
        .select("id, importe, medio_pago, referencia")
        .eq("orden_id", orden.id)
        .eq("fecha", hoy)
        .order("created_at", { ascending: false }),
    ]);
    const total = (todos ?? []).reduce((s, p) => s + Number(p.importe), 0);
    setPagoAcumulado(total);
    setPagosHoy((hoyData ?? []) as PagoHoy[]);
    setPagoEditId(null);
  }

  function seleccionarPagoEditar(p: PagoHoy) {
    setPagoEditId(p.id);
    setEditImporte(String(p.importe));
    setEditMedio(p.medio_pago as MedioPago);
    setEditRef(p.referencia ?? "");
  }

  async function guardarEdicion() {
    if (!pagoEditId) return;
    if (!editImporte || parseFloat(editImporte) <= 0) return toast.error("Ingresá un importe válido");
    if (editMedio !== "efectivo" && editMedio !== "debito" && editMedio !== "credito" && !editRef.trim()) {
      return toast.error("Ingresá la referencia");
    }
    setGuardandoEdit(true);
    const { error } = await supabase.from("pagos_laboratorio").update({
      importe: parseFloat(editImporte),
      medio_pago: editMedio,
      referencia: editRef.trim() || null,
    }).eq("id", pagoEditId);
    setGuardandoEdit(false);
    if (error) return toast.error("Error actualizando pago", { description: error.message });
    toast.success("Pago actualizado");
    setPagoEditId(null);
    await cargarPagos();
    onSaved();
  }

  const costo = parseFloat(costoFinal) || 0;
  const pago = parseFloat(nuevoPago) || 0;
  const saldo = costo - pagoAcumulado - pago;

  async function guardar() {
    if (!orden) return;
    if (pago > 0 && medioPago !== "efectivo" && medioPago !== "debito" && medioPago !== "credito" && !referencia.trim()) {
      return toast.error("Ingresá la referencia del pago");
    }
    if (pago > 0 && pago > (costo - pagoAcumulado)) {
      return toast.error("El pago excede el saldo pendiente");
    }

    setGuardando(true);

    const { error } = await supabase.from("ordenes_trabajo").update({
      estado,
      fecha_estimada_entrega: fechaEntrega || null,
      costo_final: costo,
    }).eq("id", orden.id);

    if (error) {
      toast.error("Error actualizando la orden", { description: error.message });
      setGuardando(false);
      return;
    }

    if (pago > 0 && orden.laboratorio?.id) {
      await supabase.from("pagos_laboratorio").insert({
        orden_id: orden.id,
        laboratorio_id: orden.laboratorio.id,
        importe: pago,
        medio_pago: medioPago,
        referencia: referencia.trim() || null,
        fecha: new Date().toISOString().slice(0, 10),
        usuario_registro: user?.id ?? null,
      });
    }

    setGuardando(false);
    toast.success("Orden actualizada");
    onOpenChange(false);
    onSaved();
  }

  if (!orden) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar orden de trabajo</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {/* Info de la orden */}
          <div className="text-xs bg-muted/50 rounded-md px-3 py-2 space-y-0.5">
            <p className="font-medium">{orden.tipo_trabajo}</p>
            <p className="text-muted-foreground">
              {orden.paciente ? `${orden.paciente.apellido}, ${orden.paciente.nombre}` : "—"}
              {orden.laboratorio ? ` · ${orden.laboratorio.nombre}` : ""}
            </p>
          </div>

          {/* Estado y fecha */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Estado</Label>
              <Select value={estado} onValueChange={(v) => setEstado(v as "enviado" | "entregado")}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="enviado">Enviado al lab</SelectItem>
                  <SelectItem value="entregado">Entregado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fecha estimada entrega</Label>
              <Input
                type="date"
                className="h-8 text-xs"
                value={fechaEntrega}
                onChange={(e) => setFechaEntrega(e.target.value)}
              />
            </div>
          </div>

          {/* Costo final */}
          <div className="space-y-1">
            <Label className="text-xs">Costo final</Label>
            <Input
              type="number" min={0} step={1}
              className="h-8 text-xs text-right"
              value={costoFinal}
              onChange={(e) => setCostoFinal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
            />
          </div>

          {/* Resumen de pagos */}
          <div className="grid grid-cols-3 gap-2 border-t pt-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Pagado hasta ahora</Label>
              <Input readOnly className="h-8 text-xs text-right bg-muted" value={pagoAcumulado.toLocaleString("es-AR")} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nuevo pago</Label>
              <Input
                type="number" min={0} step={1}
                className="h-8 text-xs text-right"
                placeholder="0"
                value={nuevoPago}
                disabled={costo - pagoAcumulado <= 0}
                onChange={(e) => setNuevoPago(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
              />
              {costo - pagoAcumulado <= 0 && (
                <p className="text-xs text-green-600">Orden saldada</p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Saldo</Label>
              <Input
                readOnly
                className={`h-8 text-xs text-right bg-muted font-medium ${saldo > 0 ? "text-amber-600" : "text-green-600"}`}
                value={saldo.toLocaleString("es-AR")}
              />
            </div>
          </div>

          {/* Medio de pago — solo si hay nuevo pago */}
          {pago > 0 && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Medio de pago *</Label>
                <Select value={medioPago} onValueChange={(v) => setMedioPago(v as MedioPago)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(MEDIO_PAGO_LABELS) as MedioPago[]).map((m) => (
                      <SelectItem key={m} value={m}>{MEDIO_PAGO_LABELS[m]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {medioPago !== "efectivo" && medioPago !== "debito" && medioPago !== "credito" && (
                <div className="space-y-1">
                  <Label className="text-xs">Referencia *</Label>
                  <Input
                    className="h-8 text-xs"
                    placeholder="N° transferencia, etc."
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Pagos registrados hoy */}
          {pagosHoy.length > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs font-medium">Pagos registrados hoy</Label>
              <div className="space-y-1">
                {pagosHoy.map((p) => (
                  <div
                    key={p.id}
                    className={`rounded-md border px-3 py-2 cursor-pointer text-xs ${pagoEditId === p.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                    onClick={() => pagoEditId === p.id ? setPagoEditId(null) : seleccionarPagoEditar(p)}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Pago al laboratorio</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">${p.importe.toLocaleString("es-AR")}</span>
                        <span className="text-muted-foreground">{MEDIO_PAGO_LABELS[p.medio_pago as MedioPago] ?? p.medio_pago}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {pagoEditId && (
                <div className="rounded-md border border-primary p-3 space-y-2 bg-primary/5">
                  <p className="text-xs font-medium text-primary">Editando pago</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Importe</Label>
                      <Input type="number" min={0} step={1} className="h-7 text-xs text-right"
                        value={editImporte} onChange={(e) => setEditImporte(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Medio de pago</Label>
                      <Select value={editMedio} onValueChange={(v) => setEditMedio(v as MedioPago)}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(MEDIO_PAGO_LABELS) as MedioPago[]).map((m) => (
                            <SelectItem key={m} value={m}>{MEDIO_PAGO_LABELS[m]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {editMedio !== "efectivo" && editMedio !== "debito" && editMedio !== "credito" && (
                      <div className="space-y-1">
                        <Label className="text-xs">Referencia</Label>
                        <Input className="h-7 text-xs" value={editRef} onChange={(e) => setEditRef(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} />
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setPagoEditId(null)}>Cancelar</Button>
                    <Button size="sm" className="h-7 text-xs" onClick={guardarEdicion} disabled={guardandoEdit}>
                      {guardandoEdit ? "Guardando..." : "Guardar cambios"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button size="sm" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
