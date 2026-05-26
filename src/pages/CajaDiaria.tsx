import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, TrendingUp, TrendingDown, DollarSign, Lock, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";

type EstadoCaja = "abierta" | "cerrada_conforme" | "cerrada_no_conforme";
type TipoMov = "ingreso" | "egreso";
type OrigenMov = "cobro_prestacion" | "aporte" | "egreso_manual" | "pago_laboratorio";

const CATEGORIAS_EGRESO = [
  { categoria: "Costo directo", concepto: "Materiales clínicos" },
  { categoria: "Gasto operativo", concepto: "Insumos descartables" },
  { categoria: "Gasto operativo", concepto: "Gastos comunes" },
  { categoria: "Gasto operativo", concepto: "Personal administrativo" },
  { categoria: "Gasto operativo", concepto: "Servicios" },
  { categoria: "Gasto operativo", concepto: "Alquiler" },
  { categoria: "Gestión y administración", concepto: "Impuestos y tasas" },
  { categoria: "Gestión y administración", concepto: "Seguros" },
  { categoria: "Gestión y administración", concepto: "Honorarios externos" },
  { categoria: "Gestión y administración", concepto: "Gastos financieros" },
];

const MEDIOS_PAGO = ["efectivo", "transferencia", "debito", "credito", "mercadopago", "otro"];
const MEDIO_LABELS: Record<string, string> = {
  efectivo: "Efectivo", transferencia: "Transferencia", debito: "Débito",
  credito: "Crédito", mercadopago: "MercadoPago", otro: "Otro",
};

interface Movimiento {
  id: string;
  tipo: TipoMov;
  origen: OrigenMov;
  concepto: string;
  categoria: string | null;
  importe: number;
  medio_pago: string;
  referencia: string | null;
  created_at: string;
}

interface Caja {
  id: string;
  fecha: string;
  nombre: string;
  saldo_inicial: number;
  estado: EstadoCaja;
  comentario_cierre: string | null;
  creado_por: string | null;
}

const ESTADO_INFO: Record<EstadoCaja, { label: string; color: string }> = {
  abierta: { label: "Abierta", color: "bg-green-500" },
  cerrada_conforme: { label: "Cerrada conforme", color: "bg-blue-500" },
  cerrada_no_conforme: { label: "Cerrada no conforme", color: "bg-red-500" },
};

const fmt = (n: number) => `$\u00A0${Number(n).toLocaleString("es-AR", { minimumFractionDigits: 0 })}`;

