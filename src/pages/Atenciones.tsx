import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Eye, ArrowUp, ArrowDown, Pencil } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";
import { RegistrarCobroDialog } from "@/components/atenciones/RegistrarCobroDialog";

type TipoAtencion = "con_turno" | "urgencia" | "espontanea";

interface Cobro { importe_aplicado: number; }
interface Practica { debe: number; cobro_aplicaciones: Cobro[]; }

interface Row {
  id: string;
  fecha: string;
  diagnostico: string | null;
  tipo_atencion: TipoAtencion;
  paciente: { id: string; nombre: string; apellido: string } | null;
  profesional: { id: string; nombre: string; apellido: string } | null;
  turno: { motivo_consulta: string } | null;
  atencion_practicas: Practica[];
}

const TIPO_LABEL: Record<TipoAtencion, string> = {
  con_turno: "Con turno",
  urgencia: "Urgencia",
  espontanea: "Espontánea",
};

const TIPO_VARIANT: Record<TipoAtencion, "default" | "destructive" | "secondary"> = {
  con_turno: "default",
  urgencia: "destructive",
  espontanea: "secondary",
};

function calcDebe(practicas: Practica[]): number {
  return practicas.reduce((acc, p) => acc + (p.debe ?? 0), 0);
}

function calcHaber(practicas: Practica[]): number {
  return practicas.reduce((acc, p) =>
    acc + p.cobro_aplicaciones.reduce((s, c) => s + (c.importe_aplicado ?? 0), 0), 0);
}

function calcSaldo(practicas: Practica[]): number {
  return calcDebe(practicas) - calcHaber(practicas);
}

