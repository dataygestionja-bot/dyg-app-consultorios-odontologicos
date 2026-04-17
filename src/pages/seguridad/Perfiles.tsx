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

export default function Perfiles() {
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

  const descripciones: Record<string, string> = {
    admin: "Acceso total: gestión de usuarios, profesionales, configuración y seguridad.",
    recepcion: "Gestión de pacientes, turnos, obras sociales y atención de público.",
    profesional: "Acceso a su agenda y a las atenciones que realiza.",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Perfiles</h1>
        <p className="text-sm text-muted-foreground">Tus datos personales y los roles del sistema</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mi perfil</CardTitle>
            <CardDescription>Tus datos visibles dentro del sistema</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Cargando...</div>
            ) : (
              <form onSubmit={guardar} className="space-y-4">
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Roles del sistema</CardTitle>
            <CardDescription>Permisos que otorga cada perfil</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(Object.keys(ROLE_LABELS) as Array<keyof typeof ROLE_LABELS>).map((r) => (
              <div key={r} className="rounded-md border p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge>{ROLE_LABELS[r]}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{descripciones[r]}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
