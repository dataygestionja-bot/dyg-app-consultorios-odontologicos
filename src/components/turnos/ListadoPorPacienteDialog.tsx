import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { addDays, format, startOfWeek } from "date-fns";
import { TURNO_ESTADO_LABELS, TURNO_ESTADO_CLASSES, type TurnoEstado } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fechaInicial: Date;
}

interface Row {
  id: string;
  fecha: string;
  hora_inicio: string;
  estado: TurnoEstado;
  paciente: { nombre: string; apellido: string } | null;
  profesional: { nombre: string; apellido: string } | null;
}

export default function ListadoPorPacienteDialog({ open, onOpenChange, fechaInicial }: Props) {
  const inicio = startOfWeek(fechaInicial, { weekStartsOn: 1 });
  const [desde, setDesde] = useState(format(inicio, "yyyy-MM-dd"));
  const [hasta, setHasta] = useState(format(addDays(inicio, 6), "yyyy-MM-dd"));
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("turnos")
        .select("id, fecha, hora_inicio, estado, paciente:pacientes(nombre, apellido), profesional:profesionales(nombre, apellido)")
        .gte("fecha", desde)
        .lte("fecha", hasta)
        .eq("estado", "confirmado")
        .order("fecha", { ascending: true });
      if (cancel) return;
      if (!error && data) setRows(data as any);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [open, desde, hasta]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const arr = rows.filter((r) => {
      if (!q) return true;
      const n = `${r.paciente?.apellido ?? ""} ${r.paciente?.nombre ?? ""}`.toLowerCase();
      return n.includes(q);
    });
    arr.sort((a, b) => {
      const an = `${a.paciente?.apellido ?? ""} ${a.paciente?.nombre ?? ""}`.toLowerCase();
      const bn = `${b.paciente?.apellido ?? ""} ${b.paciente?.nombre ?? ""}`.toLowerCase();
      if (an !== bn) return an.localeCompare(bn);
      if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
      return a.hora_inicio.localeCompare(b.hora_inicio);
    });
    return arr;
  }, [rows, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Turnos por paciente</DialogTitle>
          <DialogDescription>Listado simple de turnos en el rango seleccionado.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Desde</Label>
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Hasta</Label>
            <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Buscar paciente</Label>
            <Input placeholder="Apellido o nombre..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="max-h-[55vh] overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paciente</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Hora</TableHead>
                <TableHead>Profesional</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}><Skeleton className="h-5 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    Sin turnos en el rango.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => {
                  const [y, m, d] = r.fecha.split("-");
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {r.paciente ? `${r.paciente.apellido}, ${r.paciente.nombre}` : "—"}
                      </TableCell>
                      <TableCell>{`${d}/${m}/${y}`}</TableCell>
                      <TableCell>{r.hora_inicio?.slice(0, 5)}</TableCell>
                      <TableCell>
                        {r.profesional ? `${r.profesional.apellido}, ${r.profesional.nombre}` : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(TURNO_ESTADO_CLASSES[r.estado])}>
                          {TURNO_ESTADO_LABELS[r.estado]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">{filtered.length} turno(s)</div>
          <Button size="sm" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
