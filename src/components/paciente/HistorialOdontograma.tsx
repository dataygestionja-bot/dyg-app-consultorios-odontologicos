import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DIENTE_ESTADO_LABELS, DIENTE_ESTADO_DOT, type DienteEstado } from "@/lib/constants";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

interface Registro {
  id: string;
  diente: number;
  estado: DienteEstado;
  fecha: string;
  observaciones: string | null;
  profesionales?: { nombre: string; apellido: string } | null;
}

export default function HistorialOdontograma({ pacienteId }: { pacienteId: string }) {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!pacienteId) return;
    setLoading(true);
    supabase
      .from("odontograma_registros")
      .select("id, diente, estado, fecha, observaciones, profesionales(nombre, apellido)")
      .eq("paciente_id", pacienteId)
      .order("fecha", { ascending: false })
      .then(({ data }) => {
        setRegistros((data ?? []) as Registro[]);
        setLoading(false);
      });
  }, [pacienteId]);

  if (loading) {
    return <p className="text-sm text-muted-foreground py-4 text-center">Cargando historial...</p>;
  }
  if (registros.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">Sin registros en el odontograma.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Pieza</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Profesional</TableHead>
            <TableHead>Observaciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {registros.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{format(new Date(r.fecha), "dd/MM/yyyy HH:mm")}</TableCell>
              <TableCell>{r.diente}</TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-2">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${DIENTE_ESTADO_DOT[r.estado]}`} />
                  {DIENTE_ESTADO_LABELS[r.estado]}
                </span>
              </TableCell>
              <TableCell>
                {r.profesionales ? `${r.profesionales.apellido}, ${r.profesionales.nombre}` : "—"}
              </TableCell>
              <TableCell className="whitespace-pre-wrap">{r.observaciones || "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
