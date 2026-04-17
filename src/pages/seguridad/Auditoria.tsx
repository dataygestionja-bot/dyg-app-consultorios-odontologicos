import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { toast } from "sonner";

interface AuditRow {
  id: string;
  created_at: string;
  user_email: string | null;
  accion: string;
  entidad: string;
  entidad_id: string | null;
  descripcion: string | null;
  datos_anteriores: unknown;
  datos_nuevos: unknown;
}

const ENTIDADES = ["", "pacientes", "profesionales", "turnos", "atenciones", "user_roles", "obras_sociales", "auth"];
const ACCIONES = ["", "INSERT", "UPDATE", "DELETE", "LOGIN", "LOGOUT", "PASSWORD_CHANGE"];
const PAGE_SIZE = 25;

function accionVariant(a: string): "default" | "secondary" | "destructive" | "outline" {
  if (a === "DELETE") return "destructive";
  if (a === "INSERT" || a === "LOGIN") return "default";
  if (a === "LOGOUT") return "outline";
  return "secondary";
}

export default function Auditoria() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [emailFiltro, setEmailFiltro] = useState("");
  const [entidad, setEntidad] = useState("");
  const [accion, setAccion] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [detalle, setDetalle] = useState<AuditRow | null>(null);

  useEffect(() => {
    document.title = "Auditoría | Seguridad";
  }, []);

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, emailFiltro, entidad, accion, desde, hasta]);

  async function cargar() {
    setLoading(true);
    let q = supabase
      .from("audit_log")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (emailFiltro.trim()) q = q.ilike("user_email", `%${emailFiltro.trim()}%`);
    if (entidad) q = q.eq("entidad", entidad);
    if (accion) q = q.eq("accion", accion);
    if (desde) q = q.gte("created_at", new Date(desde + "T00:00:00").toISOString());
    if (hasta) q = q.lte("created_at", new Date(hasta + "T23:59:59").toISOString());

    const { data, error, count } = await q;
    if (error) {
      toast.error("Error al cargar auditoría", { description: error.message });
      setLoading(false);
      return;
    }
    setRows((data ?? []) as AuditRow[]);
    setTotal(count ?? 0);
    setLoading(false);
  }

  function limpiar() {
    setEmailFiltro("");
    setEntidad("");
    setAccion("");
    setDesde("");
    setHasta("");
    setPage(0);
  }

  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Auditoría de seguridad</h1>
        <p className="text-sm text-muted-foreground">Bitácora detallada de eventos del sistema</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
            <div className="space-y-1">
              <Label htmlFor="email">Usuario (email)</Label>
              <Input
                id="email"
                value={emailFiltro}
                onChange={(e) => {
                  setEmailFiltro(e.target.value);
                  setPage(0);
                }}
                placeholder="usuario@..."
              />
            </div>
            <div className="space-y-1">
              <Label>Entidad</Label>
              <Select
                value={entidad || "all"}
                onValueChange={(v) => {
                  setEntidad(v === "all" ? "" : v);
                  setPage(0);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {ENTIDADES.filter(Boolean).map((e) => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Acción</Label>
              <Select
                value={accion || "all"}
                onValueChange={(v) => {
                  setAccion(v === "all" ? "" : v);
                  setPage(0);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {ACCIONES.filter(Boolean).map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="desde">Desde</Label>
              <Input id="desde" type="date" value={desde} onChange={(e) => { setDesde(e.target.value); setPage(0); }} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="hasta">Hasta</Label>
              <Input id="hasta" type="date" value={hasta} onChange={(e) => { setHasta(e.target.value); setPage(0); }} />
            </div>
          </div>
          <div className="mt-3">
            <Button variant="ghost" size="sm" onClick={limpiar}>Limpiar filtros</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Eventos ({total})</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {page + 1} / {totalPaginas}
            </span>
            <Button variant="outline" size="icon" disabled={page + 1 >= totalPaginas} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead>Entidad</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sin eventos</TableCell></TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-sm">{new Date(r.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-sm">{r.user_email ?? "—"}</TableCell>
                    <TableCell><Badge variant={accionVariant(r.accion)}>{r.accion}</Badge></TableCell>
                    <TableCell className="text-sm">{r.entidad}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{r.descripcion ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setDetalle(r)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!detalle} onOpenChange={(o) => !o && setDetalle(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle del evento</DialogTitle>
          </DialogHeader>
          {detalle && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Fecha:</span> {new Date(detalle.created_at).toLocaleString()}</div>
                <div><span className="text-muted-foreground">Usuario:</span> {detalle.user_email ?? "—"}</div>
                <div><span className="text-muted-foreground">Acción:</span> <Badge variant={accionVariant(detalle.accion)}>{detalle.accion}</Badge></div>
                <div><span className="text-muted-foreground">Entidad:</span> {detalle.entidad}</div>
                {detalle.entidad_id && <div className="col-span-2 break-all"><span className="text-muted-foreground">ID:</span> {detalle.entidad_id}</div>}
              </div>
              {detalle.descripcion && (
                <div><span className="text-muted-foreground">Descripción:</span> {detalle.descripcion}</div>
              )}
              {detalle.datos_anteriores != null && (
                <div>
                  <div className="text-muted-foreground mb-1">Datos anteriores</div>
                  <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-60">
{JSON.stringify(detalle.datos_anteriores, null, 2)}
                  </pre>
                </div>
              )}
              {detalle.datos_nuevos != null && (
                <div>
                  <div className="text-muted-foreground mb-1">Datos nuevos</div>
                  <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-60">
{JSON.stringify(detalle.datos_nuevos, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
