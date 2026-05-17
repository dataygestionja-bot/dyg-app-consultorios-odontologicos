import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Pencil } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { IntegracionRctaInline } from "@/components/integraciones/IntegracionRctaInline";
import { RecetasExternasSection } from "@/components/integraciones/RecetasExternasSection";

type TipoAtencion = "con_turno" | "urgencia" | "espontanea";

const TIPO_LABEL: Record<TipoAtencion, string> = {
  con_turno: "Con turno",
  urgencia: "Urgencia",
  espontanea: "Espontánea",
};

const TIPO_VARIANT: Record<TipoAtencion, "default" | "destructive" | "secondary"> = {
  con_turno: "default",
  urgencia: "destructive",
  espontanea: "secondary",
};

interface Practica {
  id: string;
  cantidad: number;
  pieza_dental: string | null;
  cara_dental: string | null;
  observacion: string | null;
  orden: number;
  prestacion: { codigo: string; descripcion: string } | null;
}

interface Atencion {
  id: string;
  fecha: string;
  tipo_atencion: TipoAtencion;
  motivo: string | null;
  diagnostico: string | null;
  indicaciones: string | null;
  observaciones: string | null;
  tratamiento_realizado: string | null;
  proxima_visita_sugerida: string | null;
  paciente_id: string;
  profesional_id: string;
  paciente: { id: string; nombre: string; apellido: string; dni: string } | null;
  profesional: { nombre: string; apellido: string; especialidad: string | null } | null;
  turno: { fecha: string; hora_inicio: string; motivo_consulta: string } | null;
  atencion_practicas: Practica[];
}

export default function AtencionDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [atencion, setAtencion] = useState<Atencion | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      // 1) Atención base (sin joins, así RLS o filas huérfanas no rompen el resultado)
      const { data: atRow, error: atErr } = await supabase
        .from("atenciones")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (cancelled) return;
      if (atErr) console.error("Error cargando atención:", atErr);
      if (!atRow) {
        setAtencion(null);
        setLoading(false);
        return;
      }

      // 2) Relacionados en paralelo + prácticas con su prestación
      const [pacRes, profRes, turRes, practRes] = await Promise.all([
        supabase.from("pacientes").select("id, nombre, apellido, dni").eq("id", atRow.paciente_id).maybeSingle(),
        supabase.from("profesionales").select("nombre, apellido, especialidad").eq("id", atRow.profesional_id).maybeSingle(),
        atRow.turno_id
          ? supabase.from("turnos").select("fecha, hora_inicio, motivo_consulta").eq("id", atRow.turno_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase
          .from("atencion_practicas")
          .select("id, cantidad, pieza_dental, cara_dental, observacion, orden, prestacion:prestaciones(codigo, descripcion)")
          .eq("atencion_id", id)
          .order("orden"),
      ]);

      if (cancelled) return;

      const a: Atencion = {
        ...(atRow as any),
        paciente: (pacRes.data as any) ?? null,
        profesional: (profRes.data as any) ?? null,
        turno: (turRes.data as any) ?? null,
        atencion_practicas: (practRes.data as any) ?? [],
      };

      setAtencion(a);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return <div className="p-6 text-muted-foreground">Cargando atención...</div>;
  }

  if (!atencion) {
    return (
      <div className="p-6 space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" /> Volver
        </Button>
        <p className="text-muted-foreground">Atención no encontrada.</p>
      </div>
    );
  }

  const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-sm">{value ?? "—"}</div>
    </div>
  );

  const TextBlock = ({ label, value }: { label: string; value: string | null }) => (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm whitespace-pre-wrap">{value && value.trim() ? value : "—"}</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" /> Volver
        </Button>
        <h1 className="text-lg sm:text-xl font-semibold">Detalle de atención</h1>
        <Button asChild size="sm">
          <Link to={`/atenciones/${atencion.id}`}>
            <Pencil className="h-4 w-4" /> Editar
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos generales</CardTitle>
          <CardDescription>Información principal de la atención</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            label="Fecha"
            value={format(parseISO(atencion.fecha), "dd/MM/yyyy", { locale: es })}
          />
          <Field
            label="Tipo de atención"
            value={
              <Badge variant={TIPO_VARIANT[atencion.tipo_atencion]}>
                {TIPO_LABEL[atencion.tipo_atencion]}
              </Badge>
            }
          />
          <Field
            label="Paciente"
            value={
              atencion.paciente ? (
                <Link to={`/pacientes/${atencion.paciente.id}`} className="text-primary hover:underline">
                  {atencion.paciente.apellido}, {atencion.paciente.nombre}
                  <span className="text-muted-foreground"> · DNI {atencion.paciente.dni}</span>
                </Link>
              ) : "—"
            }
          />
          <Field
            label="Profesional"
            value={
              atencion.profesional
                ? `${atencion.profesional.apellido}, ${atencion.profesional.nombre}${atencion.profesional.especialidad ? ` · ${atencion.profesional.especialidad}` : ""}`
                : "—"
            }
          />
          <Field
            label="Turno asociado"
            value={
              atencion.turno
                ? `${format(parseISO(atencion.turno.fecha), "dd/MM/yyyy", { locale: es })} ${atencion.turno.hora_inicio?.slice(0, 5) ?? ""} · ${atencion.turno.motivo_consulta}`
                : "—"
            }
          />
          <Field
            label="Próxima visita sugerida"
            value={
              atencion.proxima_visita_sugerida
                ? format(parseISO(atencion.proxima_visita_sugerida), "dd/MM/yyyy", { locale: es })
                : "—"
            }
          />
          <div className="sm:col-span-2">
            <Field label="Motivo" value={atencion.motivo || "—"} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">Prácticas realizadas</CardTitle>
            <CardDescription>Prestaciones asociadas a esta atención</CardDescription>
          </div>
          <IntegracionRctaInline
            atencionId={atencion.id}
            pacienteNombre={
              atencion.paciente ? `${atencion.paciente.apellido}, ${atencion.paciente.nombre}` : undefined
            }
          />
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prestación</TableHead>
                  <TableHead>Pieza</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {atencion.atencion_practicas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Sin prácticas registradas
                    </TableCell>
                  </TableRow>
                ) : (
                  atencion.atencion_practicas.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-medium">{p.prestacion?.codigo ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{p.prestacion?.descripcion ?? ""}</div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{p.pieza_dental ?? "—"}</TableCell>
                      <TableCell className="hidden sm:table-cell">{p.cara_dental ?? "—"}</TableCell>
                      <TableCell className="text-right">{p.cantidad}</TableCell>
                      <TableCell className="hidden md:table-cell max-w-[260px]">
                        <div className="truncate" title={p.observacion ?? ""}>
                          {p.observacion ?? "—"}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextBlock label="Diagnóstico" value={atencion.diagnostico} />
        <TextBlock label="Tratamiento realizado" value={atencion.tratamiento_realizado} />
        <TextBlock label="Indicaciones" value={atencion.indicaciones} />
        <TextBlock label="Observaciones" value={atencion.observaciones} />
      </div>

      <RecetasExternasSection
        atencionId={atencion.id}
        pacienteId={atencion.paciente_id}
        profesionalId={atencion.profesional_id}
      />
    </div>
  );
}
