import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Plus } from "lucide-react";
import CobroDialog from "@/components/cobros/CobroDialog";

const ESTADO_LABEL: Record<string, string> = {
  borrador: "Borrador",
  entregado: "Entregado",
  aceptado: "Aceptado",
  rechazado: "Rechazado",
  parcialmente_ejecutado: "Parc. ejecutado",
  finalizado: "Finalizado",
};

const MEDIO_LABEL: Record<string, string> = {
  efectivo: "Efectivo", transferencia: "Transferencia", debito: "Débito",
  credito: "Crédito", mercadopago: "MercadoPago", otro: "Otro",
};

// Estados que computan saldo pendiente
const ESTADOS_DEUDA = ["aceptado", "parcialmente_ejecutado", "entregado"];

interface Presupuesto {
  id: string;
  fecha: string;
  estado: string;
  total: number;
  aplicado: number;
}

interface Cobro {
  id: string;
  fecha: string;
  importe: number;
  medio_pago: string;
  referencia: string | null;
  presupuesto_id: string | null;
}

const fmt = (n: number) =>
  `$${Number(n).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;

export default function CuentaCorriente({ pacienteId }: { pacienteId: string }) {
  const [loading, setLoading] = useState(true);
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [cobroOpen, setCobroOpen] = useState(false);

  useEffect(() => {
    cargar();
  }, [pacienteId]);

  async function cargar() {
    setLoading(true);
    const [{ data: ps }, { data: cs }] = await Promise.all([
      supabase
        .from("presupuestos")
        .select("id, fecha, estado, total")
        .eq("paciente_id", pacienteId)
        .order("fecha", { ascending: false }),
      supabase
        .from("cobros")
        .select("id, fecha, importe, medio_pago, referencia, aplicaciones:cobro_aplicaciones(presupuesto_id, importe_aplicado)")
        .eq("paciente_id", pacienteId)
        .order("fecha", { ascending: false }),
    ]);

    const presIds = (ps ?? []).map((p) => p.id);
    let aplicSums: Record<string, number> = {};
    if (presIds.length) {
      const { data: aps } = await supabase
        .from("cobro_aplicaciones")
        .select("presupuesto_id, importe_aplicado")
        .in("presupuesto_id", presIds);
      (aps ?? []).forEach((a) => {
        if (a.presupuesto_id) {
          aplicSums[a.presupuesto_id] =
            (aplicSums[a.presupuesto_id] ?? 0) + Number(a.importe_aplicado);
        }
      });
    }

    setPresupuestos(
      (ps ?? []).map((p) => ({
        id: p.id,
        fecha: p.fecha,
        estado: p.estado,
        total: Number(p.total),
        aplicado: aplicSums[p.id] ?? 0,
      }))
    );

    setCobros(
      (cs ?? []).map((c: any) => ({
        id: c.id,
        fecha: c.fecha,
        importe: Number(c.importe),
        medio_pago: c.medio_pago,
        referencia: c.referencia,
        presupuesto_id: c.aplicaciones?.[0]?.presupuesto_id ?? null,
      }))
    );

    setLoading(false);
  }

  const totalFacturado = presupuestos
    .filter((p) => ESTADOS_DEUDA.includes(p.estado))
    .reduce((acc, p) => acc + p.total, 0);
  const totalAplicado = presupuestos
    .filter((p) => ESTADOS_DEUDA.includes(p.estado))
    .reduce((acc, p) => acc + p.aplicado, 0);
  const totalCobrado = cobros.reduce((acc, c) => acc + c.importe, 0);
  const aCuenta = totalCobrado - totalAplicado; // cobros sin imputar
  const saldoPendiente = totalFacturado - totalAplicado;

  if (loading) return <div className="text-muted-foreground">Cargando cuenta corriente...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button onClick={() => setCobroOpen(true)} size="sm">
          <Plus className="h-4 w-4" /> Registrar cobro
        </Button>
      </div>

      <CobroDialog
        open={cobroOpen}
        onOpenChange={setCobroOpen}
        pacienteId={pacienteId}
        onSaved={cargar}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <SummaryCard label="Total facturado" hint="Presupuestos con deuda activa" value={fmt(totalFacturado)} />
        <SummaryCard label="Aplicado a presupuestos" value={fmt(totalAplicado)} />
        <SummaryCard label="A cuenta (sin imputar)" value={fmt(aCuenta)} />
        <SummaryCard
          label="Saldo pendiente"
          value={fmt(saldoPendiente)}
          highlight={saldoPendiente > 0 ? "danger" : "ok"}
        />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Presupuestos</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Aplicado</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {presupuestos.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sin presupuestos</TableCell></TableRow>
              ) : presupuestos.map((p) => {
                const saldo = ESTADOS_DEUDA.includes(p.estado) ? p.total - p.aplicado : 0;
                return (
                  <TableRow key={p.id}>
                    <TableCell>{new Date(p.fecha).toLocaleDateString("es-AR")}</TableCell>
                    <TableCell><Badge variant="secondary">{ESTADO_LABEL[p.estado] ?? p.estado}</Badge></TableCell>
                    <TableCell className="text-right font-mono">{fmt(p.total)}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(p.aplicado)}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{fmt(saldo)}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/presupuestos/${p.id}`}><ExternalLink className="h-4 w-4" /></Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Cobros</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Medio</TableHead>
                <TableHead>Referencia</TableHead>
                <TableHead>Aplicación</TableHead>
                <TableHead className="text-right">Importe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cobros.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sin cobros</TableCell></TableRow>
              ) : cobros.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{new Date(c.fecha).toLocaleDateString("es-AR")}</TableCell>
                  <TableCell><Badge variant="secondary">{MEDIO_LABEL[c.medio_pago] ?? c.medio_pago}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{c.referencia ?? "-"}</TableCell>
                  <TableCell>
                    {c.presupuesto_id ? (
                      <Link to={`/presupuestos/${c.presupuesto_id}`} className="text-primary hover:underline text-sm">
                        Presupuesto
                      </Link>
                    ) : <span className="text-muted-foreground text-sm">A cuenta</span>}
                  </TableCell>
                  <TableCell className="text-right font-mono">{fmt(c.importe)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, hint, highlight }: {
  label: string; value: string; hint?: string; highlight?: "ok" | "danger";
}) {
  const valueClass =
    highlight === "danger" ? "text-destructive" :
    highlight === "ok" ? "text-emerald-600 dark:text-emerald-400" : "";
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold font-mono mt-1 ${valueClass}`}>{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}
