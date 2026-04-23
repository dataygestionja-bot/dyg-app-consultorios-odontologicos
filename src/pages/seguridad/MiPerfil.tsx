import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ROLE_LABELS } from "@/lib/constants";

export default function MiPerfil() {
  const { user, roles } = useAuth();
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = "Mi perfil | Seguridad";
    if (!user) return;
    supabase
      .from("profiles")
      .select("nombre, apellido, email")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setNombre(data?.nombre ?? "");
        setApellido(data?.apellido ?? "");
        setEmail(data?.email ?? user.email ?? "");
        setLoading(false);
      });
  }, [user]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ nombre, apellido })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error("No se pudo guardar", { description: error.message });
      return;
    }
    toast.success("Perfil actualizado");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mi perfil</h1>
        <p className="text-sm text-muted-foreground">Tus datos personales y los roles asignados</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos personales</CardTitle>
          <CardDescription>Información visible dentro del sistema</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Cargando...</div>
          ) : (
            <form onSubmit={guardar} className="space-y-4 max-w-2xl">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre</Label>
                  <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apellido">Apellido</Label>
                  <Input id="apellido" value={apellido} onChange={(e) => setApellido(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={email} disabled />
                <p className="text-xs text-muted-foreground">El email no se puede modificar.</p>
              </div>
              <div className="space-y-2">
                <Label>Mis roles</Label>
                <div className="flex flex-wrap gap-2">
                  {roles.length === 0 ? (
                    <Badge variant="secondary">Sin rol asignado</Badge>
                  ) : (
                    roles.map((r) => <Badge key={r}>{ROLE_LABELS[r]}</Badge>)
                  )}
                </div>
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando..." : "Guardar cambios"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
