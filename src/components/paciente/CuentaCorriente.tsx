import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

type MedioPago = "efectivo" | "transferencia" | "debito" | "credito" | "mercadopago" | "otro";

const MEDIOS_PAGO: { value: MedioPago; label: string }[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "debito", label: "Débito" },
  { value: "credito", label: "Crédito" },
  { value: "mercadopago", label: "MercadoPago" },
  { value: "otro", label: "Otro" },
];

interface CobroAplicacion {
  importe_aplicado: number;
  cobro_id: string;
  cobro: { id: string; fecha: string; importe: number; medio_pago: string } | null;
}

interface Practica {
  id: string;
  debe: number;
  prestacion: { codigo: string; descripcion: string } | null;
  cobro_aplicaciones: CobroAplicacion[];
}

interface Atencion {
  id: string;
  fecha: string;
  profesional: { nombre: string; apellido: string } | null;
  atencion_practicas: Practica[];
}

const fmt = (n: number) =>
  `$ ${Number(n).toLocaleString("es-AR", { minimumFractionDigits: 0 })}`;

function haberPractica(p: Practica): number {
  return p.cobro_aplicaciones.reduce((s, c) => s + (c.importe_aplicado ?? 0), 0);
}

function saldoPractica(p: Practica): number {
  return (p.debe ?? 0) - haberPractica(p);
}

