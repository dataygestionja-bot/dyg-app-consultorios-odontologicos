import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, AlertCircle, CheckCircle2, Pencil } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { OrdenTrabajoDialog } from "@/components/atenciones/OrdenTrabajoDialog";
import { EditarOrdenDialog } from "@/components/atenciones/EditarOrdenDialog";

interface Orden {
  id: string;
  tipo_trabajo: string;
  prioridad: "alta" | "media" | "baja";
  estado: "gestionar_pedido" | "enviado" | "entregado";
  fecha_estimada_entrega: string | null;
  fecha_pedido: string | null;
  costo_presupuestado: number;
  costo_final: number;
  created_at: string;
  profesional_id: string | null;
  paciente: { nombre: string; apellido: string } | null;
  profesional: { nombre: string; apellido: string } | null;
  laboratorio: { id: string; nombre: string } | null;
  pagos_laboratorio: { importe: number }[];
}

interface Laboratorio { id: string; nombre: string; }
interface Profesional { id: string; nombre: string; apellido: string; }

const PRIORIDAD_COLORS = {
  alta: "bg-red-500 text-white",
  media: "bg-yellow-400 text-yellow-950",
  baja: "bg-[#78e911] text-green-950",
};

const ESTADO_LABELS: Record<string, string> = {
  gestionar_pedido: "Gestionar pedido",
  enviado: "Enviado al lab",
  entregado: "Entregado",
};

const ESTADO_BADGE_CLASS: Record<string, string> = {
  gestionar_pedido: "bg-purple-100 text-purple-800 border-purple-200",
  enviado: "",
  entregado: "",
};

function DiasRetraso({ fechaEntrega }: { fechaEntrega: string | null }) {
  if (!fechaEntrega) return <span className="text-muted-foreground text-xs">—</span>;
  const dias = differenceInDays(new Date(), parseISO(fechaEntrega));
  if (dias <= 0) return (
    <span className="flex items-center gap-1 text-green-600 text-xs">
      <CheckCircle2 className="h-3 w-3" /> En tiempo
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-red-500 text-xs font-medium">
      <AlertCircle className="h-3 w-3" /> {dias} día{dias > 1 ? "s" : ""} de retraso
    </span>
  );
}