export default function CajaDiaria() {
  const { user } = useAuth();
  const [cajas, setCajas] = useState<Caja[]>([]);
  const [cajaActiva, setCajaActiva] = useState<Caja | null>(null);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog nueva caja
  const [nuevaCajaOpen, setNuevaCajaOpen] = useState(false);
  const TURNOS_FIJOS = ["Turno mañana", "Turno tarde"];
  const [nombreCaja, setNombreCaja] = useState("");
  const [saldoInicial, setSaldoInicial] = useState("");
  const [creandoCaja, setCreandoCaja] = useState(false);

  // Dialog nuevo movimiento
  const [movOpen, setMovOpen] = useState(false);
  const [movTipo, setMovTipo] = useState<TipoMov>("egreso");
  const [movConcepto, setMovConcepto] = useState("");
  const [movCategoria, setMovCategoria] = useState("");
  const [movImporte, setMovImporte] = useState("");
  const [movMedio, setMovMedio] = useState("efectivo");
  const [movRef, setMovRef] = useState("");
  const [guardandoMov, setGuardandoMov] = useState(false);

  // Dialog cierre
  const [cierreOpen, setCierreOpen] = useState(false);
  const [cierreConforme, setCierreConforme] = useState<boolean | null>(null);
  const [cierreComentario, setCierreComentario] = useState("");
  const [cerrando, setCerrando] = useState(false);

  // Selector de caja activa
  const [cajaSelId, setCajaSelId] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Caja diaria | Consultorio";
    cargar();
  }, []);

  async function cargar() {
    setLoading(true);
    const today = format(new Date(), "yyyy-MM-dd");
    const { data } = await supabase
      .from("caja_diaria")
      .select("*")
      .eq("fecha", today)
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as Caja[];
    setCajas(rows);
    const activa = rows.find(c => c.estado === "abierta") ?? rows[0] ?? null;
    setCajaActiva(activa);
    if (activa) {
      setCajaSelId(activa.id);
      await cargarMovimientos(activa.id);
    }
    setLoading(false);
  }

  async function cargarMovimientos(cajaId: string) {
    const { data } = await supabase
      .from("movimientos_caja")
      .select("*")
      .eq("caja_id", cajaId)
      .order("created_at");
    setMovimientos((data ?? []) as Movimiento[]);
  }

  async function cambiarCaja(id: string) {
    setCajaSelId(id);
    const caja = cajas.find(c => c.id === id) ?? null;
    setCajaActiva(caja);
    if (caja) await cargarMovimientos(caja.id);
  }

  async function crearCaja() {
    if (!nombreCaja.trim()) return toast.error("Ingresá un nombre para la caja");
    // Verificar si ya hay una caja abierta hoy
    const yaAbierta = cajas.some(c => c.estado === "abierta");
    if (yaAbierta) return toast.error("Ya hay una caja abierta hoy. Cerrala antes de abrir una nueva.");
    setCreandoCaja(true);
    const { data, error } = await supabase.from("caja_diaria").insert({
      fecha: format(new Date(), "yyyy-MM-dd"),
      nombre: nombreCaja.trim(),
      saldo_inicial: parseFloat(saldoInicial) || 0,
      estado: "abierta",
      creado_por: user?.id ?? null,
    }).select().single();
    setCreandoCaja(false);
    if (error) return toast.error("Error creando caja", { description: error.message });
    toast.success("Caja abierta");
    setNuevaCajaOpen(false);
    setNombreCaja("");
    setSaldoInicial("");
    await cargar();
  }

  async function guardarMovimiento() {
    if (!cajaActiva) return;
    if (!movConcepto.trim()) return toast.error("Ingresá el concepto");
    if (!movImporte || parseFloat(movImporte) <= 0) return toast.error("Ingresá un importe válido");
    if (movMedio !== "efectivo" && movMedio !== "debito" && movMedio !== "credito" && !movRef.trim()) {
      return toast.error("Ingresá la referencia del pago");
    }
    setGuardandoMov(true);
    const { error } = await supabase.from("movimientos_caja").insert({
      caja_id: cajaActiva.id,
      tipo: movTipo,
      origen: movTipo === "ingreso" ? "aporte" : "egreso_manual",
      concepto: movConcepto.trim(),
      categoria: movCategoria || null,
      importe: parseFloat(movImporte),
      medio_pago: movMedio,
      referencia: movRef.trim() || null,
      usuario_registro: user?.id ?? null,
    });
    setGuardandoMov(false);
    if (error) return toast.error("Error guardando movimiento", { description: error.message });
    toast.success("Movimiento registrado");
    setMovOpen(false);
    setMovConcepto(""); setMovCategoria(""); setMovImporte(""); setMovMedio("efectivo"); setMovRef("");
    await cargarMovimientos(cajaActiva.id);
  }

  async function cerrarCaja() {
    if (!cajaActiva) return;
    if (cierreConforme === null) return toast.error("Seleccioná si es conforme o no conforme");
    if (!cierreConforme && !cierreComentario.trim()) return toast.error("El comentario es obligatorio para no conforme");
    if (!cierreComentario.trim()) return toast.error("Ingresá un comentario");
    if (cajaActiva.creado_por === user?.id) return toast.error("Quien cierra la caja debe ser distinto a quien la abrió");

    setCerrando(true);
    const estado: EstadoCaja = cierreConforme ? "cerrada_conforme" : "cerrada_no_conforme";
    const { error } = await supabase.from("caja_diaria").update({
      estado,
      comentario_cierre: cierreComentario.trim(),
      cerrado_por: user?.id ?? null,
    }).eq("id", cajaActiva.id);
    setCerrando(false);
    if (error) return toast.error("Error cerrando caja", { description: error.message });
    toast.success(`Caja ${cierreConforme ? "cerrada conforme" : "cerrada no conforme"}`);
    setCierreOpen(false);
    setCierreConforme(null);
    setCierreComentario("");
    await cargar();
  }

  // Cálculos
  const totalIngresos = movimientos.filter(m => m.tipo === "ingreso").reduce((s, m) => s + m.importe, 0);
  const totalEgresos = movimientos.filter(m => m.tipo === "egreso").reduce((s, m) => s + m.importe, 0);
  const saldoFinal = (cajaActiva?.saldo_inicial ?? 0) + totalIngresos - totalEgresos;
  const estaAbierta = cajaActiva?.estado === "abierta";

  if (loading) return <div className="text-muted-foreground">Cargando caja...</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Caja diaria</h1>
          <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE d 'de' MMMM yyyy", { locale: es })}</p>
        </div>
        <div className="flex gap-2">
          {cajas.length > 0 && (
            <Select value={cajaSelId ?? ""} onValueChange={cambiarCaja}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Seleccionar caja" /></SelectTrigger>
              <SelectContent>
                {cajas.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button size="sm" onClick={() => setNuevaCajaOpen(true)}>
            <Plus className="h-4 w-4" /> Abrir caja
          </Button>
        </div>
      </div>

      {!cajaActiva ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            No hay cajas abiertas hoy. Creá una nueva caja para comenzar.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Header caja */}
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Badge className={`${ESTADO_INFO[cajaActiva.estado].color} text-white`}>
                    {ESTADO_INFO[cajaActiva.estado].label}
                  </Badge>
                  <span className="font-semibold">{cajaActiva.nombre}</span>
                </div>
                {estaAbierta && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setMovTipo("ingreso"); setMovOpen(true); }}>
                      <TrendingUp className="h-4 w-4" /> Ingreso
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setMovTipo("egreso"); setMovOpen(true); }}>
                      <TrendingDown className="h-4 w-4" /> Egreso
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setCierreOpen(true)}>
                      <Lock className="h-4 w-4" /> Cerrar caja
                    </Button>
                  </div>
                )}
              </div>
              {cajaActiva.comentario_cierre && (
                <p className="text-xs text-muted-foreground mt-2">Comentario: {cajaActiva.comentario_cierre}</p>
              )}
            </CardContent>
          </Card>

          {/* Resumen */}
          <div className="grid grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Saldo inicial</div>
                <div className="text-xl font-bold font-mono mt-1">{fmt(cajaActiva.saldo_inicial)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Ingresos</div>
                <div className="text-xl font-bold font-mono mt-1 text-green-600">{fmt(totalIngresos)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Egresos</div>
                <div className="text-xl font-bold font-mono mt-1 text-red-500">{fmt(totalEgresos)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Saldo final</div>
                <div className={`text-xl font-bold font-mono mt-1 ${saldoFinal >= 0 ? "text-blue-600" : "text-red-500"}`}>
                  {fmt(saldoFinal)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Movimientos */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">Movimientos</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hora</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Medio</TableHead>
                    <TableHead className="text-right">Importe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimientos.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sin movimientos</TableCell></TableRow>
                  ) : movimientos.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs">{new Date(m.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</TableCell>
                      <TableCell>
                        {m.tipo === "ingreso"
                          ? <span className="text-xs text-green-600 font-medium flex items-center gap-1"><TrendingUp className="h-3 w-3" />Ingreso</span>
                          : <span className="text-xs text-red-500 font-medium flex items-center gap-1"><TrendingDown className="h-3 w-3" />Egreso</span>
                        }
                      </TableCell>
                      <TableCell className="text-xs">{m.concepto}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{m.categoria ?? "—"}</TableCell>
                      <TableCell className="text-xs">{MEDIO_LABELS[m.medio_pago] ?? m.medio_pago}</TableCell>
                      <TableCell className={`text-right text-xs font-mono font-medium ${m.tipo === "ingreso" ? "text-green-600" : "text-red-500"}`}>
                        {m.tipo === "egreso" ? "-" : "+"}{fmt(m.importe)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* Dialog abrir caja */}
      <Dialog open={nuevaCajaOpen} onOpenChange={(v) => { setNuevaCajaOpen(v); if (!v) { setNombreCaja(""); setSaldoInicial(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Abrir caja</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label className="text-xs">Turno *</Label>
              {(() => {
                const nombresExistentes = cajas.map(c => c.nombre);
                const turnosDisp = TURNOS_FIJOS.filter(t => !nombresExistentes.includes(t));
                if (turnosDisp.length === 0) {
                  return <p className="text-xs text-muted-foreground py-2">No se puede abrir caja dado que ambas cajas fueron abiertas y cerradas en el día.</p>;
                }
                return (
                  <Select value={nombreCaja} onValueChange={setNombreCaja}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar turno..." /></SelectTrigger>
                    <SelectContent>
                      {turnosDisp.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                );
              })()}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Saldo inicial</Label>
              <Input type="number" min={0} step={1} className="h-8 text-xs text-right" placeholder="0" value={saldoInicial} onChange={(e) => setSaldoInicial(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setNuevaCajaOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={crearCaja} disabled={creandoCaja || !nombreCaja}>{creandoCaja ? "Abriendo..." : "Abrir caja"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog movimiento */}
      <Dialog open={movOpen} onOpenChange={setMovOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{movTipo === "ingreso" ? "Registrar ingreso" : "Registrar egreso"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            {movTipo === "egreso" ? (
              <div className="space-y-1">
                <Label className="text-xs">Concepto *</Label>
                <Select value={movConcepto} onValueChange={(v) => {
                  const cat = CATEGORIAS_EGRESO.find(c => c.concepto === v);
                  setMovConcepto(v);
                  setMovCategoria(cat?.categoria ?? "");
                }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar concepto..." /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS_EGRESO.map(c => <SelectItem key={c.concepto} value={c.concepto}>{c.concepto}</SelectItem>)}
                  </SelectContent>
                </Select>
                {movCategoria && <p className="text-xs text-muted-foreground">Categoría: {movCategoria}</p>}
              </div>
            ) : (
              <div className="space-y-1">
                <Label className="text-xs">Concepto *</Label>
                <Input className="h-8 text-xs" placeholder="Ej: Aporte integrante..." value={movConcepto} onChange={(e) => setMovConcepto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Importe *</Label>
                <Input type="number" min={0} step={1} className="h-8 text-xs text-right" placeholder="0" value={movImporte} onChange={(e) => setMovImporte(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Medio de pago</Label>
                <Select value={movMedio} onValueChange={setMovMedio}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MEDIOS_PAGO.map(m => <SelectItem key={m} value={m}>{MEDIO_LABELS[m]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {movMedio !== "efectivo" && movMedio !== "debito" && movMedio !== "credito" && (
              <div className="space-y-1">
                <Label className="text-xs">Referencia *</Label>
                <Input className="h-8 text-xs" placeholder="N° transferencia, etc." value={movRef} onChange={(e) => setMovRef(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setMovOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={guardarMovimiento} disabled={guardandoMov}>{guardandoMov ? "Guardando..." : "Registrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog cierre */}
      <Dialog open={cierreOpen} onOpenChange={setCierreOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Cerrar caja</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            {/* Resumen general */}
            <div className="grid grid-cols-3 gap-2 text-xs bg-muted/50 rounded-md px-3 py-2">
              <div><span className="text-muted-foreground">Ingresos</span><p className="font-medium text-green-600">{fmt(totalIngresos)}</p></div>
              <div><span className="text-muted-foreground">Egresos</span><p className="font-medium text-red-500">{fmt(totalEgresos)}</p></div>
              <div><span className="text-muted-foreground">Saldo final</span><p className="font-medium">{fmt(saldoFinal)}</p></div>
            </div>

            {/* Desglose por medio de pago */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Desglose por medio de pago</p>
              <div className="rounded-md border divide-y text-xs">
                {(() => {
                  const medios: Record<string, { ingresos: number; egresos: number }> = {
                    efectivo: { ingresos: cajaActiva?.saldo_inicial ?? 0, egresos: 0 }
                  };
                  movimientos.forEach(m => {
                    if (!medios[m.medio_pago]) medios[m.medio_pago] = { ingresos: 0, egresos: 0 };
                    if (m.tipo === "ingreso") medios[m.medio_pago].ingresos += m.importe;
                    else medios[m.medio_pago].egresos += m.importe;
                  });
                  return Object.entries(medios).map(([medio, vals]) => (
                    <div key={medio} className="flex items-center justify-between px-3 py-1.5">
                      <span className="font-medium">{MEDIO_LABELS[medio] ?? medio}</span>
                      <span className={`font-medium ${(vals.ingresos - vals.egresos) >= 0 ? "" : "text-red-500"}`}>
                        {fmt(vals.ingresos - vals.egresos)}
                      </span>
                    </div>
                  ));
                })()}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">¿Conforme? *</Label>
              <div className="flex gap-2">
                <Button
                  type="button" size="sm" variant={cierreConforme === true ? "default" : "outline"}
                  className={cierreConforme === true ? "bg-green-600 hover:bg-green-700" : ""}
                  onClick={() => setCierreConforme(true)}
                >
                  <CheckCircle2 className="h-4 w-4" /> Conforme
                </Button>
                <Button
                  type="button" size="sm" variant={cierreConforme === false ? "default" : "outline"}
                  className={cierreConforme === false ? "bg-red-500 hover:bg-red-600" : ""}
                  onClick={() => setCierreConforme(false)}
                >
                  <XCircle className="h-4 w-4" /> No conforme
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Comentario {cierreConforme === false ? "*" : ""}</Label>
              <Textarea
                className="text-xs resize-none" rows={2}
                placeholder={cierreConforme === false ? "Describí la discrepancia..." : "Observaciones opcionales..."}
                value={cierreComentario}
                onChange={(e) => setCierreComentario(e.target.value)}
              />
            </div>
            {cajaActiva?.creado_por === user?.id && (
              <p className="text-xs text-amber-600">⚠ Quien cierra la caja debe ser distinto a quien la abrió.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCierreOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={cerrarCaja} disabled={cerrando || cajaActiva?.creado_por === user?.id}>
              {cerrando ? "Cerrando..." : "Confirmar cierre"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
