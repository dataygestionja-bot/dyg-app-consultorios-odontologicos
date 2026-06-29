import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";

const CATEGORIAS_EGRESO = [
  { categoria: "Costo directo",            concepto: "Materiales clínicos" },
  { categoria: "Gasto operativo",          concepto: "Insumos descartables" },
  { categoria: "Gasto operativo",          concepto: "Gastos comunes" },
  { categoria: "Gasto operativo",          concepto: "Personal administrativo" },
  { categoria: "Gasto operativo",          concepto: "Servicios" },
  { categoria: "Gasto operativo",          concepto: "Alquiler" },
  { categoria: "Gestión y administración", concepto: "Impuestos y tasas" },
  { categoria: "Gestión y administración", concepto: "Seguros" },
  { categoria: "Gestión y administración", concepto: "Honorarios externos" },
  { categoria: "Gestión y administración", concepto: "Gastos financieros" },
];

const MEDIOS_PAGO = ["efectivo", "transferencia", "debito", "credito", "mercadopago", "otro"] as const;
type MedioPago = (typeof MEDIOS_PAGO)[number];

const MEDIO_LABEL: Record<MedioPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  debito: "Débito",
  credito: "Crédito",
  mercadopago: "MercadoPago",
  otro: "Otro",
};

interface Movimiento {
  id: string;
  concepto: string;
  categoria: string | null;
  importe: number;
  medio_pago: string;
  referencia: string | null;
  created_at: string;
}

export default function CajaDiaria() {
  const { user } = useAuth();

  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);

  // Campos del formulario
  const [fechaGasto, setFechaGasto] = useState(format(new Date(), "yyyy-MM-dd"));
  const [conceptoIdx, setConceptoIdx] = useState<string>("");
  const [importe, setImporte] = useState("");
  const [medio, setMedio] = useState<MedioPago>("efectivo");
  const [referencia, setReferencia] = useState("");

  useEffect(() => {
    document.title = "Caja | Consultorio";
  }, []);

  useEffect(() => {
    cargarEgresos(fechaGasto);
  }, [fechaGasto]);

  async function getOrCreateCaja(fecha: string): Promise<string> {
    const { data } = await supabase
      .from("caja_diaria" as any)
      .select("id")
      .eq("fecha", fecha)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return (data as any).id;

    const { data: nueva } = await supabase
      .from("caja_diaria" as any)
      .insert({
        fecha,
        nombre: "Caja del día",
        saldo_inicial: 0,
        estado: "abierta",
        creado_por: user?.id ?? null,
      })
      .select("id")
      .single();
    return (nueva as any).id;
  }

  async function cargarEgresos(fecha: string) {
    setLoading(true);
    const { data: cajaFecha } = await supabase
      .from("caja_diaria" as any)
      .select("id")
      .eq("fecha", fecha)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!cajaFecha) {
      setMovimientos([]);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("movimientos_caja" as any)
      .select("id, concepto, categoria, importe, medio_pago, referencia, created_at")
      .eq("caja_id", (cajaFecha as any).id)
      .eq("tipo", "egreso")
      .eq("origen", "egreso_manual")
      .order("created_at", { ascending: false });

    setMovimientos((data ?? []) as unknown as Movimiento[]);
    setLoading(false);
  }

  async function registrarGasto() {
    if (!conceptoIdx || !importe || isNaN(Number(importe)) || Number(importe) <= 0) return;

    setGuardando(true);
    const item = CATEGORIAS_EGRESO[Number(conceptoIdx)];
    const id = await getOrCreateCaja(fechaGasto);

    await supabase.from("movimientos_caja" as any).insert({
      caja_id: id,
      tipo: "egreso",
      origen: "egreso_manual",
      concepto: item.concepto,
      categoria: item.categoria,
      importe: Number(importe),
      medio_pago: medio,
      referencia: referencia.trim() || null,
      usuario_registro: user?.id ?? null,
    });

    setConceptoIdx("");
    setImporte("");
    setMedio("efectivo");
    setReferencia("");
    setGuardando(false);
    cargarEgresos(fechaGasto);
  }

  const totalEgresos = movimientos.reduce((s, m) => s + m.importe, 0);
  const hoy = format(new Date(), "EEEE dd 'de' MMMM yyyy", { locale: es });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Registrar gasto</h1>
        <p className="text-sm text-muted-foreground capitalize">{hoy}</p>
      </div>

      {/* Formulario de gasto */}
      <Card>
        <CardHeader><CardTitle className="text-base">Nuevo gasto</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div className="space-y-1">
              <Label>Fecha</Label>
              <Input
                type="date"
                value={fechaGasto}
                max={format(new Date(), "yyyy-MM-dd")}
                onChange={(e) => setFechaGasto(e.target.value)}
              />
            </div>
            <div className="space-y-1 lg:col-span-1">
              <Label>Concepto</Label>
              <Select value={conceptoIdx} onValueChange={setConceptoIdx}>
                <SelectTrigger><SelectValue placeholder="Seleccionar concepto..." /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_EGRESO.map((c, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {c.concepto}
                      <span className="text-xs text-muted-foreground ml-1">({c.categoria})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Importe</Label>
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={importe}
                onChange={(e) => setImporte(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label>Medio de pago</Label>
              <Select value={medio} onValueChange={(v) => setMedio(v as MedioPago)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MEDIOS_PAGO.map((m) => (
                    <SelectItem key={m} value={m}>{MEDIO_LABEL[m]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Referencia <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Input
                placeholder="Nro. factura, recibo..."
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              onClick={registrarGasto}
              disabled={guardando || !conceptoIdx || !importe || Number(importe) <= 0}
            >
              {guardando ? "Guardando..." : "Registrar gasto"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Listado del día */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Gastos del {format(parseISO(fechaGasto), "dd/MM/yyyy")}
            {fechaGasto === format(new Date(), "yyyy-MM-dd") && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">(hoy)</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hora</TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead className="hidden md:table-cell">Categoría</TableHead>
                <TableHead>Medio</TableHead>
                <TableHead className="hidden sm:table-cell">Referencia</TableHead>
                <TableHead className="text-right">Importe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : movimientos.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sin gastos registrados para esta fecha</TableCell></TableRow>
              ) : (
                <>
                  {movimientos.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                        {format(parseISO(m.created_at), "HH:mm", { locale: es })}
                      </TableCell>
                      <TableCell className="font-medium text-sm">{m.concepto}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{m.categoria ?? "—"}</TableCell>
                      <TableCell className="text-xs">{MEDIO_LABEL[m.medio_pago as MedioPago] ?? m.medio_pago}</TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{m.referencia ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        $ {m.importe.toLocaleString("es-AR")}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2">
                    <TableCell colSpan={5} className="font-semibold text-right text-sm">Total egresos</TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      $ {totalEgresos.toLocaleString("es-AR")}
                    </TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
