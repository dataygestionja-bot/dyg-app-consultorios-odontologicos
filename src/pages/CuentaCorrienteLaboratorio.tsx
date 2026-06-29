import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { format, parseISO, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";

interface Laboratorio { id: string; nombre: string; }
interface Profesional { id: string; nombre: string; apellido: string; }

interface LabCuenta {
  laboratorio_id: string;
  nombre: string;
  total_debe: number;
  total_haber: number;
  saldo: number;
}

interface Movimiento {
  fecha: string;
  tipo: "orden" | "pago";
  concepto: string;
  paciente: string;
  debe: number;
  haber: number;
  nro_orden: string | null;
  medio_pago: string | null;
}

const fmt = (n: number) =>
  `$ ${Number(n).toLocaleString("es-AR", { minimumFractionDigits: 0 })}`;

const fmtFecha = (s: string) => {
  try { return format(parseISO(s), "dd/MM/yyyy", { locale: es }); } catch { return s; }
};

export default function CuentaCorrienteLaboratorio() {
  const { hasAnyRole, hasRole, user, loading: authLoading } = useAuth();
  const esAdminRecepcion = hasAnyRole(["admin", "recepcion"]);
  const esProfesional = hasRole("profesional") && !esAdminRecepcion;

  const hoy = format(new Date(), "yyyy-MM-dd");
  const primeroDeMes = format(startOfMonth(new Date()), "yyyy-MM-dd");

  const [laboratorios, setLaboratorios] = useState<Laboratorio[]>([]);
  const [labId, setLabId] = useState("todos");
  const [labNombre, setLabNombre] = useState("");
  const [desde, setDesde] = useState(primeroDeMes);
  const [hasta, setHasta] = useState(hoy);
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [filtroProfesional, setFiltroProfesional] = useState("todos");
  const [profesionalId, setProfesionalId] = useState<string | null>(null);

  // Vista resumen (todos los labs)
  const [cuentas, setCuentas] = useState<LabCuenta[]>([]);

  // Vista extracto (lab seleccionado)
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [saldoAnterior, setSaldoAnterior] = useState(0);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Cuenta corriente laboratorios | Consultorio";
  }, []);

  useEffect(() => {
    if (authLoading) return;
    inicializar();
  }, [authLoading]);

  async function inicializar() {
    setLoading(true);

    const [{ data: labs }, profData] = await Promise.all([
      supabase.from("laboratorios").select("id, nombre").order("nombre"),
      esAdminRecepcion
        ? supabase.from("profesionales").select("id, nombre, apellido").eq("activo", true).order("apellido")
        : esProfesional && user?.id
          ? supabase.from("profesionales").select("id").eq("user_id", user.id).maybeSingle()
          : Promise.resolve({ data: null }),
    ]);

    setLaboratorios((labs ?? []) as Laboratorio[]);

    if (esAdminRecepcion) {
      setProfesionales((profData.data ?? []) as Profesional[]);
      await cargarResumen(null);
    } else if (esProfesional) {
      const pid = (profData.data as any)?.id ?? null;
      setProfesionalId(pid);
      await cargarResumen(pid);
    } else {
      await cargarResumen(null);
    }

    setLoading(false);
  }

  function resolverProfId(): string | null {
    if (esProfesional) return profesionalId;
    if (esAdminRecepcion && filtroProfesional !== "todos") return filtroProfesional;
    return null;
  }

  async function cargarResumen(profId: string | null) {
    if (!profId && esAdminRecepcion) {
      const { data } = await supabase.from("cuenta_corriente_laboratorio").select("*");
      setCuentas((data ?? []) as unknown as LabCuenta[]);
      return;
    }
    if (!profId) { setCuentas([]); return; }

    const { data: ords } = await supabase
      .from("ordenes_trabajo")
      .select("laboratorio_id, laboratorio:laboratorios(nombre), costo_final, costo_presupuestado, pagos_laboratorio(importe)")
      .eq("profesional_id", profId);

    const mapa = new Map<string, LabCuenta>();
    for (const o of (ords ?? []) as any[]) {
      const lid = o.laboratorio_id;
      const nombre = o.laboratorio?.nombre ?? "—";
      const costo = Number(o.costo_final || o.costo_presupuestado || 0);
      const pagado = (o.pagos_laboratorio ?? []).reduce((s: number, p: any) => s + Number(p.importe), 0);
      if (!mapa.has(lid)) mapa.set(lid, { laboratorio_id: lid, nombre, total_debe: 0, total_haber: 0, saldo: 0 });
      const e = mapa.get(lid)!;
      e.total_debe += costo;
      e.total_haber += pagado;
      e.saldo = e.total_debe - e.total_haber;
    }
    setCuentas(Array.from(mapa.values()));
  }

  async function cargarExtracto(lid: string) {
    const profId = resolverProfId();
    const lab = laboratorios.find(l => l.id === lid);
    setLabNombre(lab?.nombre ?? "");

    // 1. Todas las órdenes del lab (sin filtro de fecha para calcular saldo anterior)
    let ordsQuery = supabase
      .from("ordenes_trabajo")
      .select("id, tipo_trabajo, costo_final, costo_presupuestado, created_at, paciente:pacientes(nombre, apellido)")
      .eq("laboratorio_id", lid);
    if (profId) ordsQuery = ordsQuery.eq("profesional_id", profId) as any;
    const { data: todasOrdenes } = await ordsQuery;
    const allIds = (todasOrdenes ?? []).map((o: any) => o.id);

    // 2. Todos los pagos de esas órdenes (sin filtro de fecha)
    let todosPagos: any[] = [];
    if (allIds.length > 0) {
      const { data: tp } = await supabase
        .from("pagos_laboratorio")
        .select("id, importe, created_at, medio_pago, nro_orden, orden_id")
        .in("orden_id", allIds);
      todosPagos = tp ?? [];
    }

    // 3. Saldo anterior: movimientos ANTES de "desde"
    const debeAnt = (todasOrdenes ?? [])
      .filter((o: any) => o.created_at < desde + "T00:00:00")
      .reduce((s: number, o: any) => s + Number(o.costo_final || o.costo_presupuestado || 0), 0);
    const haberAnt = todosPagos
      .filter(p => p.created_at < desde + "T00:00:00")
      .reduce((s, p) => s + Number(p.importe), 0);
    setSaldoAnterior(debeAnt - haberAnt);

    // 4. Movimientos en el rango
    const ordenEnRango = (todasOrdenes ?? []).filter((o: any) =>
      o.created_at >= desde + "T00:00:00" && o.created_at <= hasta + "T23:59:59"
    );
    const pagosEnRango = todosPagos.filter(p =>
      p.created_at >= desde + "T00:00:00" && p.created_at <= hasta + "T23:59:59"
    );

    const ordenMap = new Map<string, any>();
    for (const o of (todasOrdenes ?? []) as any[]) ordenMap.set(o.id, o);

    const movs: Movimiento[] = [];
    for (const o of ordenEnRango as any[]) {
      movs.push({
        fecha: o.created_at,
        tipo: "orden",
        concepto: `Solicitud - ${o.tipo_trabajo || "Orden de trabajo"}`,
        paciente: o.paciente ? `${o.paciente.apellido}, ${o.paciente.nombre}` : "—",
        debe: Number(o.costo_final || o.costo_presupuestado || 0),
        haber: 0,
        nro_orden: null,
        medio_pago: null,
      });
    }
    for (const p of pagosEnRango) {
      const orden = ordenMap.get(p.orden_id);
      movs.push({
        fecha: p.created_at,
        tipo: "pago",
        concepto: "Pago",
        paciente: orden?.paciente ? `${orden.paciente.apellido}, ${orden.paciente.nombre}` : "—",
        debe: 0,
        haber: Number(p.importe),
        nro_orden: p.nro_orden ?? null,
        medio_pago: p.medio_pago ?? null,
      });
    }

    movs.sort((a, b) => a.fecha.localeCompare(b.fecha));
    setMovimientos(movs);
  }

  async function aplicar() {
    setLoading(true);
    if (labId === "todos") {
      await cargarResumen(resolverProfId());
    } else {
      await cargarExtracto(labId);
    }
    setLoading(false);
  }

  async function seleccionarLab(lid: string) {
    setLabId(lid);
    if (lid !== "todos") {
      setLoading(true);
      await cargarExtracto(lid);
      setLoading(false);
    }
  }

  // Totales extracto
  const totalDebeExtracto = movimientos.reduce((s, m) => s + m.debe, 0);
  const totalHaberExtracto = movimientos.reduce((s, m) => s + m.haber, 0);
  const saldoCierre = saldoAnterior + totalDebeExtracto - totalHaberExtracto;

  // Totales resumen
  const totalDebe = cuentas.reduce((s, c) => s + Number(c.total_debe), 0);
  const totalHaber = cuentas.reduce((s, c) => s + Number(c.total_haber), 0);
  const totalSaldo = totalDebe - totalHaber;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cuenta corriente laboratorios</h1>
        <p className="text-sm text-muted-foreground">
          {labId === "todos" ? "Saldos pendientes con cada laboratorio" : `Extracto — ${labNombre}`}
        </p>
      </div>

      {/* Barra de filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={labId} onValueChange={seleccionarLab}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Todos los laboratorios" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los laboratorios</SelectItem>
            {laboratorios.map(l => (
              <SelectItem key={l.id} value={l.id}>{l.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {labId !== "todos" && (
          <>
            <Input type="date" className="w-36" value={desde} onChange={e => setDesde(e.target.value)} />
            <span className="text-sm text-muted-foreground">hasta</span>
            <Input type="date" className="w-36" value={hasta} onChange={e => setHasta(e.target.value)} />
          </>
        )}

        {esAdminRecepcion && (
          <Select value={filtroProfesional} onValueChange={setFiltroProfesional}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Todos los profesionales" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los profesionales</SelectItem>
              {profesionales.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.apellido}, {p.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button variant="outline" size="sm" onClick={aplicar}>Aplicar</Button>
      </div>

      {/* ── VISTA RESUMEN (todos los labs) ── */}
      {labId === "todos" && (
        <>
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

          <Card>
            <CardHeader><CardTitle className="text-base">Por laboratorio</CardTitle></CardHeader>
            <CardContent className="p-0">
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
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Cargando...</TableCell></TableRow>
                  ) : cuentas.filter(c => Number(c.saldo) > 0).length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sin saldos pendientes</TableCell></TableRow>
                  ) : cuentas.filter(c => Number(c.saldo) > 0).map(c => (
                    <TableRow
                      key={c.laboratorio_id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => seleccionarLab(c.laboratorio_id)}
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
        </>
      )}

      {/* ── VISTA EXTRACTO (lab seleccionado) ── */}
      {labId !== "todos" && (
        <>
          {/* Tarjetas resumen del período */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Saldo anterior</div>
                <div className={`text-xl font-bold font-mono mt-1 ${saldoAnterior > 0 ? "text-amber-600" : "text-green-600"}`}>
                  {fmt(saldoAnterior)}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">al {fmtFecha(desde + "T00:00:00")}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Débitos período</div>
                <div className="text-xl font-bold font-mono mt-1">{fmt(totalDebeExtracto)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Créditos período</div>
                <div className="text-xl font-bold font-mono mt-1 text-green-600">{fmt(totalHaberExtracto)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Saldo al cierre</div>
                <div className={`text-xl font-bold font-mono mt-1 ${saldoCierre > 0 ? "text-amber-600" : "text-green-600"}`}>
                  {fmt(saldoCierre)}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">al {fmtFecha(hasta + "T00:00:00")}</div>
              </CardContent>
            </Card>
          </div>

          {/* Tabla extracto */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Movimientos</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Cargando...</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Concepto</TableHead>
                        <TableHead>Paciente</TableHead>
                        <TableHead className="text-right">Debe</TableHead>
                        <TableHead className="text-right">Haber</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Fila saldo anterior */}
                      {saldoAnterior !== 0 && (
                        <TableRow className="bg-muted/40">
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {fmtFecha(desde + "T00:00:00")}
                          </TableCell>
                          <TableCell className="text-xs italic text-muted-foreground" colSpan={4}>
                            Saldo anterior al período
                          </TableCell>
                          <TableCell className={`text-right text-xs font-mono font-bold ${saldoAnterior > 0 ? "text-amber-600" : "text-green-600"}`}>
                            {fmt(saldoAnterior)}
                          </TableCell>
                        </TableRow>
                      )}

                      {movimientos.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                            Sin movimientos en el período seleccionado
                          </TableCell>
                        </TableRow>
                      ) : (
                        (() => {
                          let saldoAcum = saldoAnterior;
                          return movimientos.map((m, i) => {
                            saldoAcum = saldoAcum + m.debe - m.haber;
                            return (
                              <TableRow key={i} className={m.tipo === "pago" ? "bg-green-50/30 dark:bg-green-950/10" : ""}>
                                <TableCell className="text-xs whitespace-nowrap">{fmtFecha(m.fecha)}</TableCell>
                                <TableCell className="text-xs">
                                  <div className="font-medium">{m.concepto}</div>
                                  {m.tipo === "pago" && (
                                    <div className="text-muted-foreground capitalize text-[11px]">
                                      {m.medio_pago}{m.nro_orden ? ` · Orden ${m.nro_orden}` : ""}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs">{m.paciente}</TableCell>
                                <TableCell className="text-right text-xs font-mono">
                                  {m.debe > 0
                                    ? <span className="text-foreground">{fmt(m.debe)}</span>
                                    : m.tipo === "orden"
                                      ? <span className="text-[11px] text-amber-500 italic">Sin presupuesto</span>
                                      : <span className="text-muted-foreground/40">—</span>}
                                </TableCell>
                                <TableCell className="text-right text-xs font-mono text-green-600">
                                  {m.haber > 0 ? fmt(m.haber) : <span className="text-muted-foreground/40">—</span>}
                                </TableCell>
                                <TableCell className={`text-right text-xs font-mono font-semibold ${saldoAcum > 0 ? "text-amber-600" : "text-green-600"}`}>
                                  {fmt(saldoAcum)}
                                </TableCell>
                              </TableRow>
                            );
                          });
                        })()
                      )}

                      {/* Fila totales */}
                      {movimientos.length > 0 && (
                        <TableRow className="border-t-2 bg-muted/20 font-semibold">
                          <TableCell colSpan={3} className="text-xs text-muted-foreground">Total período</TableCell>
                          <TableCell className="text-right text-xs font-mono">{fmt(totalDebeExtracto)}</TableCell>
                          <TableCell className="text-right text-xs font-mono text-green-600">{fmt(totalHaberExtracto)}</TableCell>
                          <TableCell className={`text-right text-xs font-mono font-bold ${saldoCierre > 0 ? "text-amber-600" : "text-green-600"}`}>
                            {fmt(saldoCierre)}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
