import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

type Prioridad = "alta" | "media" | "baja";
type MedioPago = "efectivo" | "transferencia" | "debito" | "credito" | "mercadopago" | "otro";

const PRIORIDAD_LABELS: Record<Prioridad, string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

const MEDIO_PAGO_LABELS: Record<MedioPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  debito: "Débito",
  credito: "Crédito",
  mercadopago: "MercadoPago",
  otro: "Otro",
};

interface Laboratorio {
  id: string;
  nombre: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  atencionId: string | null;
  pacienteId: string;
  pacienteNombre: string;
  profesionalId: string;
  profesionalNombre: string;
  fecha: string;
  onSaved?: () => void;
}

export function OrdenTrabajoDialog({
  open, onOpenChange,
  atencionId, pacienteId, pacienteNombre,
  profesionalId, profesionalNombre,
  fecha, onSaved,
}: Props) {
  const { user } = useAuth();
  const [laboratorios, setLaboratorios] = useState<Laboratorio[]>([]);
  const [laboratorioId, setLaboratorioId] = useState("");
  const [tipoTrabajo, setTipoTrabajo] = useState("");
  const [indicaciones, setIndicaciones] = useState("");
  const [prioridad, setPrioridad] = useState<Prioridad>("media");
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [costoPresupuestado, setCostoPresupuestado] = useState("");
  const [senia, setSenia] = useState("");
  const [medioPago, setMedioPago] = useState<MedioPago>("efectivo");
  const [referencia, setReferencia] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open) return;
    resetForm();
    supabase.from("laboratorios").select("id, nombre").eq("activo", true).order("nombre")
      .then(({ data }) => setLaboratorios((data ?? []) as Laboratorio[]));
  }, [open]);

  function resetForm() {
    setLaboratorioId("");
    setTipoTrabajo("");
    setIndicaciones("");
    setPrioridad("media");
    setFechaEntrega("");
    setCostoPresupuestado("");
    setSenia("");
    setMedioPago("efectivo");
    setReferencia("");
  }

  const saldo = (parseFloat(costoPresupuestado) || 0) - (parseFloat(senia) || 0);

  async function guardar() {
    if (!laboratorioId) return toast.error("Seleccioná un laboratorio");
    if (!tipoTrabajo.trim()) return toast.error("Ingresá el tipo de trabajo");
    const costo = parseFloat(costoPresupuestado) || 0;
    const seniaNum = parseFloat(senia) || 0;
    if (seniaNum > costo) return toast.error("La seña no puede superar el costo");
    if (seniaNum > 0 && medioPago !== "efectivo" && medioPago !== "debito" && medioPago !== "credito" && !referencia.trim()) {
      return toast.error("Ingresá la referencia del pago");
    }

    setGuardando(true);

    const { data: orden, error } = await supabase.from("ordenes_trabajo").insert({
      atencion_id: atencionId || null,
      paciente_id: pacienteId,
      profesional_id: profesionalId,
      laboratorio_id: laboratorioId,
      tipo_trabajo: tipoTrabajo.trim(),
      indicaciones: indicaciones.trim() || null,
      prioridad,
      fecha_estimada_entrega: fechaEntrega || null,
      estado: "enviado",
      costo_presupuestado: costo,
      costo_final: costo,
      created_by: user?.id ?? null,
    }).select("id").single();

    if (error || !orden) {
      toast.error("Error creando la orden", { description: error?.message });
      setGuardando(false);
      return;
    }

    // Registrar seña si hay importe
    if (seniaNum > 0) {
      await supabase.from("pagos_laboratorio").insert({
        orden_id: orden.id,
        laboratorio_id: laboratorioId,
        importe: seniaNum,
        medio_pago: medioPago,
        referencia: referencia.trim() || null,
        fecha,
        usuario_registro: user?.id ?? null,
      });
    }

    setGuardando(false);
    toast.success("Orden de trabajo creada");
    onOpenChange(false);
    onSaved?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva orden de trabajo</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 py-1">
          {/* Datos heredados de la atención */}
          <div className="grid grid-cols-3 gap-2 text-xs bg-muted/50 rounded-md px-3 py-2">
            <div><span className="text-muted-foreground">Paciente</span><p className="font-medium truncate">{pacienteNombre}</p></div>
            <div><span className="text-muted-foreground">Profesional</span><p className="font-medium truncate">{profesionalNombre}</p></div>
            <div><span className="text-muted-foreground">Fecha</span><p className="font-medium">{fecha}</p></div>
          </div>

          {/* Laboratorio y tipo en la misma fila */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Laboratorio *</Label>
              <Select value={laboratorioId} onValueChange={setLaboratorioId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {laboratorios.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo de trabajo *</Label>
              <Input
                className="h-8 text-xs"
                placeholder="Corona, prótesis..."
                value={tipoTrabajo}
                onChange={(e) => setTipoTrabajo(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
              />
            </div>
          </div>

          {/* Indicaciones */}
          <div className="space-y-1">
            <Label className="text-xs">Indicaciones</Label>
            <Input
              className="h-8 text-xs"
              placeholder="Detalles técnicos, color, medidas..."
              value={indicaciones}
              onChange={(e) => setIndicaciones(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
            />
          </div>

          {/* Prioridad y fecha entrega */}
          <div className="grid grid-cols-2 gap-2">
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

          {/* Costo, seña, saldo */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Costo presupuestado</Label>
              <Input
                type="number" min={0} step={1} className="h-8 text-xs text-right"
                placeholder="0"
                value={costoPresupuestado}
                onChange={(e) => setCostoPresupuestado(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Seña</Label>
              <Input
                type="number" min={0} step={1} className="h-8 text-xs text-right"
                placeholder="0"
                value={senia}
                onChange={(e) => setSenia(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Saldo</Label>
              <Input
                readOnly
                className="h-8 text-xs text-right bg-muted font-medium"
                value={saldo.toLocaleString("es-AR")}
              />
            </div>
          </div>

          {/* Medio de pago — solo si hay seña */}
          {parseFloat(senia) > 0 && (
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
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button size="sm" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando..." : "Crear orden"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
