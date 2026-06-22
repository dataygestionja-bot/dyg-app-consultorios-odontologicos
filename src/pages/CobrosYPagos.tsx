import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Banknote, FlaskConical } from "lucide-react";
import { format, parseISO, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";

interface CobroRow {
  id: string;
  fecha: string;
  importe: number;
  medio_pago: string | null;
  usuario_registro: string | null;
  paciente: { nombre: string; apellido: string } | null;
  aplicaciones: {
    practica: {
      prestacion: { codigo: string; descripcion: string } | null;
    } | null;
  }[];
}

interface PagoLabRow {
  id: string;
  importe: number;
  medio_pago: string | null;
  created_at: string;
  nro_orden: string | null;
  orden: {
    id: string;
    created_at: string;
    fecha_estimada_entrega: string | null;
    paciente: { nombre: string; apellido: string } | null;
  } | null;
}

const fmt = (n: number) =>
  `$ ${Number(n).toLocaleString("es-AR", { minimumFractionDigits: 0 })}`;

const fmtFecha = (s: string) => {
  try {
    return format(parseISO(s), "dd/MM/yyyy", { locale: es });
  } catch {
    return s;
  }
};

export default function CobrosYPagos() {
  const { user } = useAuth();
  const hoy = format(new Date(), "yyyy-MM-dd");
  const primeroDeMes = format(startOfMonth(new Date()), "yyyy-MM-dd");

  const [desde, setDesde] = useState(primeroDeMes);
  const [hasta, setHasta] = useState(hoy);
  const [cobros, setCobros] = useState<CobroRow[]>([]);
  const [pagosLab, setPagosLab] = useState<PagoLabRow[]>([]);
  const [perfiles, setPerfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Cobros y pagos | Consultorio";
    if (user) cargar();
  }, [user]);

  async function cargar() {
    setLoading(true);

    // Obtener el profesional_id del usuario logueado
    const { data: profData } = await supabase
      .from("profesionales")
      .select("id")
      .eq("user_id", user!.id)
      .maybeSingle();
    const profesionalId = profData?.id ?? null;

    // Cobros: filtrar por usuario_registro (quien registró el cobro)
    let cobrosQuery = supabase
      .from("cobros")
      .select(
        `id, fecha, importe, medio_pago, usuario_registro,
         paciente:pacientes(nombre, apellido),
         aplicaciones:cobro_aplicaciones(
           practica:atencion_practicas(
             prestacion:prestaciones(codigo, descripcion)
           )
         )`
      )
      .eq("usuario_registro", user!.id)
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha", { ascending: false });

    // Pagos lab: filtrar por profesional a través de ordenes_trabajo
    let pagosQuery: Promise<any>;
    if (profesionalId) {
      const { data: ordenIds } = await supabase
        .from("ordenes_trabajo")
        .select("id")
        .eq("profesional_id", profesionalId);
      const ids = (ordenIds ?? []).map((o: any) => o.id);
      if (ids.length > 0) {
        pagosQuery = supabase
          .from("pagos_laboratorio")
          .select(
            `id, importe, medio_pago, created_at, nro_orden,
             orden:ordenes_trabajo(
               id, created_at, fecha_estimada_entrega,
               paciente:pacientes(nombre, apellido)
             )`
          )
          .in("orden_id", ids)
          .gte("created_at", desde + "T00:00:00")
          .lte("created_at", hasta + "T23:59:59")
          .order("created_at", { ascending: false });
      } else {
        pagosQuery = Promise.resolve({ data: [] });
      }
    } else {
      pagosQuery = Promise.resolve({ data: [] });
    }

    const [cobrosRes, pagosRes, profsRes] = await Promise.all([
      cobrosQuery,
      pagosQuery,
      supabase.from("profiles").select("id, nombre, apellido"),
    ]);

    const map: Record<string, string> = {};
    (profsRes.data ?? []).forEach((p: any) => {
      map[p.id] = `${p.nombre ?? ""} ${p.apellido ?? ""}`.trim() || "—";
    });
    setPerfiles(map);
    setCobros((cobrosRes.data ?? []) as CobroRow[]);
    setPagosLab((pagosRes.data ?? []) as PagoLabRow[]);
    setLoading(false);
  }

  const totalCobros = cobros.reduce((s, c) => s + (c.importe ?? 0), 0);
  const totalPagos = pagosLab.reduce((s, p) => s + (p.importe ?? 0), 0);

  function getPractica(c: CobroRow): string {
    const prest = c.aplicaciones?.[0]?.practica?.prestacion;
    if (!prest) return "—";
    return `${prest.codigo} · ${prest.descripcion}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cobros y pagos</h1>
        <p className="text-sm text-muted-foreground">
          Detalle de cobros a pacientes y pagos al laboratorio
        </p>
      </div>

      {/* Filtro de fecha */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="date"
          className="w-36"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
        />
        <span className="text-sm text-muted-foreground">hasta</span>
        <Input
          type="date"
          className="w-36"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
        />
        <Button variant="outline" size="sm" onClick={cargar}>
          Aplicar
        </Button>
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total cobros
            </CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{fmt(totalCobros)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {cobros.length} {cobros.length === 1 ? "registro" : "registros"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total pagos laboratorio
            </CardTitle>
            <FlaskConical className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{fmt(totalPagos)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {pagosLab.length} {pagosLab.length === 1 ? "registro" : "registros"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla cobros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cobros a pacientes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Cargando...</p>
          ) : cobros.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Sin cobros en el período seleccionado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Práctica</TableHead>
                    <TableHead className="text-right">Importe</TableHead>
                    <TableHead>Cobró</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cobros.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="whitespace-nowrap">{fmtFecha(c.fecha)}</TableCell>
                      <TableCell>
                        {c.paciente
                          ? `${c.paciente.apellido}, ${c.paciente.nombre}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm">{getPractica(c)}</TableCell>
                      <TableCell className="text-right">
                        <span className="font-medium">{fmt(c.importe)}</span>
                        {c.medio_pago && (
                          <p className="text-xs text-muted-foreground capitalize">{c.medio_pago}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        {c.usuario_registro ? (perfiles[c.usuario_registro] ?? "—") : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabla pagos laboratorio */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pagos al laboratorio</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Cargando...</p>
          ) : pagosLab.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Sin pagos al laboratorio en el período seleccionado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead>Paciente</TableHead>
                    <TableHead className="text-right">Importe</TableHead>
                    <TableHead>Nro de orden</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagosLab.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="whitespace-nowrap">
                        {p.orden?.created_at ? fmtFecha(p.orden.created_at) : "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {p.orden?.fecha_estimada_entrega
                          ? fmtFecha(p.orden.fecha_estimada_entrega)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {p.orden?.paciente
                          ? `${p.orden.paciente.apellido}, ${p.orden.paciente.nombre}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-medium">{fmt(p.importe)}</span>
                        {p.medio_pago && (
                          <p className="text-xs text-muted-foreground capitalize">{p.medio_pago}</p>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {p.nro_orden ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
