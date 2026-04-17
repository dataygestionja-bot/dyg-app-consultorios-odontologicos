import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import type { AppRole } from "@/lib/constants";
import { Shield } from "lucide-react";

interface UsuarioRow {
  id: string;
  email: string | null;
  nombre: string | null;
  apellido: string | null;
  roles: AppRole[];
}

const ROLES: AppRole[] = ["admin", "recepcion", "profesional"];

const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Administrador",
  recepcion: "Recepción",
  profesional: "Profesional",
};

export default function Usuarios() {
  const { user: currentUser } = useAuth();
  const [items, setItems] = useState<UsuarioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<UsuarioRow | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = "Usuarios | Consultorio";
    cargar();
  }, []);

  async function cargar() {
    setLoading(true);
    const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
      supabase.from("profiles").select("id, email, nombre, apellido"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    if (pErr || rErr) {
      toast.error("Error al cargar usuarios", { description: pErr?.message || rErr?.message });
      setLoading(false);
      return;
    }
    const rolesByUser = new Map<string, AppRole[]>();
    (roles ?? []).forEach((r) => {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role as AppRole);
      rolesByUser.set(r.user_id, arr);
    });
    const list: UsuarioRow[] = (profiles ?? []).map((p) => ({
      id: p.id,
      email: p.email,
      nombre: p.nombre,
      apellido: p.apellido,
      roles: rolesByUser.get(p.id) ?? [],
    }));
    list.sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));
    setItems(list);
    setLoading(false);
  }

  function abrirEditar(u: UsuarioRow) {
    setEditing(u);
    setSelectedRoles([...u.roles]);
  }

  function toggleRole(role: AppRole, checked: boolean) {
    setSelectedRoles((prev) => (checked ? [...new Set([...prev, role])] : prev.filter((r) => r !== role)));
  }

  async function guardarRoles() {
    if (!editing) return;
    if (selectedRoles.length === 0) {
      toast.error("El usuario debe tener al menos un rol");
      return;
    }
    if (editing.id === currentUser?.id && !selectedRoles.includes("admin") && editing.roles.includes("admin")) {
      toast.error("No podés quitarte el rol de admin a vos mismo");
      return;
    }
    setSaving(true);
    const toAdd = selectedRoles.filter((r) => !editing.roles.includes(r));
    const toRemove = editing.roles.filter((r) => !selectedRoles.includes(r));

    try {
      if (toAdd.length > 0) {
        const { error } = await supabase
          .from("user_roles")
          .insert(toAdd.map((role) => ({ user_id: editing.id, role })));
        if (error) throw error;
      }
      if (toRemove.length > 0) {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", editing.id)
          .in("role", toRemove);
        if (error) throw error;
      }
      toast.success("Roles actualizados");
      setEditing(null);
      cargar();
    } catch (e: any) {
      toast.error("No se pudieron actualizar los roles", { description: e.message });
    } finally {
      setSaving(false);
    }
  }

  const filtered = items.filter((u) => {
    const q = filter.toLowerCase();
    return (
      (u.email ?? "").toLowerCase().includes(q) ||
      (u.nombre ?? "").toLowerCase().includes(q) ||
      (u.apellido ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Usuarios</h1>
        <p className="text-sm text-muted-foreground">Gestión de usuarios y permisos del sistema</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Listado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="Buscar por email o nombre..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">Cargando...</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">Sin resultados</TableCell>
                </TableRow>
              ) : (
                filtered.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.email}
                      {u.id === currentUser?.id && (
                        <Badge variant="outline" className="ml-2">Vos</Badge>
                      )}
                    </TableCell>
                    <TableCell>{[u.nombre, u.apellido].filter(Boolean).join(" ") || "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {u.roles.length === 0 ? (
                          <Badge variant="secondary">Sin rol</Badge>
                        ) : (
                          u.roles.map((r) => <Badge key={r}>{ROLE_LABEL[r]}</Badge>)
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => abrirEditar(u)}>
                        <Shield className="h-4 w-4" /> Roles
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar roles</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="text-sm text-muted-foreground">{editing?.email}</div>
            <div className="space-y-3">
              {ROLES.map((role) => (
                <label key={role} className="flex items-center gap-3 cursor-pointer">
                  <Checkbox
                    checked={selectedRoles.includes(role)}
                    onCheckedChange={(c) => toggleRole(role, c === true)}
                  />
                  <div>
                    <div className="font-medium">{ROLE_LABEL[role]}</div>
                    <div className="text-xs text-muted-foreground">
                      {role === "admin" && "Acceso total al sistema"}
                      {role === "recepcion" && "Gestión de pacientes, turnos y obras sociales"}
                      {role === "profesional" && "Acceso a sus turnos y atenciones"}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={guardarRoles} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
