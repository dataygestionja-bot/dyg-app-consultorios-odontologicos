import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface CobroAplicacion {
  importe_aplicado: number;
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
  `$\u00A0${Number(n).toLocaleString("es-AR", { minimumFractionDigits: 0 })}`;

function haberPractica(p: Practica): number {
  return p.cobro_aplicaciones.reduce((s, c) => s + (c.importe_aplicado ?? 0), 0);
}

function saldoPractica(p: Practica): number {
  return (p.debe ?? 0) - haberPractica(p);
}

export default function CuentaCorriente({ pacienteId, profesionalId }: { pacienteId: string; profesionalId?: string }) {
  const [loading, setLoading] = useState(true);
  const [atenciones, setAtenciones] = useState<Atencion[]>([]);

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
          cobro_aplicaciones(importe_aplicado)
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

          return (
            <Card key={a.id}>
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    {format(parseISO(a.fecha), "dd/MM/yyyy", { locale: es })}
                    {a.profesional && (
                      <span className="text-muted-foreground font-normal ml-2">
                        · Dr. {a.profesional.apellido}, {a.profesional.nombre}
                      </span>
                    )}
                  </CardTitle>
                  <Badge variant="secondary" className="text-amber-600 border-amber-300 bg-amber-50">
                    Saldo: {fmt(practicasConSaldo.reduce((s, p) => s + saldoPractica(p), 0))}
                  </Badge>
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
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
