import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { format, parseISO, startOfMonth, differenceInCalendarDays } from "date-fns";
import { es } from "date-fns/locale";

interface Cobro {
  id: string;
  fecha: string;
  importe: number;
  medio_pago: string;
  referencia: string | null;
  paciente: { nombre: string; apellido: string } | null;
  cobro_aplicaciones: Array<{
    importe_aplicado: number;
    atencion: { profesional: { nombre: string; apellido: string } | null } | null;
  }>;
}

interface Egreso {
  id: string;
  concepto: string;
  categoria: string | null;
  importe: number;
  medio_pago: string;
  created_at: string;
  caja: { fecha: string } | null;
}

const MEDIO_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  debito: "Débito",
  credito: "Crédito",
  mercadopago: "MercadoPago",
  otro: "Otro",
};

function formatMoney(n: number) {
  return `$ ${n.toLocaleString("es-AR")}`;
}

export default function ManagerFinanciero() {
  const hoy = format(new Date(), "yyyy-MM-dd");
  const primeroDeMes = format(startOfMonth(new Date()), "yyyy-MM-dd");

  const [fechaDesde, setFechaDesde] = useState(primeroDeMes);
  const [fechaHasta, setFechaHasta] = useState(hoy);
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [egresos, setEgresos] = useState<Egreso[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Indicadores financieros | Consultorio";
    cargar();
  }, []);

  async function cargar() {
    setLoading(true);

    const [{ data: cobrosData }, cajaResult] = await Promise.all([
      supabase
        .from("cobros")
        .select("id, fecha, importe, medio_pago, referencia, paciente:pacientes(nombre, apellido), cobro_aplicaciones(importe_aplicado, atencion:atenciones(profesional:profesionales(nombre, apellido)))")
        .gte("fecha", fechaDesde)
        .lte("fecha", fechaHasta)
        .order("fecha", { ascending: false }),

      supabase
        .from("caja_diaria" as any)
        .select("id")
        .gte("fecha", fechaDesde)
        .lte("fecha", fechaHasta),
    ]);

    setCobros((cobrosData ?? []) as unknown as Cobro[]);

    const cajaIds = ((cajaResult.data ?? []) as any[]).map((c) => c.id);
    if (cajaIds.length > 0) {
      const { data: egresosData } = await supabase
        .from("movimientos_caja" as any)
        .select("id, concepto, categoria, importe, medio_pago, created_at, caja:caja_diaria(fecha)")
        .in("caja_id", cajaIds)
        .eq("tipo", "egreso")
        .order("created_at", { ascending: false });
      setEgresos((egresosData ?? []) as unknown as Egreso[]);
    } else {
      setEgresos([]);
    }

    setLoading(false);
  }

  const totalIngresos = cobros.reduce((s, c) => s + c.importe, 0);
  const totalEgresos = egresos.reduce((s, e) => s + e.importe, 0);

  const diasEnRango = differenceInCalendarDays(
    parseISO(fechaHasta),
    parseISO(fechaDesde)
  ) + 1;
  const promedioDiario = diasEnRango > 0 ? totalIngresos / diasEnRango : 0;

  // Agrupación de cobros por medio de pago
  const cobrosPorMedio = cobros.reduce<Record<string, number>>((acc, c) => {
    acc[c.medio_pago] = (acc[c.medio_pago] ?? 0) + c.importe;
    return acc;
  }, {});

  // Agrupación de cobros por profesional (via cobro_aplicaciones → atenciones → profesionales)
  const cobrosPorProfesional = Object.values(
    cobros.reduce<Record<string, { nombre: string; total: number; cantidad: number }>>((acc, c) => {
      const prof = c.cobro_aplicaciones?.[0]?.atencion?.profesional;
      const key = prof ? `${prof.apellido}, ${prof.nombre}` : "Sin profesional asignado";
      if (!acc[key]) acc[key] = { nombre: key, total: 0, cantidad: 0 };
      acc[key].total += c.importe;
      acc[key].cantidad += 1;
      return acc;
    }, {})
  ).sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Indicadores financieros</h1>
        <p className="text-sm text-muted-foreground">Ingresos y egresos del consultorio</p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label>Desde</Label>
          <Input type="date" className="w-36" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Hasta</Label>
          <Input type="date" className="w-36" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
        </div>
        <Button onClick={cargar} disabled={loading}>
          {loading ? "Cargando..." : "Filtrar"}
        </Button>
      </div>

      {/* Cards de resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-green-600 mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Ingresos</span>
            </div>
            <p className="text-2xl font-bold">{formatMoney(totalIngresos)}</p>
            <p className="text-xs text-muted-foreground mt-1">{cobros.length} cobro{cobros.length !== 1 ? "s" : ""}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-500 mb-1">
              <TrendingDown className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Egresos</span>
            </div>
            <p className="text-2xl font-bold">{formatMoney(totalEgresos)}</p>
            <p className="text-xs text-muted-foreground mt-1">{egresos.length} gasto{egresos.length !== 1 ? "s" : ""}</p>
          </CardContent>
        </Card>

<Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <BarChart3 className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Promedio diario</span>
            </div>
            <p className="text-2xl font-bold">{formatMoney(Math.round(promedioDiario))}</p>
            <p className="text-xs text-muted-foreground mt-1">ingresos / {diasEnRango} día{diasEnRango !== 1 ? "s" : ""}</p>
          </CardContent>
        </Card>
      </div>

      {/* Cobros por medio de pago */}
      {Object.keys(cobrosPorMedio).length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Ingresos por medio de pago</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {Object.entries(cobrosPorMedio)
                .sort(([, a], [, b]) => b - a)
                .map(([medio, total]) => (
                  <div key={medio} className="bg-muted rounded-lg px-4 py-3 min-w-[140px]">
                    <p className="text-xs text-muted-foreground mb-1">{MEDIO_LABEL[medio] ?? medio}</p>
                    <p className="font-semibold">{formatMoney(total)}</p>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cobros por profesional */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Facturado por profesional
        </h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : cobrosPorProfesional.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin cobros en el período</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cobrosPorProfesional.map((prof) => (
              <Card key={prof.nombre}>
                <CardContent className="pt-5">
                  <p className="font-semibold text-base leading-tight">{prof.nombre}</p>
                  <p className="text-2xl font-bold text-green-600 mt-2">{formatMoney(prof.total)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {prof.cantidad} cobro{prof.cantidad !== 1 ? "s" : ""} en el período
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Panel B: Gastos (egresos) */}
      <Card>
        <CardHeader><CardTitle className="text-base">Gastos registrados</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead className="hidden md:table-cell">Categoría</TableHead>
                <TableHead className="hidden sm:table-cell">Medio</TableHead>
                <TableHead className="text-right">Importe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : egresos.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sin gastos en el período</TableCell></TableRow>
              ) : egresos.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {e.caja?.fecha
                      ? format(parseISO(e.caja.fecha), "dd/MM/yyyy", { locale: es })
                      : format(parseISO(e.created_at), "dd/MM/yyyy", { locale: es })}
                  </TableCell>
                  <TableCell className="text-sm font-medium">{e.concepto}</TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{e.categoria ?? "—"}</TableCell>
                  <TableCell className="hidden sm:table-cell text-xs">{MEDIO_LABEL[e.medio_pago] ?? e.medio_pago}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-red-500">
                    {formatMoney(e.importe)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
