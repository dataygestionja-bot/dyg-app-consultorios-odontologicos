import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

type MedioPago = "efectivo" | "transferencia";

const MEDIO_PAGO_LABELS: Record<MedioPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
};

interface Pago { importe: number; }

interface Orden {
  id: string;
  tipo_trabajo: string;
  estado: "gestionar_pedido" | "enviado" | "entregado";
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
  const [estado, setEstado] = useState<"gestionar_pedido" | "enviado" | "entregado">("gestionar_pedido");
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [costoFinal, setCostoFinal] = useState("");
  const [nuevoPago, setNuevoPago] = useState("");
  const [medioPago, setMedioPago] = useState<MedioPago>("efectivo");
  const [nroOrden, setNroOrden] = useState("");
  const [referencia, setReferencia] = useState("");
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);
  const [pagoAcumulado, setPagoAcumulado] = useState(0);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open || !orden) return;
    setEstado(orden.estado);
    setFechaEntrega(orden.fecha_estimada_entrega ?? "");
    setCostoFinal(String(orden.costo_final || orden.costo_presupuestado));
    setNuevoPago("");
    setMedioPago("efectivo");
    setNroOrden("");
    setReferencia("");
    setComprobanteFile(null);
    cargarPagos();
  }, [open, orden]);

  async function cargarPagos() {
    if (!orden) return;
    const { data } = await supabase
      .from("pagos_laboratorio")
      .select("importe")
      .eq("orden_id", orden.id);
    const total = (data ?? []).reduce((s, p) => s + Number(p.importe), 0);
    setPagoAcumulado(total);
  }

  const costo = parseFloat(costoFinal) || 0;
  const pago = parseFloat(nuevoPago) || 0;
  const saldo = costo - pagoAcumulado - pago;

  async function guardar() {
    if (!orden) return;
    if (pago > 0 && !nroOrden.trim()) {
      return toast.error("Ingresá el número de orden del pago");
    }
    if (pago > 0 && medioPago === "transferencia" && !referencia.trim()) {
      return toast.error("Ingresá la referencia del pago");
    }
    if (pago > 0 && pago > (costo - pagoAcumulado)) {
      return toast.error("El pago excede el saldo pendiente");
    }

    setGuardando(true);

    // Actualizar orden
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

    // Registrar pago si hay importe
    if (pago > 0 && orden.laboratorio?.id) {
      const { data: pagoId, error: errPago } = await supabase.rpc("insertar_pago_laboratorio", {
        p_orden_id: orden.id,
        p_laboratorio_id: orden.laboratorio.id,
        p_importe: pago,
        p_medio_pago: medioPago,
        p_nro_orden: nroOrden ? nroOrden.padStart(9, "0") : null,
        p_referencia: referencia.trim() || null,
        p_fecha: new Date().toISOString().slice(0, 10),
        p_usuario_registro: user?.id ?? null,
      });

      if (errPago) {
        toast.error("Error registrando el pago", { description: errPago.message });
        setGuardando(false);
        return;
      }

      const pagoInsertado = pagoId ? { id: pagoId as string } : null;

      // Subir comprobante si hay archivo
      if (comprobanteFile && pagoInsertado?.id) {
        const ext = comprobanteFile.name.includes(".") ? comprobanteFile.name.split(".").pop() : "bin";
        const path = `laboratorio/${pagoInsertado.id}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("atencion-documentos")
          .upload(path, comprobanteFile, { contentType: comprobanteFile.type || undefined, upsert: false });
        if (!upErr) {
          await supabase
            .from("pagos_laboratorio")
            .update({ comprobante_path: path, comprobante_nombre: comprobanteFile.name })
            .eq("id", pagoInsertado.id);
        }
      }
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
              <Select value={estado} onValueChange={(v) => setEstado(v as "gestionar_pedido" | "enviado" | "entregado")}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gestionar_pedido">Gestionar pedido</SelectItem>
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
            <div className="space-y-2">
              <div className="space-y-1">
                <Label className="text-xs">Nro. de orden *</Label>
                <Input
                  className="h-8 text-xs font-mono"
                  placeholder="000000000"
                  inputMode="numeric"
                  maxLength={9}
                  value={nroOrden}
                  onChange={(e) => setNroOrden(e.target.value.replace(/\D/g, "").slice(0, 9))}
                  onBlur={() => nroOrden && setNroOrden(nroOrden.padStart(9, "0"))}
                  onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Medio de pago *</Label>
                <Select value={medioPago} onValueChange={(v) => { setMedioPago(v as MedioPago); setComprobanteFile(null); }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(MEDIO_PAGO_LABELS) as MedioPago[]).map((m) => (
                      <SelectItem key={m} value={m}>{MEDIO_PAGO_LABELS[m]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {medioPago === "transferencia" && (
                <>
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
                  <div className="space-y-1">
                    <Label className="text-xs">Comprobante (opcional)</Label>
                    <Input
                      type="file"
                      accept="image/*,.pdf"
                      className="h-8 text-xs"
                      onChange={(e) => setComprobanteFile(e.target.files?.[0] ?? null)}
                    />
                    {comprobanteFile && (
                      <p className="text-xs text-muted-foreground">{comprobanteFile.name}</p>
                    )}
                  </div>
                </>
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
