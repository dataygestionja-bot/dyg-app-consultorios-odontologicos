import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
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

interface Atencion {
  id: string;
  fecha: string;
  profesional: { nombre: string; apellido: string } | null;
}

interface PagoLab {
  id: string;
  importe: number;
  created_at: string;
  orden: { profesional: { nombre: string; apellido: string } | null } | null;
}


const MEDIO_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  debito: "Débito",
  credito: "Crédito",
  mercadopago: "MercadoPago",
  otro: "Otro",
};

const PIE_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#8b5cf6"];

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
  const [pagosLab, setPagosLab] = useState<PagoLab[]>([]);
  const [atenciones, setAtenciones] = useState<Atencion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Indicadores Gerenciales | Consultorio";
    cargar();
  }, []);

  async function cargar() {
    setLoading(true);

    const [{ data: cobrosData }, cajaResult, { data: labData }, { data: atencionesData }] = await Promise.all([
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

      supabase
        .from("pagos_laboratorio" as any)
        .select("id, importe, created_at, orden:ordenes_trabajo(profesional:profesionales(nombre, apellido))")
        .gte("created_at", fechaDesde + "T00:00:00")
        .lte("created_at", fechaHasta + "T23:59:59"),

      supabase
        .from("atenciones" as any)
        .select("id, fecha, profesional:profesionales(nombre, apellido)")
        .gte("fecha", fechaDesde)
        .lte("fecha", fechaHasta),
    ]);

    setCobros((cobrosData ?? []) as unknown as Cobro[]);
    setPagosLab((labData ?? []) as unknown as PagoLab[]);
    setAtenciones((atencionesData ?? []) as unknown as Atencion[]);

    const cajaIds = ((cajaResult.data ?? []) as any[]).map((c) => c.id);
    if (cajaIds.length > 0) {
      const { data: egresosData } = await supabase
        .from("movimientos_caja" as any)
        .select("id, concepto, categoria, importe, medio_pago, created_at, caja:caja_diaria(fecha)")
        .in("caja_id", cajaIds)
        .eq("tipo", "egreso")
        .eq("origen", "egreso_manual")
        .order("created_at", { ascending: false });
      setEgresos((egresosData ?? []) as unknown as Egreso[]);
    } else {
      setEgresos([]);
    }

    setLoading(false);
  }

  const totalIngresos = cobros.reduce((s, c) => s + c.importe, 0);
  const totalEgresos = egresos.reduce((s, e) => s + e.importe, 0);

  const diasEnRango = differenceInCalendarDays(parseISO(fechaHasta), parseISO(fechaDesde)) + 1;
  const promedioDiario = diasEnRango > 0 ? totalIngresos / diasEnRango : 0;

  // Cobros por medio de pago
  const cobrosPorMedio = cobros.reduce<Record<string, number>>((acc, c) => {
    acc[c.medio_pago] = (acc[c.medio_pago] ?? 0) + c.importe;
    return acc;
  }, {});

  // Cobros por profesional (via cobro_aplicaciones → atenciones → profesionales)
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

  // Estructura de gastos por concepto (para el pie chart)
  const gastosEstructura = Object.entries(
    egresos.reduce<Record<string, number>>((acc, e) => {
      const key = e.concepto ?? "Sin concepto";
      acc[key] = (acc[key] ?? 0) + e.importe;
      return acc;
    }, {})
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Atenciones por profesional
  const atencionesPorProfesional = Object.values(
    atenciones.reduce<Record<string, { nombre: string; cantidad: number }>>((acc, a) => {
      const prof = (a as any).profesional;
      const key = prof ? `${prof.apellido}, ${prof.nombre}` : "Sin profesional";
      if (!acc[key]) acc[key] = { nombre: key, cantidad: 0 };
      acc[key].cantidad += 1;
      return acc;
    }, {})
  ).sort((a, b) => b.cantidad - a.cantidad);

  // Pagos de laboratorio por profesional
  const labPorProfesional = Object.values(
    pagosLab.reduce<Record<string, { nombre: string; total: number; cantidad: number }>>((acc, p) => {
      const prof = (p.orden as any)?.profesional;
      const key = prof ? `${prof.apellido}, ${prof.nombre}` : "Sin profesional";
      if (!acc[key]) acc[key] = { nombre: key, total: 0, cantidad: 0 };
      acc[key].total += p.importe;
      acc[key].cantidad += 1;
      return acc;
    }, {})
  ).sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Indicadores Gerenciales</h1>
        <p className="text-sm text-muted-foreground">Estadísticas del consultorio</p>
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
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
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

      {/* Ingresos por medio de pago */}
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

      {/* Atenciones por profesional */}
      <Card>
        <CardHeader><CardTitle className="text-base">Atenciones por profesional</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : atencionesPorProfesional.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin atenciones en el período</p>
          ) : (
            <div className="flex flex-wrap gap-4">
              {atencionesPorProfesional.map((prof) => (
                <div key={prof.nombre} className="bg-muted rounded-lg px-4 py-3 min-w-[160px]">
                  <p className="text-xs text-muted-foreground mb-1">{prof.nombre}</p>
                  <p className="font-semibold text-2xl">{prof.cantidad}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Facturado por profesional */}
      <Card>
        <CardHeader><CardTitle className="text-base">Facturado por profesional</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : cobrosPorProfesional.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin cobros en el período</p>
          ) : (
            <div className="flex flex-wrap gap-4">
              {cobrosPorProfesional.map((prof) => (
                <div key={prof.nombre} className="bg-muted rounded-lg px-4 py-3 min-w-[160px]">
                  <p className="text-xs text-muted-foreground mb-1">{prof.nombre}</p>
                  <p className="font-semibold text-green-600">{formatMoney(prof.total)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Estructura de gastos — gráfico de torta */}
      <Card>
        <CardHeader><CardTitle className="text-base">Estructura de gastos</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : gastosEstructura.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin gastos en el período</p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={gastosEstructura}
                  cx="50%"
                  cy="50%"
                  outerRadius={110}
                  dataKey="value"
                  label={({ name, value, percent }) =>
                    `${name}: ${formatMoney(value)} (${(percent * 100).toFixed(1)}%)`
                  }
                  labelLine={true}
                >
                  {gastosEstructura.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatMoney(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Gastos en laboratorio por profesional */}
      <Card>
        <CardHeader><CardTitle className="text-base">Gastos en laboratorio por profesional</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : labPorProfesional.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin pagos de laboratorio en el período</p>
          ) : (
            <div className="flex flex-wrap gap-4">
              {labPorProfesional.map((prof) => (
                <div key={prof.nombre} className="bg-muted rounded-lg px-4 py-3 min-w-[160px]">
                  <p className="text-xs text-muted-foreground mb-1">{prof.nombre}</p>
                  <p className="font-semibold text-red-500">{formatMoney(prof.total)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
