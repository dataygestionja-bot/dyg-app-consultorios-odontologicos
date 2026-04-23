import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ROLE_LABELS, ROLES, type AppRole } from "@/lib/constants";
import {
  ACTION_LABELS,
  DEFAULT_PERMISSIONS,
  MODULES,
  PERMISSION_ACTIONS,
  type PermissionAction,
} from "@/lib/permissions";
import { usePermissions } from "@/hooks/usePermissions";

type Matrix = Record<string, Record<PermissionAction, boolean>>;

const ROLE_TABS: AppRole[] = [ROLES.ADMIN, ROLES.RECEPCION, ROLES.PROFESIONAL];

function emptyMatrix(): Matrix {
  return Object.fromEntries(
    MODULES.map((m) => [m.key, { read: false, create: false, update: false, delete: false }]),
  ) as Matrix;
}

export default function Perfiles() {
  const { refresh } = usePermissions();
  const [activeRole, setActiveRole] = useState<AppRole>(ROLES.ADMIN);
  const [matrices, setMatrices] = useState<Record<AppRole, Matrix>>({
    admin: emptyMatrix(),
    recepcion: emptyMatrix(),
    profesional: emptyMatrix(),
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = "Perfiles de seguridad | Consultorio";
    cargar();
  }, []);

  async function cargar() {
    setLoading(true);
    const { data, error } = await supabase
      .from("role_permissions")
      .select("role, module, action, allowed");
    if (error) {
      toast.error("No se pudieron cargar los permisos", { description: error.message });
      setLoading(false);
      return;
    }
    const next: Record<AppRole, Matrix> = {
      admin: emptyMatrix(),
      recepcion: emptyMatrix(),
      profesional: emptyMatrix(),
    };
    (data ?? []).forEach((r) => {
      const role = r.role as AppRole;
      const mod = r.module as string;
      const act = r.action as PermissionAction;
      if (next[role] && next[role][mod]) {
        next[role][mod][act] = !!r.allowed;
      }
    });
    setMatrices(next);
    setLoading(false);
  }

  function toggle(role: AppRole, mod: string, action: PermissionAction, value: boolean) {
    setMatrices((prev) => {
      const m = { ...prev[role][mod], [action]: value };
      // auto-implicación: si activa create/update/delete, encender read
      if (value && action !== "read") m.read = true;
      // si apaga read, apagar el resto también (no podés modificar lo que no podés leer)
      if (!value && action === "read") {
        m.create = false;
        m.update = false;
        m.delete = false;
      }
      return { ...prev, [role]: { ...prev[role], [mod]: m } };
    });
  }

  function restaurarDefaults() {
    setMatrices((prev) => ({ ...prev, [activeRole]: structuredClone(DEFAULT_PERMISSIONS[activeRole]) }));
    toast.message("Valores por defecto cargados", {
      description: "Apretá Guardar cambios para aplicarlos.",
    });
  }

  async function guardar() {
    setSaving(true);
    const matrix = matrices[activeRole];
    const rows = MODULES.flatMap((m) =>
      PERMISSION_ACTIONS.map((a) => ({
        role: activeRole,
        module: m.key,
        action: a,
        allowed: !!matrix[m.key][a],
      })),
    );
    const { error } = await supabase
      .from("role_permissions")
      .upsert(rows, { onConflict: "role,module,action" });
    if (error) {
      setSaving(false);
      toast.error("No se pudieron guardar los permisos", { description: error.message });
      return;
    }
    try {
      await supabase.rpc("log_audit_event", {
        _accion: "UPDATE",
        _entidad: "role_permissions",
        _descripcion: `Permisos actualizados para rol ${ROLE_LABELS[activeRole]}`,
      });
    } catch {
      /* noop */
    }
    await refresh();
    setSaving(false);
    toast.success(`Permisos del perfil ${ROLE_LABELS[activeRole]} actualizados`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Perfiles de seguridad</h1>
        <p className="text-sm text-muted-foreground">
          Definí qué puede hacer cada perfil dentro del sistema. Los cambios se aplican inmediatamente.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Matriz de permisos</CardTitle>
          <CardDescription>
            Marcá las acciones permitidas para cada funcionalidad. Activar Alta, Modificación o Baja
            implica también Lectura.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeRole} onValueChange={(v) => setActiveRole(v as AppRole)}>
            <TabsList className="grid grid-cols-3 w-full max-w-xl">
              {ROLE_TABS.map((r) => (
                <TabsTrigger key={r} value={r}>
                  {ROLE_LABELS[r]}
                </TabsTrigger>
              ))}
            </TabsList>

            {ROLE_TABS.map((r) => (
              <TabsContent key={r} value={r} className="mt-4">
                <PermissionMatrix
                  matrix={matrices[r]}
                  loading={loading}
                  onToggle={(mod, action, value) => toggle(r, mod, action, value)}
                />
              </TabsContent>
            ))}
          </Tabs>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button onClick={guardar} disabled={saving || loading}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
            <Button variant="outline" onClick={restaurarDefaults} disabled={loading}>
              Restaurar valores por defecto
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PermissionMatrix({
  matrix,
  loading,
  onToggle,
}: {
  matrix: Matrix;
  loading: boolean;
  onToggle: (mod: string, action: PermissionAction, value: boolean) => void;
}) {
  const rows = useMemo(() => MODULES, []);

  if (loading) {
    return <div className="text-sm text-muted-foreground py-6">Cargando permisos…</div>;
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="w-[280px]">Funcionalidad</TableHead>
            {PERMISSION_ACTIONS.map((a) => (
              <TableHead key={a} className="text-center">
                {ACTION_LABELS[a]}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((m) => {
            const cells = matrix[m.key];
            const lockRead = cells.create || cells.update || cells.delete;
            return (
              <TableRow key={m.key}>
                <TableCell className="font-medium">{m.label}</TableCell>
                {PERMISSION_ACTIONS.map((a) => (
                  <TableCell key={a} className="text-center">
                    <div className="flex justify-center">
                      <Checkbox
                        checked={cells[a]}
                        disabled={a === "read" && lockRead}
                        onCheckedChange={(v) => onToggle(m.key, a, v === true)}
                        aria-label={`${m.label} ${ACTION_LABELS[a]}`}
                      />
                    </div>
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