export default function Atenciones() {
  const { can } = usePermissions();
  const { hasAnyRole, hasRole, user } = useAuth();
  const esAdminRecepcion = hasAnyRole(["admin", "recepcion"]);
  const esProfesional = hasRole("profesional") && !esAdminRecepcion;

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [orden, setOrden] = useState<"desc" | "asc">("desc");
  const [filtroProfesional, setFiltroProfesional] = useState("todos");
  const [filtroPaciente, setFiltroPaciente] = useState("todos");
  const [profesionales, setProfesionales] = useState<{ id: string; nombre: string; apellido: string }[]>([]);
  const [pacientes, setPacientes] = useState<{ id: string; nombre: string; apellido: string }[]>([]);
  const [cobroDialogRow, setCobroDialogRow] = useState<Row | null>(null);

  useEffect(() => {
    document.title = "Atenciones | Consultorio";
    cargar();
  }, []);

  async function cargar() {
    setLoading(true);
    try {
      let query = supabase
        .from("atenciones")
        .select(`
          id, fecha, diagnostico, tipo_atencion,
          paciente:pacientes(id, nombre, apellido),
          profesional:profesionales(id, nombre, apellido),
          turno:turnos(motivo_consulta),
          atencion_practicas(debe, cobro_aplicaciones(importe_aplicado))
        `)
        .order("fecha", { ascending: false });

      // Si es profesional, filtrar por su profesional_id
      if (esProfesional && user?.id) {
        const { data: prof } = await supabase
          .from("profesionales")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (prof?.id) {
          query = query.eq("profesional_id", prof.id) as any;
        } else {
          setRows([]);
          setLoading(false);
          return;
        }
      }

      const hoy = new Date().toISOString().slice(0, 10);
      const [{ data, error }, { data: cobrosHoy }] = await Promise.all([
        query,
        supabase.from("cobros").select("paciente_id").eq("fecha", hoy),
      ]);

      if (error) console.error("Error cargando atenciones:", error);
      const atenciones = (data ?? []) as unknown as Row[];
      const pacientesConCobrosHoy = new Set((cobrosHoy ?? []).map((c) => c.paciente_id));
      const filtradas = esAdminRecepcion
        ? atenciones.filter((a) =>
            calcSaldo(a.atencion_practicas) > 0 ||
            (a.paciente?.id && pacientesConCobrosHoy.has(a.paciente.id))
          )
        : atenciones;

      setRows(filtradas);

      const profs = Array.from(
        new Map(filtradas.map((a) => a.profesional).filter(Boolean).map((p) => [p!.id, p!])).values()
      );
      const pacs = Array.from(
        new Map(filtradas.map((a) => a.paciente).filter(Boolean).map((p) => [p!.id, p!])).values()
      );
      setProfesionales(profs as any);
      setPacientes(pacs as any);
    } finally {
      setLoading(false);
    }
  }

  const filtered = rows
    .filter((r) => {
      if (filtroProfesional !== "todos" && r.profesional?.id !== filtroProfesional) return false;
      if (filtroPaciente !== "todos" && r.paciente?.id !== filtroPaciente) return false;
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        (r.paciente && `${r.paciente.apellido} ${r.paciente.nombre}`.toLowerCase().includes(s)) ||
        (r.turno?.motivo_consulta ?? "").toLowerCase().includes(s) ||
        (r.diagnostico ?? "").toLowerCase().includes(s)
      );
    })
    .sort((a, b) => {
      const cmp = a.fecha.localeCompare(b.fecha);
      return orden === "asc" ? cmp : -cmp;
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Atenciones</h1>
          <p className="text-sm text-muted-foreground">
            {esAdminRecepcion ? "Atenciones con saldo pendiente · hoy saldadas" : "Historial de atenciones clínicas"}
          </p>
        </div>
        {can("atenciones", "create") && !esAdminRecepcion && (
          <Button asChild>
            <Link to="/atenciones/nuevo"><Plus className="h-4 w-4" /> Nueva atención</Link>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Listado</CardTitle></CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-3">
            {!esAdminRecepcion && (
              <Input
                placeholder="Buscar por paciente, motivo o diagnóstico..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-xs"
              />
            )}
            <Select value={filtroProfesional} onValueChange={setFiltroProfesional}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Profesional" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los profesionales</SelectItem>
                {profesionales.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.apellido}, {p.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!esAdminRecepcion && (
              <Select value={filtroPaciente} onValueChange={setFiltroPaciente}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Paciente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los pacientes</SelectItem>
                  {pacientes.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.apellido}, {p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">
                    <button type="button" onClick={() => setOrden((o) => (o === "asc" ? "desc" : "asc"))}
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                      Fecha
                      {orden === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                    </button>
                  </TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead className={esAdminRecepcion ? "" : "hidden lg:table-cell"}>Profesional</TableHead>
                  {!esAdminRecepcion && <TableHead>Tipo</TableHead>}
                  {!esAdminRecepcion && <TableHead className="min-w-[180px]">Motivo del turno</TableHead>}
                  {!esAdminRecepcion && <TableHead className="hidden md:table-cell">Diagnóstico</TableHead>}
                  {esAdminRecepcion && <TableHead className="text-right">Debe</TableHead>}
                  {esAdminRecepcion && <TableHead className="text-right">Haber</TableHead>}
                  {esAdminRecepcion && <TableHead className="text-right">Saldo</TableHead>}
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Cargando...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">
                    {esAdminRecepcion ? "No hay atenciones con saldo pendiente" : "Sin atenciones"}
                  </TableCell></TableRow>
                ) : filtered.map((a) => {
                  const debe = calcDebe(a.atencion_practicas);
                  const haber = calcHaber(a.atencion_practicas);
                  const saldo = debe - haber;
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="whitespace-nowrap">{format(parseISO(a.fecha), "dd/MM/yyyy", { locale: es })}</TableCell>
                      <TableCell className="font-medium">
                        <div>{a.paciente ? `${a.paciente.apellido}, ${a.paciente.nombre}` : "—"}</div>
                        {!esAdminRecepcion && (
                          <div className="text-xs text-muted-foreground lg:hidden">
                            {a.profesional ? `${a.profesional.apellido}, ${a.profesional.nombre}` : "—"}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className={esAdminRecepcion ? "" : "hidden lg:table-cell"}>
                        {a.profesional ? `${a.profesional.apellido}, ${a.profesional.nombre}` : "—"}
                      </TableCell>
                      {!esAdminRecepcion && (
                        <TableCell>
                          <Badge variant={TIPO_VARIANT[a.tipo_atencion]} className="whitespace-nowrap">
                            {TIPO_LABEL[a.tipo_atencion]}
                          </Badge>
                        </TableCell>
                      )}
                      {!esAdminRecepcion && (
                        <TableCell className="max-w-[180px] sm:max-w-[240px]">
                          <div className="truncate">{a.turno?.motivo_consulta ?? (a.tipo_atencion !== "con_turno" ? TIPO_LABEL[a.tipo_atencion] : "—")}</div>
                          <div className="text-xs text-muted-foreground truncate md:hidden">{a.diagnostico ?? ""}</div>
                        </TableCell>
                      )}
                      {!esAdminRecepcion && (
                        <TableCell className="hidden md:table-cell max-w-[200px] truncate">{a.diagnostico ?? "—"}</TableCell>
                      )}
                      {esAdminRecepcion && (
                        <TableCell className="text-right font-medium whitespace-nowrap">
                          $ {debe.toLocaleString("es-AR")}
                        </TableCell>
                      )}
                      {esAdminRecepcion && (
                        <TableCell className="text-right font-medium whitespace-nowrap">
                          {haber > 0 ? <span className="text-green-600">$ {haber.toLocaleString("es-AR")}</span> : "—"}
                        </TableCell>
                      )}
                      {esAdminRecepcion && (
                        <TableCell className="text-right font-medium whitespace-nowrap">
                          {saldo > 0 ? (
                            <span className="text-amber-600">$ {saldo.toLocaleString("es-AR")}</span>
                          ) : (
                            <span className="text-green-600 text-xs">✓ Saldado</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {!esAdminRecepcion && (
                            <Button asChild variant="ghost" size="sm">
                              <Link to={`/atenciones/${a.id}/ver`}><Eye className="h-4 w-4" /></Link>
                            </Button>
                          )}
                          {esAdminRecepcion && (
                            <Button variant="ghost" size="sm" onClick={() => setCobroDialogRow(a)}>
                              <Pencil className="h-4 w-4 mr-1" /> Registrar cobro
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {cobroDialogRow && (
        <RegistrarCobroDialog
          atencionId={cobroDialogRow.id}
          pacienteId={cobroDialogRow.paciente?.id ?? ""}
          fecha={cobroDialogRow.fecha}
          open={!!cobroDialogRow}
          onOpenChange={(v) => { if (!v) setCobroDialogRow(null); }}
          onSaved={() => { setCobroDialogRow(null); cargar(); }}
        />
      )}
    </div>
  );
}
