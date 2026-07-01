import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

type MedioPago = "efectivo" | "transferencia";
type Prioridad = "alta" | "media" | "baja";

const MEDIO_PAGO_LABELS: Record<MedioPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
};

const PRIORIDAD_LABELS: Record<Prioridad, string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

interface Pago { id: string; fecha: string; importe: number; medio_pago: string; }

interface Orden {
  id: string;
  tipo_trabajo: string;
  prioridad: "alta" | "media" | "baja";
  estado: "gestionar_pedido" | "enviado" | "entregado";
  fecha_estimada_entrega: string | null;
  fecha_pedido: string | null;
  costo_presupuestado: number;
  costo_final: number;
  pieza_dental: string | null;
  indicaciones: string | null;
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
  const [modoEdicion, setModoEdicion] = useState(false);
  const [tipoTrabajo, setTipoTrabajo] = useState("");
  const [indicaciones, setIndicaciones] = useState("");
  const [prioridad, setPrioridad] = useState<Prioridad>("media");
  const [estado, setEstado] = useState<"gestionar_pedido" | "enviado" | "entregado">("gestionar_pedido");
  const [fechaPedido, setFechaPedido] = useState("");
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [costoFinal, setCostoFinal] = useState("");
  const [nuevoPago, setNuevoPago] = useState("");
  const [medioPago, setMedioPago] = useState<MedioPago>("efectivo");
  const [nroOrden, setNroOrden] = useState("");
  const [referencia, setReferencia] = useState("");
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);
  const [pagoAcumulado, setPagoAcumulado] = useState(0);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open || !orden) return;
    setModoEdicion(false);
    setTipoTrabajo(orden.tipo_trabajo ?? "");
    setIndicaciones(orden.indicaciones ?? "");
    setPrioridad((orden.prioridad ?? "media") as Prioridad);
    setEstado(orden.estado);
    setFechaPedido(orden.fecha_pedido ?? "");
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
      .select("id, fecha, importe, medio_pago")
      .eq("orden_id", orden.id)
      .order("fecha", { ascending: false });
    const lista = (data ?? []) as unknown as Pago[];
    setPagos(lista);
    setPagoAcumulado(lista.reduce((s, p) => s + Number(p.importe), 0));
  }

  const costo = parseFloat(costoFinal) || 0;
  const pago = parseFloat(nuevoPago) || 0;
  const saldo = costo - pagoAcumulado - pago;

  async function guardarDatosPedido() {
    if (!orden) return;
    const sinCambios =
      tipoTrabajo.trim() === (orden.tipo_trabajo ?? "") &&
      indicaciones.trim() === (orden.indicaciones ?? "") &&
      prioridad === orden.prioridad;
    if (sinCambios) {
      setModoEdicion(false);
      return;
    }
    const { error } = await supabase.from("ordenes_trabajo").update({
      tipo_trabajo: tipoTrabajo.trim() || orden.tipo_trabajo,
      indicaciones: indicaciones.trim() || null,
      prioridad,
    }).eq("id", orden.id);
    if (error) {
      toast.error("Error guardando los datos", { description: error.message });
      return;
    }
    toast.success("Datos del pedido actualizados");
    setModoEdicion(false);
    onSaved();
  }

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
      tipo_trabajo: tipoTrabajo.trim() || orden.tipo_trabajo,
      indicaciones: indicaciones.trim() || null,
      prioridad,
      estado,
      fecha_pedido: estado === "enviado" ? (fechaPedido || null) : null,
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar orden de trabajo</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {/* Info fija */}
          <div className="text-xs bg-muted/50 rounded-md px-3 py-2">
            <p className="text-muted-foreground">
              {orden.paciente ? `${orden.paciente.apellido}, ${orden.paciente.nombre}` : "—"}
              {orden.laboratorio ? ` · ${orden.laboratorio.nombre}` : ""}
            </p>
          </div>

          {/* Tipo de trabajo / Indicaciones / Prioridad — modo lectura o edición */}
          {!modoEdicion ? (
            <div className="bg-muted/50 rounded-md px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5 flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{tipoTrabajo}</p>
                  {indicaciones && <p className="text-xs text-muted-foreground">{indicaciones}</p>}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                      prioridad === "alta" ? "bg-red-500 text-white" :
                      prioridad === "media" ? "bg-yellow-400 text-yellow-950" :
                      "bg-[#78e911] text-green-950"
                    }`}>{PRIORIDAD_LABELS[prioridad]}</span>
                    {orden.pieza_dental && (
                      <span className="text-xs text-muted-foreground">Pieza: {orden.pieza_dental}</span>
                    )}
                  </div>
                </div>
                <Button type="button" size="sm" variant="outline" className="h-7 text-xs shrink-0"
                  onClick={() => setModoEdicion(true)}>
                  Editar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2 border rounded-md px-3 py-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Editando datos del pedido</Label>
                <Button type="button" size="sm" variant="ghost" className="h-6 text-xs"
                  onClick={guardarDatosPedido}>
                  Listo
                </Button>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo de trabajo</Label>
                <Input className="h-8 text-xs" value={tipoTrabajo}
                  onChange={(e) => setTipoTrabajo(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Indicaciones</Label>
                <Input className="h-8 text-xs" value={indicaciones}
                  onChange={(e) => setIndicaciones(e.target.value)}
                  placeholder="Detalles técnicos, color, medidas..."
                  onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} />
              </div>
              <div className={`grid gap-2 ${orden.pieza_dental ? "grid-cols-2" : "grid-cols-1"}`}>
                <div className="space-y-1">
                  <Label className="text-xs">Prioridad</Label>
                  <Select value={prioridad} onValueChange={(v) => setPrioridad(v as Prioridad)}>
                    <SelectTrigger className={`h-8 text-xs font-medium ${
                      prioridad === "alta" ? "bg-red-500 text-white border-red-500" :
                      prioridad === "media" ? "bg-yellow-400 text-yellow-950 border-yellow-400" :
                      "bg-[#78e911] text-green-950 border-[#78e911]"
                    }`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PRIORIDAD_LABELS) as Prioridad[]).map((p) => (
                        <SelectItem key={p} value={p}>{PRIORIDAD_LABELS[p]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {orden.pieza_dental && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Pieza</Label>
                    <Input readOnly className="h-8 text-xs bg-muted" value={orden.pieza_dental} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Estado, Fecha de pedido y Fecha estimada entrega */}
          <div className={`grid gap-2 ${estado === "enviado" ? "grid-cols-3" : "grid-cols-2"}`}>
            <div className="space-y-1">
              <Label className="text-xs">Estado</Label>
              <Select
                value={estado}
                onValueChange={(v) => {
                  const nuevo = v as "gestionar_pedido" | "enviado" | "entregado";
                  setEstado(nuevo);
                  if (nuevo === "enviado" && !fechaPedido) {
                    setFechaPedido(new Date().toISOString().slice(0, 10));
                  }
                }}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gestionar_pedido">Gestionar pedido</SelectItem>
                  <SelectItem value="enviado">Enviado al lab</SelectItem>
                  <SelectItem value="entregado">Entregado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {estado === "enviado" && (
              <div className="space-y-1">
                <Label className="text-xs">Fecha de pedido</Label>
                <Input
                  type="date"
                  className="h-8 text-xs"
                  value={fechaPedido}
                  onChange={(e) => setFechaPedido(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Fecha est. entrega</Label>
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

          {/* Historial de pagos */}
          {pagos.length > 0 && (
            <div className="border-t pt-2 space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Pagos registrados</p>
              {pagos.map((p) => (
                <div key={p.id} className="flex gap-4 text-xs">
                  <span>{format(parseISO(p.fecha), "dd/MM/yyyy", { locale: es })}</span>
                  <span className="font-mono text-green-600">
                    $ {Number(p.importe).toLocaleString("es-AR")}
                  </span>
                  <span className="text-muted-foreground capitalize">{p.medio_pago}</span>
                </div>
              ))}
            </div>
          )}

          {/* Medio de pago — solo si hay nuevo pago */}
          {pago > 0 && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
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
                    <Label className="text-xs">Adjuntar comprobante (opcional)</Label>
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
