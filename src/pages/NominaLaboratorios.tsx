import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";

interface Laboratorio {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  contacto: string | null;
  direccion: string | null;
  activo: boolean;
}

const emptyLab = {
  nombre: "",
  telefono: "",
  email: "",
  contacto: "",
  direccion: "",
  activo: true,
};

export default function NominaLaboratorios() {
  const [labs, setLabs] = useState<Laboratorio[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<Laboratorio | null>(null);
  const [form, setForm] = useState(emptyLab);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    document.title = "Nómina de laboratorios | Consultorio";
    cargar();
  }, []);

  async function cargar() {
    setLoading(true);
    const { data } = await supabase.from("laboratorios").select("*").order("nombre");
    setLabs((data ?? []) as Laboratorio[]);
    setLoading(false);
  }

  function abrirNuevo() {
    setEditando(null);
    setForm(emptyLab);
    setDialogOpen(true);
  }

  function abrirEditar(lab: Laboratorio) {
    setEditando(lab);
    setForm({
      nombre: lab.nombre,
      telefono: lab.telefono ?? "",
      email: lab.email ?? "",
      contacto: lab.contacto ?? "",
      direccion: lab.direccion ?? "",
      activo: lab.activo,
    });
    setDialogOpen(true);
  }

  async function guardar() {
    if (!form.nombre.trim()) return toast.error("El nombre es obligatorio");
    setGuardando(true);

    const payload = {
      nombre: form.nombre.trim(),
      telefono: form.telefono.trim() || null,
      email: form.email.trim() || null,
      contacto: form.contacto.trim() || null,
      direccion: form.direccion.trim() || null,
      activo: form.activo,
    };

    const res = editando
      ? await supabase.from("laboratorios").update(payload).eq("id", editando.id)
      : await supabase.from("laboratorios").insert(payload);

    setGuardando(false);
    if (res.error) return toast.error("No se pudo guardar", { description: res.error.message });
    toast.success(editando ? "Laboratorio actualizado" : "Laboratorio creado");
    setDialogOpen(false);
    cargar();
  }

  function set(key: keyof typeof emptyLab, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nómina de laboratorios</h1>
          <p className="text-sm text-muted-foreground">Laboratorios registrados en el sistema</p>
        </div>
        <Button size="sm" onClick={abrirNuevo}>
          <Plus className="h-4 w-4" /> Nuevo laboratorio
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Listado</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : labs.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Sin laboratorios</TableCell></TableRow>
              ) : labs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.nombre}</TableCell>
                  <TableCell>{l.contacto ?? "—"}</TableCell>
                  <TableCell>{l.telefono ?? "—"}</TableCell>
                  <TableCell>{l.email ?? "—"}</TableCell>
                  <TableCell>{l.direccion ?? "—"}</TableCell>
                  <TableCell>
                    {l.activo ? <Badge>Activo</Badge> : <Badge variant="secondary">Inactivo</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => abrirEditar(l)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar laboratorio" : "Nuevo laboratorio"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label className="text-xs">Nombre *</Label>
              <Input className="h-8 text-xs" value={form.nombre} onChange={(e) => set("nombre", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Contacto</Label>
                <Input className="h-8 text-xs" value={form.contacto} onChange={(e) => set("contacto", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Teléfono</Label>
                <Input className="h-8 text-xs" value={form.telefono} onChange={(e) => set("telefono", e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input className="h-8 text-xs" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Dirección</Label>
              <Input className="h-8 text-xs" value={form.direccion} onChange={(e) => set("direccion", e.target.value)} />
            </div>
            <div className="flex items-center justify-between pt-1">
              <Label className="text-xs">Activo</Label>
              <Switch checked={form.activo} onCheckedChange={(v) => set("activo", v)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)} disabled={guardando}>Cancelar</Button>
            <Button size="sm" onClick={guardar} disabled={guardando}>{guardando ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