export default function OrdenesTrabajoPage() {
  const { hasAnyRole, hasRole, user, loading: authLoading } = useAuth();
  const esProfesional = hasRole("profesional") && !hasAnyRole(["admin", "recepcion"]);

  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [laboratorios, setLaboratorios] = useState<Laboratorio[]>([]);
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroProfesional, setFiltroProfesional] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroLab, setFiltroLab] = useState("todos");
  const [filtroFechaDesde, setFiltroFechaDesde] = useState("");
  const [filtroFechaHasta, setFiltroFechaHasta] = useState("");
  const [search, setSearch] = useState("");
  const [nuevaOrdenOpen, setNuevaOrdenOpen] = useState(false);
  const [ordenEditar, setOrdenEditar] = useState<Orden | null>(null);
  const [miProfesional, setMiProfesional] = useState<Profesional | null>(null);

  useEffect(() => {
    document.title = "Órdenes de trabajo | Consultorio";
  }, []);

  // Esperar a que el auth esté listo antes de cargar
  useEffect(() => {
    if (authLoading) return;
    cargarTodo();
  }, [authLoading, esProfesional]);

  async function cargarTodo() {
    setLoading(true);

    // Si es profesional, primero resolvemos su profesional_id
    let profesionalId: string | null = null;
    if (esProfesional && user?.id) {
      const { data: prof } = await supabase
        .from("profesionales")
        .select("id, nombre, apellido")
        .eq("user_id", user.id)
        .maybeSingle();
      if (prof) {
        setMiProfesional(prof as Profesional);
        profesionalId = prof.id;
      } else {
        setOrdenes([]);
        setLoading(false);
        return;
      }
    }

    let ordenesQuery = supabase.from("ordenes_trabajo").select(`
      id, tipo_trabajo, prioridad, estado, fecha_estimada_entrega, fecha_pedido,
      costo_presupuestado, costo_final, created_at, profesional_id,
      paciente:pacientes(nombre, apellido),
      profesional:profesionales(nombre, apellido),
      laboratorio:laboratorios(id, nombre),
      pagos_laboratorio(importe)
    `).order("created_at", { ascending: false });

    if (profesionalId) {
      ordenesQuery = ordenesQuery.eq("profesional_id", profesionalId) as any;
    }

    const [{ data: ords }, { data: labs }, { data: profs }] = await Promise.all([
      ordenesQuery,
      supabase.from("laboratorios").select("id, nombre").eq("activo", true).order("nombre"),
      supabase.from("profesionales").select("id, nombre, apellido").eq("activo", true).order("apellido"),
    ]);

    setOrdenes((ords ?? []) as unknown as Orden[]);
    setLaboratorios((labs ?? []) as Laboratorio[]);
    setProfesionales((profs ?? []) as Profesional[]);
    setLoading(false);
  }

  // Pacientes únicos presentes en las órdenes cargadas
  const pacientesEnOrdenes = Array.from(
    new Map(
      ordenes
        .filter((o) => o.paciente)
        .map((o) => [`${o.paciente!.apellido}|${o.paciente!.nombre}`, o.paciente!])
    ).entries()
  )
    .map(([key, p]) => ({ key, nombre: p.nombre, apellido: p.apellido }))
    .sort((a, b) => a.apellido.localeCompare(b.apellido));

  const filtered = ordenes.filter((o) => {
    if (!esProfesional && filtroProfesional !== "todos" && o.profesional_id !== filtroProfesional) return false;
    if (filtroEstado !== "todos" && o.estado !== filtroEstado) return false;
    if (filtroLab !== "todos" && o.laboratorio?.id !== filtroLab) return false;
    if (filtroFechaDesde && o.created_at < filtroFechaDesde) return false;
    if (filtroFechaHasta && o.created_at > filtroFechaHasta + "T23:59:59") return false;
    if (search !== "todos" && search !== "") {
      const key = `${o.paciente?.apellido}|${o.paciente?.nombre}`;
      return key === search;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Órdenes de trabajo</h1>
          <p className="text-sm text-muted-foreground">Trabajos enviados a laboratorios</p>
        </div>
        {!hasAnyRole(["recepcion"]) && (
          <Button size="sm" onClick={() => setNuevaOrdenOpen(true)}>
            <Plus className="h-4 w-4" /> Nueva orden
          </Button>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Listado</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4 items-center">
            {/* 1. Profesional (solo para admin/recepción) */}
            {!esProfesional && (
              <Select value={filtroProfesional} onValueChange={setFiltroProfesional}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Todos los profesionales" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los profesionales</SelectItem>
                  {profesionales.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.apellido}, {p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* 2. Estado */}
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Todos los estados" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                <SelectItem value="gestionar_pedido">Gestionar pedido</SelectItem>
                <SelectItem value="enviado">Enviado al lab</SelectItem>
                <SelectItem value="entregado">Entregado</SelectItem>
              </SelectContent>
            </Select>

            {/* 3. Laboratorio */}
            <Select value={filtroLab} onValueChange={setFiltroLab}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Todos los laboratorios" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los laboratorios</SelectItem>
                {laboratorios.map((l) => <SelectItem key={l.id} value={l.id}>{l.nombre}</SelectItem>)}
              </SelectContent>
            </Select>

            {/* 4. Fecha desde / hasta */}
            <Input type="date" className="w-36" value={filtroFechaDesde} onChange={(e) => setFiltroFechaDesde(e.target.value)} />
            <span className="text-sm text-muted-foreground">hasta</span>
            <Input type="date" className="w-36" value={filtroFechaHasta} onChange={(e) => setFiltroFechaHasta(e.target.value)} />

            {/* 5. Paciente */}
            <Select value={search || "todos"} onValueChange={(v) => setSearch(v === "todos" ? "" : v)}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Todos los pacientes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los pacientes</SelectItem>
                {pacientesEnOrdenes.map((p) => (
                  <SelectItem key={p.key} value={p.key}>{p.apellido}, {p.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Profesional</TableHead>
                  <TableHead>Laboratorio</TableHead>
                  <TableHead>Tipo de trabajo</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Entrega estimada</TableHead>
                  <TableHead>Retraso</TableHead>
                  <TableHead className="text-right">Costo</TableHead>
                  <TableHead>Pago</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground">Cargando...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground">Sin órdenes</TableCell></TableRow>
                ) : filtered.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {format(parseISO(o.created_at), "dd/MM/yyyy", { locale: es })}
                    </TableCell>
                    <TableCell className="text-xs">
                      {o.paciente ? `${o.paciente.apellido}, ${o.paciente.nombre}` : "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {o.profesional ? `${o.profesional.apellido}, ${o.profesional.nombre}` : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{o.laboratorio?.nombre ?? "—"}</TableCell>
                    <TableCell className="text-xs">{o.tipo_trabajo}</TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${PRIORIDAD_COLORS[o.prioridad]}`}>
                        {o.prioridad.charAt(0).toUpperCase() + o.prioridad.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={o.estado === "gestionar_pedido" ? "outline" : "secondary"}
                        className={`text-xs ${ESTADO_BADGE_CLASS[o.estado] ?? ""}`}
                      >
                        {ESTADO_LABELS[o.estado] ?? o.estado}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {o.fecha_estimada_entrega
                        ? format(parseISO(o.fecha_estimada_entrega), "dd/MM/yyyy", { locale: es })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {o.estado === "entregado"
                        ? <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Entregado</span>
                        : <DiasRetraso fechaEntrega={o.fecha_estimada_entrega} />
                      }
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono">
                      ${(o.costo_final || o.costo_presupuestado).toLocaleString("es-AR")}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const costo = o.costo_final || o.costo_presupuestado;
                        const pagado = (o.pagos_laboratorio ?? []).reduce((s, p) => s + p.importe, 0);
                        if (costo === 0) return <span className="text-xs text-muted-foreground">—</span>;
                        if (pagado >= costo) return <Badge className="text-xs bg-green-500 text-white">Saldada</Badge>;
                        if (pagado === 0) return <Badge variant="destructive" className="text-xs">Impaga</Badge>;
                        return <Badge className="text-xs bg-amber-500 text-white">Pago parcial</Badge>;
                      })()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setOrdenEditar(o)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <OrdenTrabajoDialog
        open={nuevaOrdenOpen}
        onOpenChange={setNuevaOrdenOpen}
        atencionId={null}
        pacienteId=""
        pacienteNombre=""
        profesionalId={miProfesional?.id ?? ""}
        profesionalNombre={miProfesional ? `${miProfesional.apellido}, ${miProfesional.nombre}` : ""}
        fecha={format(new Date(), "yyyy-MM-dd")}
        onSaved={cargarTodo}
        standalone
        profesionales={profesionales}
      />

      <EditarOrdenDialog
        orden={ordenEditar}
        open={!!ordenEditar}
        onOpenChange={(v) => { if (!v) setOrdenEditar(null); }}
        onSaved={cargarTodo}
      />
    </div>
  );
}
