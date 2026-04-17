import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { ROLE_LABELS, type AppRole } from "@/lib/constants";

interface UsuarioActivo {
  id: string;
  email: string | null;
  nombre: string | null;
  apellido: string | null;
  roles: AppRole[];
}
interface IntentoFallido {
  email: string;
  intentos: number;
  ultimo: string;
}
interface AccionUsuario {
  user_email: string | null;
  total: number;
  inserts: number;
  updates: number;
  deletes: number;
}

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
}

function descargarCSV(nombre: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    toast.info("Nada para exportar");
    return;
  }
  const blob = new Blob([toCSV(rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nombre}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reportes() {
  const [usuarios, setUsuarios] = useState<UsuarioActivo[]>([]);
  const [fallidos, setFallidos] = useState<IntentoFallido[]>([]);
  const [acciones, setAcciones] = useState<AccionUsuario[]>([]);
  const [desde, setDesde] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [hasta, setHasta] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Reportes de seguridad | Consultorio";
  }, []);

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desde, hasta]);

  async function cargar() {
    setLoading(true);
    const desdeISO = new Date(desde + "T00:00:00").toISOString();
    const hastaISO = new Date(hasta + "T23:59:59").toISOString();

    const [profilesRes, rolesRes, loginsRes, auditRes] = await Promise.all([
      supabase.from("profiles").select("id, email, nombre, apellido"),
      supabase.from("user_roles").select("user_id, role"),
      supabase
        .from("login_attempts")
        .select("email, created_at, exitoso")
        .eq("exitoso", false)
        .gte("created_at", desdeISO)
        .lte("created_at", hastaISO),
      supabase
        .from("audit_log")
        .select("user_email, accion")
        .gte("created_at", desdeISO)
        .lte("created_at", hastaISO),
    ]);

    if (profilesRes.error || rolesRes.error || loginsRes.error || auditRes.error) {
      toast.error("Error al cargar reportes");
      setLoading(false);
      return;
    }

    // Usuarios + roles
    const rolesByUser = new Map<string, AppRole[]>();
    (rolesRes.data ?? []).forEach((r) => {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role as AppRole);
      rolesByUser.set(r.user_id, arr);
    });
    setUsuarios(
      (profilesRes.data ?? []).map((p) => ({
        id: p.id,
        email: p.email,
        nombre: p.nombre,
        apellido: p.apellido,
        roles: rolesByUser.get(p.id) ?? [],
      }))
    );

    // Logins fallidos agrupados por email
    const fMap = new Map<string, { intentos: number; ultimo: string }>();
    (loginsRes.data ?? []).forEach((l) => {
      const cur = fMap.get(l.email) ?? { intentos: 0, ultimo: l.created_at };
      cur.intentos += 1;
      if (l.created_at > cur.ultimo) cur.ultimo = l.created_at;
      fMap.set(l.email, cur);
    });
    setFallidos(
      Array.from(fMap.entries())
        .map(([email, v]) => ({ email, ...v }))
        .sort((a, b) => b.intentos - a.intentos)
    );

    // Acciones por usuario
    const aMap = new Map<string, AccionUsuario>();
    (auditRes.data ?? []).forEach((a) => {
      const key = a.user_email ?? "(sistema)";
      const cur = aMap.get(key) ?? {
        user_email: key,
        total: 0,
        inserts: 0,
        updates: 0,
        deletes: 0,
      };
      cur.total += 1;
      if (a.accion === "INSERT") cur.inserts += 1;
      else if (a.accion === "UPDATE") cur.updates += 1;
      else if (a.accion === "DELETE") cur.deletes += 1;
      aMap.set(key, cur);
    });
    setAcciones(Array.from(aMap.values()).sort((a, b) => b.total - a.total));

    setLoading(false);
  }

  const totalUsuarios = usuarios.length;
  const totalPorRol = useMemo(() => {
    const c: Record<AppRole, number> = { admin: 0, recepcion: 0, profesional: 0 };
    usuarios.forEach((u) => u.roles.forEach((r) => (c[r] += 1)));
    return c;
  }, [usuarios]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reportes de seguridad</h1>
        <p className="text-sm text-muted-foreground">Métricas y exportación de información de acceso</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Período</CardTitle>
          <CardDescription>Aplica a intentos fallidos y acciones por usuario</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="desde">Desde</Label>
              <Input id="desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hasta">Hasta</Label>
              <Input id="hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="usuarios">
        <TabsList>
          <TabsTrigger value="usuarios">Usuarios y roles</TabsTrigger>
          <TabsTrigger value="fallidos">Intentos fallidos</TabsTrigger>
          <TabsTrigger value="acciones">Acciones por usuario</TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Usuarios activos y sus roles</CardTitle>
                <CardDescription>
                  Total: {totalUsuarios} · {Object.entries(totalPorRol).map(([k, v]) => `${ROLE_LABELS[k as AppRole]}: ${v}`).join(" · ")}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  descargarCSV(
                    "usuarios",
                    usuarios.map((u) => ({
                      email: u.email,
                      nombre: u.nombre,
                      apellido: u.apellido,
                      roles: u.roles.map((r) => ROLE_LABELS[r]).join(" | "),
                    }))
                  )
                }
              >
                <Download className="h-4 w-4 mr-1" /> CSV
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Roles</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Cargando...</TableCell></TableRow>
                  ) : usuarios.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Sin datos</TableCell></TableRow>
                  ) : (
                    usuarios.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.email}</TableCell>
                        <TableCell>{[u.nombre, u.apellido].filter(Boolean).join(" ") || "—"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {u.roles.length === 0 ? (
                              <Badge variant="secondary">Sin rol</Badge>
                            ) : (
                              u.roles.map((r) => <Badge key={r}>{ROLE_LABELS[r]}</Badge>)
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fallidos" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Intentos de login fallidos</CardTitle>
                <CardDescription>Agrupados por email en el período seleccionado</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => descargarCSV("login-fallidos", fallidos as unknown as Record<string, unknown>[])}>
                <Download className="h-4 w-4 mr-1" /> CSV
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right">Intentos</TableHead>
                    <TableHead>Último</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Cargando...</TableCell></TableRow>
                  ) : fallidos.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Sin intentos fallidos</TableCell></TableRow>
                  ) : (
                    fallidos.map((f) => (
                      <TableRow key={f.email}>
                        <TableCell className="font-medium">{f.email}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={f.intentos >= 5 ? "destructive" : "secondary"}>{f.intentos}</Badge>
                        </TableCell>
                        <TableCell>{new Date(f.ultimo).toLocaleString()}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="acciones" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Acciones por usuario</CardTitle>
                <CardDescription>Resumen de altas, modificaciones y bajas en el período</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => descargarCSV("acciones-por-usuario", acciones as unknown as Record<string, unknown>[])}>
                <Download className="h-4 w-4 mr-1" /> CSV
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead className="text-right">Altas</TableHead>
                    <TableHead className="text-right">Modificaciones</TableHead>
                    <TableHead className="text-right">Bajas</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Cargando...</TableCell></TableRow>
                  ) : acciones.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sin actividad</TableCell></TableRow>
                  ) : (
                    acciones.map((a) => (
                      <TableRow key={a.user_email ?? "sistema"}>
                        <TableCell className="font-medium">{a.user_email ?? "(sistema)"}</TableCell>
                        <TableCell className="text-right">{a.inserts}</TableCell>
                        <TableCell className="text-right">{a.updates}</TableCell>
                        <TableCell className="text-right">{a.deletes}</TableCell>
                        <TableCell className="text-right font-semibold">{a.total}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
