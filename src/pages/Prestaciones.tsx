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

interface Prestacion {
  id: string;
  codigo: string;
  descripcion: string;
  categoria: string | null;
  precio_base: number;
  duracion_estimada_min: number;
  activo: boolean;
}

const empty = { codigo: "", descripcion: "", categoria: "", precio_base: 0, duracion_estimada_min: 30, activo: true };

export default function Prestaciones() {
  const { can } = usePermissions();
  const [items, setItems] = useState<Prestacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Prestacion | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [filter, setFilter] = useState("");

  useEffect(() => {
    document.title = "Prestaciones | Consultorio";
    cargar();
  }, []);

  async function cargar() {
    setLoading(true);
    const { data, error } = await supabase.from("prestaciones").select("*").order("codigo");
    if (error) toast.error("Error al cargar", { description: error.message });
    setItems((data ?? []) as Prestacion[]);
    setLoading(false);
  }

  function abrirNuevo() {
    setEditing(null);
    setForm({ ...empty });
    setOpen(true);
  }

  function abrirEditar(p: Prestacion) {
    setEditing(p);
    setForm({
      codigo: p.codigo,
      descripcion: p.descripcion,
      categoria: p.categoria ?? "",
      precio_base: Number(p.precio_base),
      duracion_estimada_min: p.duracion_estimada_min,
      activo: p.activo,
    });
    setOpen(true);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      codigo: form.codigo.trim(),
      descripcion: form.descripcion.trim(),
      categoria: form.categoria.trim() || null,
      precio_base: Number(form.precio_base) || 0,
      duracion_estimada_min: Number(form.duracion_estimada_min) || 30,
      activo: form.activo,
    };
    if (editing) {
      const { error } = await supabase.from("prestaciones").update(payload).eq("id", editing.id);
      if (error) return toast.error("No se pudo actualizar", { description: error.message });
      toast.success("Prestación actualizada");
    } else {
      const { error } = await supabase.from("prestaciones").insert(payload);
      if (error) return toast.error("No se pudo crear", { description: error.message });
      toast.success("Prestación creada");
    }
    setOpen(false);
    cargar();
  }

  const filtered = items.filter((i) =>
    `${i.codigo} ${i.descripcion} ${i.categoria ?? ""}`.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Prestaciones</h1>
          <p className="text-sm text-muted-foreground">Catálogo de servicios y precios base</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          {can("prestaciones", "create") && (
            <DialogTrigger asChild>
              <Button onClick={abrirNuevo}><Plus className="h-4 w-4" /> Nueva</Button>
            </DialogTrigger>
          )}
          <DialogContent>
            <form onSubmit={guardar}>
              <DialogHeader>
                <DialogTitle>{editing ? "Editar prestación" : "Nueva prestación"}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="codigo">Código</Label>
                  <Input id="codigo" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="categoria">Categoría</Label>
                  <Input id="categoria" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="descripcion">Descripción</Label>
                  <Input id="descripcion" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="precio">Precio base</Label>
                  <Input id="precio" type="number" min="0" step="0.01" value={form.precio_base}
                    onChange={(e) => setForm({ ...form, precio_base: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duracion">Duración (min)</Label>
                  <Input id="duracion" type="number" min="5" step="5" value={form.duracion_estimada_min}
                    onChange={(e) => setForm({ ...form, duracion_estimada_min: parseInt(e.target.value) || 30 })} />
                </div>
                <div className="flex items-center justify-between col-span-2">
                  <Label htmlFor="activo">Activa</Label>
                  <Switch id="activo" checked={form.activo} onCheckedChange={(v) => setForm({ ...form, activo: v })} />
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
        <CardHeader><CardTitle className="text-base">Listado</CardTitle></CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input placeholder="Buscar por código, descripción o categoría..." value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Precio base</TableHead>
                <TableHead className="text-right">Duración</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Sin resultados</TableCell></TableRow>
              ) : (
                filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-sm">{p.codigo}</TableCell>
                    <TableCell className="font-medium">{p.descripcion}</TableCell>
                    <TableCell>{p.categoria ?? "-"}</TableCell>
                    <TableCell className="text-right">${Number(p.precio_base).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">{p.duracion_estimada_min} min</TableCell>
                    <TableCell>
                      {p.activo ? <Badge>Activa</Badge> : <Badge variant="secondary">Inactiva</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      {can("prestaciones", "update") && (
                        <Button variant="ghost" size="sm" onClick={() => abrirEditar(p)}>
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