export default function CuentaCorriente({ pacienteId, profesionalId }: { pacienteId: string; profesionalId?: string }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [atenciones, setAtenciones] = useState<Atencion[]>([]);
  const [pagoAbierto, setPagoAbierto] = useState<string | null>(null);
  const [pagoImporte, setPagoImporte] = useState("");
  const [pagoMedio, setPagoMedio] = useState<MedioPago>("efectivo");
  const [pagoReferencia, setPagoReferencia] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    cargar();
  }, [pacienteId, profesionalId]);

  async function cargar() {
    setLoading(true);
    let query = supabase
      .from("atenciones")
      .select(`
        id, fecha,
        profesional:profesionales(nombre, apellido),
        atencion_practicas(
          id, debe,
          prestacion:prestaciones(codigo, descripcion),
          cobro_aplicaciones(importe_aplicado, cobro_id, cobro:cobros(id, fecha, importe, medio_pago))
        )
      `)
      .eq("paciente_id", pacienteId)
      .order("fecha", { ascending: false });

    if (profesionalId) query = query.eq("profesional_id", profesionalId) as typeof query;

    const { data } = await query;

    const rows = (data ?? []) as unknown as Atencion[];

    // Solo atenciones que tienen al menos una práctica con saldo > 0
    const conSaldo = rows.filter((a) =>
      a.atencion_practicas.some((p) => saldoPractica(p) > 0)
    );

    setAtenciones(conSaldo);
    setLoading(false);
  }

  async function handleRegistrarPago(atencion: Atencion) {
    const importe = parseFloat(pagoImporte);
    const practicasConSaldo = atencion.atencion_practicas.filter((p) => saldoPractica(p) > 0);
    const saldoTotal = practicasConSaldo.reduce((s, p) => s + saldoPractica(p), 0);
    if (!importe || importe <= 0 || importe > saldoTotal) return;

    setGuardando(true);

    const { data: cobro, error } = await supabase
      .from("cobros")
      .insert({
        fecha: new Date().toISOString().slice(0, 10),
        paciente_id: pacienteId,
        importe,
        medio_pago: pagoMedio,
        referencia: pagoReferencia.trim() || null,
        usuario_registro: user?.id ?? null,
      })
      .select("id")
      .single();

    if (error || !cobro) {
      toast.error("Error al registrar el cobro", { description: error?.message });
      setGuardando(false);
      return;
    }

    let remaining = importe;
    for (const p of practicasConSaldo) {
      if (remaining <= 0) break;
      const aplicar = Math.min(remaining, saldoPractica(p));
      const { error: errApl } = await supabase.from("cobro_aplicaciones").insert({
        cobro_id: cobro.id,
        atencion_id: atencion.id,
        practica_id: p.id,
        importe_aplicado: aplicar,
      } as any);
      if (errApl) {
        toast.error("Error al aplicar el cobro", { description: errApl.message });
        setGuardando(false);
        return;
      }
      remaining -= aplicar;
    }

    setPagoAbierto(null);
    setPagoImporte("");
    setPagoMedio("efectivo");
    setPagoReferencia("");
    setGuardando(false);
    cargar();
  }

  const totalDebe = atenciones.reduce((s, a) =>
    s + a.atencion_practicas.reduce((ss, p) => ss + (p.debe ?? 0), 0), 0);
  const totalHaber = atenciones.reduce((s, a) =>
    s + a.atencion_practicas.reduce((ss, p) => ss + haberPractica(p), 0), 0);
  const totalSaldo = totalDebe - totalHaber;

  if (loading) return <div className="text-muted-foreground py-4">Cargando cuenta corriente...</div>;

  return (
    <div className="space-y-4">
      {/* Cards resumen */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Debe total</div>
            <div className="text-2xl font-bold font-mono mt-1">{fmt(totalDebe)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Haber total</div>
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

      {/* Detalle por atención */}
      {atenciones.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            No hay prestaciones con saldo pendiente.
          </CardContent>
        </Card>
      ) : (
        atenciones.map((a) => {
          const practicasConSaldo = a.atencion_practicas.filter((p) => saldoPractica(p) > 0);
          if (practicasConSaldo.length === 0) return null;

          const saldoAtencion = practicasConSaldo.reduce((s, p) => s + saldoPractica(p), 0);

          const cobrosHistorial = [
            ...new Map(
              a.atencion_practicas
                .flatMap((p) => p.cobro_aplicaciones)
                .filter((ca) => ca.cobro)
                .map((ca) => [ca.cobro_id, ca.cobro!])
            ).values(),
          ].sort((x, y) => y.fecha.localeCompare(x.fecha));

          return (
            <Card key={a.id}>
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm font-medium">
                    {format(parseISO(a.fecha), "dd/MM/yyyy", { locale: es })}
                    {a.profesional && (
                      <span className="text-muted-foreground font-normal ml-2">
                        · Dr. {a.profesional.apellido}, {a.profesional.nombre}
                      </span>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-amber-600 border-amber-300 bg-amber-50">
                      Saldo: {fmt(saldoAtencion)}
                    </Badge>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => {
                        if (pagoAbierto === a.id) {
                          setPagoAbierto(null);
                        } else {
                          setPagoAbierto(a.id);
                          setPagoImporte(String(saldoAtencion));
                          setPagoMedio("efectivo");
                          setPagoReferencia("");
                        }
                      }}
                    >
                      Registrar pago
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-3">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Prestación</TableHead>
                      <TableHead className="text-right">Debe</TableHead>
                      <TableHead className="text-right">Haber</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {practicasConSaldo.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <span className="font-medium text-xs">{p.prestacion?.codigo}</span>
                          <span className="text-muted-foreground text-xs"> · {p.prestacion?.descripcion}</span>
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono">{fmt(p.debe ?? 0)}</TableCell>
                        <TableCell className="text-right text-xs font-mono text-green-600">{fmt(haberPractica(p))}</TableCell>
                        <TableCell className="text-right text-xs font-mono font-semibold text-amber-600">
                          {fmt(saldoPractica(p))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Historial de pagos */}
                {cobrosHistorial.length > 0 && (
                  <div className="border-t pt-2 mt-2 space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">Pagos registrados</p>
                    {cobrosHistorial.map((c) => (
                      <div key={c.id} className="flex gap-4 text-xs">
                        <span>{format(parseISO(c.fecha), "dd/MM/yyyy", { locale: es })}</span>
                        <span className="font-mono text-green-600">{fmt(c.importe)}</span>
                        <span className="text-muted-foreground capitalize">{c.medio_pago}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Formulario inline de pago */}
                {pagoAbierto === a.id && (
                  <div className="border-t pt-3 mt-2 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Nuevo pago</p>
                    <div className="flex flex-wrap gap-2 items-end">
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Importe</label>
                        <Input
                          type="number"
                          value={pagoImporte}
                          onChange={(e) => setPagoImporte(e.target.value)}
                          className="w-32 h-8 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Medio de pago</label>
                        <Select value={pagoMedio} onValueChange={(v) => setPagoMedio(v as MedioPago)}>
                          <SelectTrigger className="w-40 h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MEDIOS_PAGO.map((m) => (
                              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {["transferencia", "mercadopago", "otro"].includes(pagoMedio) && (
                        <div>
                          <label className="text-xs text-muted-foreground block mb-1">Referencia</label>
                          <Input
                            value={pagoReferencia}
                            onChange={(e) => setPagoReferencia(e.target.value)}
                            className="w-40 h-8 text-sm"
                            placeholder="Nro. / detalle"
                          />
                        </div>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        className="h-8"
                        onClick={() => handleRegistrarPago(a)}
                        disabled={guardando}
                      >
                        {guardando ? "Guardando..." : "Confirmar"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8"
                        onClick={() => setPagoAbierto(null)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
