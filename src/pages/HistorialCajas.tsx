import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TrendingUp, TrendingDown } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

type EstadoCaja = "abierta" | "cerrada_conforme" | "cerrada_no_conforme";

interface Caja {
  id: string;
  fecha: string;
  nombre: string;
  saldo_inicial: number;
  estado: EstadoCaja;
  comentario_cierre: string | null;
  created_at: string;
  movimientos_caja: { tipo: "ingreso" | "egreso"; importe: number }[];
}

interface Movimiento {
  id: string;
  tipo: "ingreso" | "egreso";
  concepto: string;
  categoria: string | null;
  importe: number;
  medio_pago: string;
  created_at: string;
}

const ESTADO_INFO: Record<EstadoCaja, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  abierta: { label: "Abierta", variant: "default" },
  cerrada_conforme: { label: "Conforme", variant: "secondary" },
  cerrada_no_conforme: { label: "No conforme", variant: "destructive" },
};

const fmt = (n: number) => `$\u00A0${Number(n).toLocaleString("es-AR", { minimumFractionDigits: 0 })}`;

const MEDIO_LABELS: Record<string, string> = {
  efectivo: "Efectivo", transferencia: "Transferencia", debito: "Débito",
  credito: "Crédito", mercadopago: "MercadoPago", otro: "Otro",
};

export default function HistorialCajas() {
  const [cajas, setCajas] = useState<Caja[]>([]);
  const [loading, setLoading] = useState(true);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [cajaDetalle, setCajaDetalle] = useState<Caja | null>(null);
  const [movDetalle, setMovDetalle] = useState<Movimiento[]>([]);

  useEffect(() => {
    document.title = "Historial de cajas | Consultorio";
    cargar();
  }, []);

  async function cargar() {
    setLoading(true);
    let q = supabase.from("caja_diaria")
      .select("*, movimientos_caja(tipo, importe)")
      .order("fecha", { ascending: false }).order("created_at", { ascending: false });
    if (fechaDesde) q = q.gte("fecha", fechaDesde);
    if (fechaHasta) q = q.lte("fecha", fechaHasta);
    const { data } = await q;
    setCajas((data ?? []) as Caja[]);
    setLoading(false);
  }

  async function verDetalle(caja: Caja) {
    setCajaDetalle(caja);
    const { data } = await supabase
      .from("movimientos_caja")
      .select("*")
      .eq("caja_id", caja.id)
      .order("created_at");
    setMovDetalle((data ?? []) as Movimiento[]);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Historial de cajas</h1>
        <p className="text-sm text-muted-foreground">Registro histórico de todas las cajas</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Listado</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-3 mb-4">
            <Input type="date" className="w-36" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} placeholder="Desde" />
            <Input type="date" className="w-36" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} placeholder="Hasta" />
            <button className="text-xs text-primary underline" onClick={cargar}>Filtrar</button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Ingresos</TableHead>
                <TableHead className="text-right">Egresos</TableHead>
                <TableHead className="text-right">Saldo final</TableHead>
                <TableHead>Comentario</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : cajas.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Sin cajas</TableCell></TableRow>
              ) : cajas.map((c) => {
                const ing = c.movimientos_caja.filter(m => m.tipo === "ingreso").reduce((s, m) => s + m.importe, 0);
                const eg = c.movimientos_caja.filter(m => m.tipo === "egreso").reduce((s, m) => s + m.importe, 0);
                const sf = c.saldo_inicial + ing - eg;
                return (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => verDetalle(c)}>
                    <TableCell className="text-xs">{format(parseISO(c.fecha), "dd/MM/yyyy", { locale: es })}</TableCell>
                    <TableCell className="text-xs font-medium">{c.nombre}</TableCell>
                    <TableCell>
                      <Badge variant={ESTADO_INFO[c.estado].variant} className="text-xs">
                        {ESTADO_INFO[c.estado].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono text-green-600">{fmt(ing)}</TableCell>
                    <TableCell className="text-right text-xs font-mono text-red-500">{fmt(eg)}</TableCell>
                    <TableCell className="text-right text-xs font-mono font-semibold">{fmt(sf)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">{c.comentario_cierre ?? "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog detalle */}
      <Dialog open={!!cajaDetalle} onOpenChange={(v) => { if (!v) setCajaDetalle(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{cajaDetalle?.nombre} — {cajaDetalle ? format(parseISO(cajaDetalle.fecha), "dd/MM/yyyy", { locale: es }) : ""}</DialogTitle>
          </DialogHeader>
          {cajaDetalle && (
            <div className="space-y-3">
              <div className="flex gap-4 text-xs">
                <span>Saldo inicial: <strong>{fmt(cajaDetalle.saldo_inicial)}</strong></span>
                <span>Estado: <Badge variant={ESTADO_INFO[cajaDetalle.estado].variant} className="text-xs">{ESTADO_INFO[cajaDetalle.estado].label}</Badge></span>
              </div>
              {cajaDetalle.comentario_cierre && (
                <p className="text-xs text-muted-foreground">Comentario: {cajaDetalle.comentario_cierre}</p>
              )}
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
                  {movDetalle.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sin movimientos</TableCell></TableRow>
                  ) : movDetalle.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs">{new Date(m.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</TableCell>
                      <TableCell>
                        {m.tipo === "ingreso"
                          ? <span className="text-xs text-green-600 flex items-center gap-1"><TrendingUp className="h-3 w-3" />Ingreso</span>
                          : <span className="text-xs text-red-500 flex items-center gap-1"><TrendingDown className="h-3 w-3" />Egreso</span>
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
              {(() => {
                const ing = movDetalle.filter(m => m.tipo === "ingreso").reduce((s, m) => s + m.importe, 0);
                const eg = movDetalle.filter(m => m.tipo === "egreso").reduce((s, m) => s + m.importe, 0);
                const sf = cajaDetalle.saldo_inicial + ing - eg;
                return (
                  <div className="flex justify-end gap-6 text-xs pt-2 border-t">
                    <span>Ingresos: <strong className="text-green-600">{fmt(ing)}</strong></span>
                    <span>Egresos: <strong className="text-red-500">{fmt(eg)}</strong></span>
                    <span>Saldo final: <strong>{fmt(sf)}</strong></span>
                  </div>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
