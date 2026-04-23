import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

interface ObraSocial {
  id: string;
  nombre: string;
  activo: boolean;
}

export default function ObrasSociales() {
  const { can } = usePermissions();
  const [items, setItems] = useState<ObraSocial[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ObraSocial | null>(null);
  const [nombre, setNombre] = useState("");
  const [activo, setActivo] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    document.title = "Obras sociales | Consultorio";
    cargar();
  }, []);

  async function cargar() {
    setLoading(true);
    const { data, error } = await supabase.from("obras_sociales").select("*").order("nombre");
    if (error) toast.error("Error al cargar", { description: error.message });
    setItems(data ?? []);
    setLoading(false);
  }

  function abrirNuevo() {
    setEditing(null);
    setNombre("");
    setActivo(true);
    setOpen(true);
  }

  function abrirEditar(o: ObraSocial) {
    setEditing(o);
    setNombre(o.nombre);
    setActivo(o.activo);
    setOpen(true);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (editing) {
      const { error } = await supabase
        .from("obras_sociales")
        .update({ nombre, activo })
        .eq("id", editing.id);
      if (error) return toast.error("No se pudo actualizar", { description: error.message });
      toast.success("Obra social actualizada");
    } else {
      const { error } = await supabase.from("obras_sociales").insert({ nombre, activo });
      if (error) return toast.error("No se pudo crear", { description: error.message });
      toast.success("Obra social creada");
    }
    setOpen(false);
    cargar();
  }

  const filtered = items.filter((i) => i.nombre.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Obras sociales</h1>
          <p className="text-sm text-muted-foreground">Catálogo de obras sociales / prepagas</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          {can("obras_sociales", "create") && (
            <DialogTrigger asChild>
              <Button onClick={abrirNuevo}><Plus className="h-4 w-4" /> Nueva</Button>
            </DialogTrigger>
          )}
          <DialogContent>
            <form onSubmit={guardar}>
              <DialogHeader>
                <DialogTitle>{editing ? "Editar obra social" : "Nueva obra social"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre</Label>
                  <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="activo">Activa</Label>
                  <Switch id="activo" checked={activo} onCheckedChange={setActivo} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit">Guardar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Listado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input placeholder="Buscar por nombre..." value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Sin resultados</TableCell></TableRow>
              ) : (
                filtered.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.nombre}</TableCell>
                    <TableCell>
                      {o.activo ? <Badge>Activa</Badge> : <Badge variant="secondary">Inactiva</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      {can("obras_sociales", "update") && (
                        <Button variant="ghost" size="sm" onClick={() => abrirEditar(o)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
