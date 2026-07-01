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

interface CobroHoy {
  id: string;
  importe: number;
  medio_pago: string;
  referencia: string | null;
  observaciones: string | null;
}

interface Cobro {
  importe_aplicado: number;
}

interface Practica {
  id: string;
  debe: number;
  prestacion: { codigo: string; descripcion: string } | null;
  cobro_aplicaciones: Cobro[];
}

interface Props {
  atencionId: string;
  pacienteId: string;
  fecha: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}

export function RegistrarCobroDialog({ atencionId, pacienteId, fecha, open, onOpenChange, onSaved }: Props) {
  const { user } = useAuth();
  const [practicas, setPracticas] = useState<Practica[]>([]);
  const [haberes, setHaberes] = useState<Record<string, string>>({});
  const [debes, setDebes] = useState<Record<string, string>>({});
  const [medioPago, setMedioPago] = useState<MedioPago>("efectivo");
  const [referencia, setReferencia] = useState("");
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [cobrosHoy, setCobrosHoy] = useState<CobroHoy[]>([]);
  const [cobroEditId, setCobroEditId] = useState<string | null>(null);
  const [editImporte, setEditImporte] = useState("");
  const [editMedio, setEditMedio] = useState<MedioPago>("efectivo");
  const [editRef, setEditRef] = useState("");
  const [guardandoEdit, setGuardandoEdit] = useState(false);

  useEffect(() => {
  if (!open) return;
  console.log("pacienteId:", pacienteId, "fecha prop:", fecha);
  setMedioPago("efectivo");
    setReferencia("");
    cargar();
  }, [open, atencionId]);

  async function cargar() {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const [{ data }, { data: cobros }] = await Promise.all([
      supabase.from("atencion_practicas")
        .select("id, debe, prestacion:prestaciones(codigo, descripcion), cobro_aplicaciones(importe_aplicado)")
        .eq("atencion_id", atencionId).order("orden"),
      supabase.from("cobros")
        .select("id, importe, medio_pago, referencia, observaciones")
        .eq("paciente_id", pacienteId)
        .eq("fecha", today)
        .order("created_at", { ascending: false }),
    ]);
    const rows = (data ?? []) as unknown as Practica[];
    setPracticas(rows);
    setCobrosHoy((cobros ?? []) as CobroHoy[]);
    const h: Record<string, string> = {};
    const d: Record<string, string> = {};
    rows.forEach((p) => { h[p.id] = ""; d[p.id] = String(p.debe ?? 0); });
    setHaberes(h);
    setDebes(d);
    setCobroEditId(null);
    setLoading(false);
  }

  async function guardarEdicion() {
    if (!cobroEditId) return;
    if (!editImporte || parseFloat(editImporte) <= 0) return toast.error("Ingresá un importe válido");
    if (editMedio !== "efectivo" && editMedio !== "debito" && editMedio !== "credito" && !editRef.trim()) {
      return toast.error("Ingresá la referencia");
    }
    setGuardandoEdit(true);
    const { error } = await supabase.from("cobros").update({
      importe: parseFloat(editImporte),
      medio_pago: editMedio,
      referencia: editRef.trim() || null,
    }).eq("id", cobroEditId);
    setGuardandoEdit(false);
    if (error) return toast.error("Error actualizando cobro", { description: error.message });
    toast.success("Cobro actualizado");
    setCobroEditId(null);
    await cargar();
    onSaved();
  }

  function seleccionarCobroEditar(cobro: CobroHoy) {
    setCobroEditId(cobro.id);
    setEditImporte(String(cobro.importe));
    setEditMedio(cobro.medio_pago as MedioPago);
    setEditRef(cobro.referencia ?? "");
  }

  function haberAcumulado(p: Practica): number {
    return p.cobro_aplicaciones.reduce((s, c) => s + (c.importe_aplicado ?? 0), 0);
  }

  function esPrimerMomento(p: Practica): boolean {
    return haberAcumulado(p) === 0;
  }

  function saldoPractica(p: Practica): number {
    const debe = parseFloat(debes[p.id] ?? String(p.debe)) || 0;
    const haber = haberAcumulado(p) + (parseFloat(haberes[p.id]) || 0);
    return debe - haber;
  }

  async function guardar() {
    const totalHaber = Object.values(haberes).reduce((s, v) => s + (parseFloat(v) || 0), 0);
    if (totalHaber <= 0) return toast.error("Ingresá al menos un importe en Haber");

    // Verificar que ningún haber exceda el saldo de su práctica
    for (const p of practicas) {
      const saldoActual = (parseFloat(debes[p.id] ?? String(p.debe)) || 0) - haberAcumulado(p);
      const haberNuevo = parseFloat(haberes[p.id] || "0") || 0;
      if (haberNuevo > saldoActual) {
        return toast.error(`El haber de ${p.prestacion?.codigo} excede el saldo pendiente`);
      }
    }
    if (!medioPago) return toast.error("Seleccioná el medio de pago");
    if (medioPago !== "efectivo" && !referencia.trim()) return toast.error("Ingresá la referencia del pago");

    setGuardando(true);

    // Actualizar debe si cambió (solo primer momento)
    for (const p of practicas) {
      if (esPrimerMomento(p)) {
        const nuevoD = parseFloat(debes[p.id]) || 0;
        if (nuevoD !== p.debe) {
          await supabase.from("atencion_practicas").update({ debe: nuevoD }).eq("id", p.id);
        }
      }
    }

    // Crear un cobro por práctica que tenga haber > 0
    for (const p of practicas) {
      const haberNuevo = parseFloat(haberes[p.id]) || 0;
      if (haberNuevo <= 0) continue;

      const { data: cobro, error } = await supabase.from("cobros").insert({
        fecha: new Date().toISOString().slice(0, 10),
        paciente_id: pacienteId,
        importe: haberNuevo,
        medio_pago: medioPago,
        referencia: referencia.trim() || null,
        observaciones: `Pago prestación ${p.prestacion?.codigo ?? ""}`,
        usuario_registro: user?.id ?? null,
      }).select("id").single();

      if (error || !cobro) {
        toast.error("Error registrando cobro", { description: error?.message });
        setGuardando(false);
        return;
      }

      await supabase.from("cobro_aplicaciones").insert({
        cobro_id: cobro.id,
        atencion_id: atencionId,
        practica_id: p.id,
        importe_aplicado: haberNuevo,
      });
    }

    setGuardando(false);
    toast.success("Cobro registrado correctamente");
    onOpenChange(false);
    onSaved();
  }

  const totalDebe = practicas.reduce((s, p) => s + (parseFloat(debes[p.id] ?? String(p.debe)) || 0), 0);
  const totalHaberAcum = practicas.reduce((s, p) => s + haberAcumulado(p), 0);
  const totalHaberNuevo = Object.values(haberes).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const totalSaldo = totalDebe - totalHaberAcum - totalHaberNuevo;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Registrar cobro</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground py-4">Cargando prácticas...</p>
        ) : (
          <div className="space-y-4">
            {/* Tabla de prácticas */}
            <div className="space-y-1">
              <div className="grid grid-cols-[1fr_80px_80px_80px_80px] gap-2 text-xs text-muted-foreground px-1">
                <span>Prestación</span>
                <span className="text-center">Debe</span>
                <span className="text-center">Haber acum.</span>
                <span className="text-center">Nuevo haber</span>
                <span className="text-center">Saldo</span>
              </div>
              {practicas.map((p) => (
                <div key={p.id} className="grid grid-cols-[1fr_80px_80px_80px_80px] gap-2 items-center">
                  <div className="text-xs">
                    <span className="font-medium">{p.prestacion?.codigo}</span>
                    <span className="text-muted-foreground"> · {p.prestacion?.descripcion}</span>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    className="h-7 text-xs text-right"
                    value={debes[p.id] ?? ""}
                    disabled={!esPrimerMomento(p)}
                    onChange={(e) => setDebes((d) => ({ ...d, [p.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
                  />
                  <Input
                    readOnly
                    className="h-7 text-xs text-right bg-muted"
                    value={haberAcumulado(p).toLocaleString("es-AR")}
                  />
                  {(() => {
                    const saldoActual = (parseFloat(debes[p.id] ?? String(p.debe)) || 0) - haberAcumulado(p);
                    const haberNuevo = parseFloat(haberes[p.id] || "0") || 0;
                    const saldado = saldoActual <= 0;
                    const excede = haberNuevo > saldoActual;
                    return (
                      <div className="space-y-0.5">
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          className={`h-7 text-xs text-right ${excede ? "border-red-400 focus-visible:ring-red-400" : ""}`}
                          placeholder="0"
                          value={haberes[p.id] ?? ""}
                          disabled={saldado}
                          onChange={(e) => setHaberes((h) => ({ ...h, [p.id]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
                        />
                        {excede && <p className="text-[10px] text-red-500 text-right">Excede el saldo</p>}
                      </div>
                    );
                  })()}
                  <Input
                    readOnly
                    className={`h-7 text-xs text-right bg-muted font-medium ${saldoPractica(p) > 0 ? "text-amber-600" : "text-green-600"}`}
                    value={saldoPractica(p).toLocaleString("es-AR")}
                  />
                </div>
              ))}

              {/* Totales */}
              <div className="grid grid-cols-[1fr_80px_80px_80px_80px] gap-2 items-center border-t pt-2 mt-1">
                <span className="text-xs font-medium">Total</span>
                <div className="text-xs font-medium text-right">{totalDebe.toLocaleString("es-AR")}</div>
                <div className="text-xs font-medium text-right">{totalHaberAcum.toLocaleString("es-AR")}</div>
                <div className="text-xs font-medium text-right">{totalHaberNuevo.toLocaleString("es-AR")}</div>
                <div className={`text-xs font-medium text-right ${totalSaldo > 0 ? "text-amber-600" : "text-green-600"}`}>
                  {totalSaldo.toLocaleString("es-AR")}
                </div>
              </div>
            </div>

            {/* Cobros del día */}
            {cobrosHoy.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-xs font-medium">Cobros registrados hoy</Label>
                <div className="space-y-1">
                  {cobrosHoy.map((c) => (
                    <div key={c.id} className={`rounded-md border px-3 py-2 cursor-pointer text-xs ${cobroEditId === c.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                      onClick={() => cobroEditId === c.id ? setCobroEditId(null) : seleccionarCobroEditar(c)}>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">{c.observaciones ?? "Cobro"}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">${c.importe.toLocaleString("es-AR")}</span>
                          <span className="text-muted-foreground">{MEDIO_PAGO_LABELS[c.medio_pago as MedioPago] ?? c.medio_pago}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {cobroEditId && (
                  <div className="rounded-md border border-primary p-3 space-y-2 bg-primary/5">
                    <p className="text-xs font-medium text-primary">Editando cobro</p>
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
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setCobroEditId(null)}>Cancelar</Button>
                      <Button size="sm" className="h-7 text-xs" onClick={guardarEdicion} disabled={guardandoEdit}>
                        {guardandoEdit ? "Guardando..." : "Guardar cambios"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Medio de pago */}
            <div className="flex flex-wrap gap-3 pt-2 border-t">
              <div className="space-y-1 min-w-[160px]">
                <Label className="text-xs">Medio de pago *</Label>
                <Select value={medioPago} onValueChange={(v) => setMedioPago(v as MedioPago)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(MEDIO_PAGO_LABELS) as MedioPago[]).map((m) => (
                      <SelectItem key={m} value={m}>{MEDIO_PAGO_LABELS[m]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {medioPago !== "efectivo" && (
                <div className="space-y-1 flex-1 min-w-[200px]">
                  <Label className="text-xs">Referencia *</Label>
                  <Input
                    className="h-8 text-xs"
                    placeholder="N° transferencia, cheque, etc."
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button size="sm" onClick={guardar} disabled={guardando || loading}>
            {guardando ? "Guardando..." : "Registrar cobro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
