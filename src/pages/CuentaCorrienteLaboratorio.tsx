import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface LabCuenta {
  laboratorio_id: string;
  nombre: string;
  total_debe: number;
  total_haber: number;
  saldo: number;
}

interface Orden {
  id: string;
  tipo_trabajo: string;
  costo_final: number;
  costo_presupuestado: number;
  created_at: string;
  pagos_laboratorio: { importe: number }[];
}

const fmt = (n: number) =>
  `$\u00A0${Number(n).toLocaleString("es-AR", { minimumFractionDigits: 0 })}`;

export default function CuentaCorrienteLaboratorio() {
  const [cuentas, setCuentas] = useState<LabCuenta[]>([]);
  const [labSeleccionado, setLabSeleccionado] = useState("todos");
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Cuenta corriente laboratorios | Consultorio";
    cargar();
  }, []);

  async function cargar() {
    setLoading(true);
    const { data } = await supabase.from("cuenta_corriente_laboratorio").select("*");
    setCuentas((data ?? []) as unknown as LabCuenta[]);
    setLoading(false);
  }

  useEffect(() => {
    if (labSeleccionado === "todos") { setOrdenes([]); return; }
    cargarOrdenes(labSeleccionado);
  }, [labSeleccionado]);

  async function cargarOrdenes(labId: string) {
    const { data } = await supabase
      .from("ordenes_trabajo")
      .select("id, tipo_trabajo, costo_final, costo_presupuestado, created_at, pagos_laboratorio(importe)")
      .eq("laboratorio_id", labId)
      .order("created_at", { ascending: false });
    setOrdenes((data ?? []) as unknown as Orden[]);
  }

  const totalDebe = cuentas.reduce((s, c) => s + Number(c.total_debe), 0);
  const totalHaber = cuentas.reduce((s, c) => s + Number(c.total_haber), 0);
  const totalSaldo = totalDebe - totalHaber;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cuenta corriente laboratorios</h1>
        <p className="text-sm text-muted-foreground">Saldos pendientes con cada laboratorio</p>
      </div>

      {/* Resumen global */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Debe total</div>
            <div className="text-2xl font-bold font-mono mt-1">{fmt(totalDebe)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Pagado total</div>
            <div className="text-2xl font-bold font-mono mt-1 text-green-600">{fmt(totalHaber)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Saldo pendiente</div>
            <div className={`text-2xl font-bold font-mono mt-1 ${totalSaldo > 0 ? "text-amber-600" : "text-green-600"}`}>
              {fmt(totalSaldo)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla por laboratorio */}
      <Card>
        <CardHeader><CardTitle className="text-base">Por laboratorio</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Laboratorio</TableHead>
                <TableHead className="text-right">Debe</TableHead>
                <TableHead className="text-right">Pagado</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : cuentas.filter(c => Number(c.saldo) > 0).length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Sin saldos pendientes</TableCell></TableRow>
              ) : cuentas.filter(c => Number(c.saldo) > 0).map((c) => (
                <TableRow
                  key={c.laboratorio_id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setLabSeleccionado(labSeleccionado === c.laboratorio_id ? "todos" : c.laboratorio_id)}
                >
                  <TableCell className="font-medium">{c.nombre}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(Number(c.total_debe))}</TableCell>
                  <TableCell className="text-right font-mono text-green-600">{fmt(Number(c.total_haber))}</TableCell>
                  <TableCell className="text-right font-mono font-semibold text-amber-600">{fmt(Number(c.saldo))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detalle del laboratorio seleccionado */}
      {labSeleccionado !== "todos" && ordenes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Detalle — {cuentas.find(c => c.laboratorio_id === labSeleccionado)?.nombre}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo de trabajo</TableHead>
                  <TableHead className="text-right">Costo</TableHead>
                  <TableHead className="text-right">Pagado</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordenes.map((o) => {
                  const pagado = o.pagos_laboratorio.reduce((s, p) => s + p.importe, 0);
                  const costo = o.costo_final || o.costo_presupuestado;
                  const saldo = costo - pagado;
                  return (
                    <TableRow key={o.id}>
                      <TableCell className="text-xs">{new Date(o.created_at).toLocaleDateString("es-AR")}</TableCell>
                      <TableCell className="text-xs">{o.tipo_trabajo}</TableCell>
                      <TableCell className="text-right text-xs font-mono">{fmt(costo)}</TableCell>
                      <TableCell className="text-right text-xs font-mono text-green-600">{fmt(pagado)}</TableCell>
                      <TableCell className={`text-right text-xs font-mono font-semibold ${saldo > 0 ? "text-amber-600" : "text-green-600"}`}>{fmt(saldo)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
