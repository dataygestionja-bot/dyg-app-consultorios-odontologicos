import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { addDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { Check, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { TURNO_ESTADO_LABELS, TURNO_ESTADO_CLASSES, type TurnoEstado } from "@/lib/constants";

interface Profesional {
  id: string;
  nombre: string;
  apellido: string;
  especialidad: string | null;
  foto_url: string | null;
  color_agenda: string;
}
interface Horario {
  id: string;
  profesional_id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  activo: boolean;
}
interface Bloqueo {
  id: string;
  profesional_id: string;
  fecha_desde: string;
  fecha_hasta: string;
  todo_el_dia: boolean;
  hora_desde: string | null;
  hora_hasta: string | null;
  motivo: string;
}
interface TurnoLite {
  id: string;
  profesional_id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: TurnoEstado;
  motivo_consulta: string | null;
  paciente?: { nombre: string; apellido: string } | null;
}

type CellKind = "festivo" | "ausencia" | "libre" | "sinturnos" | "pocos" | "medio" | "lleno";

interface CellInfo {
  kind: CellKind;
  label: string;
  rango?: string;
  count: number;
  motivo?: string;
}

const KIND_CLASSES: Record<CellKind, string> = {
  festivo: "bg-[hsl(var(--agenda-festivo))] text-[hsl(var(--agenda-festivo-fg))]",
  ausencia: "bg-[hsl(var(--agenda-ausencia))] text-[hsl(var(--agenda-ausencia-fg))]",
  libre: "bg-[hsl(var(--agenda-libre))] text-[hsl(var(--agenda-libre-fg))]",
  sinturnos: "bg-[hsl(var(--agenda-sinturnos))] text-[hsl(var(--agenda-sinturnos-fg))]",
  pocos: "bg-[hsl(var(--agenda-pocos))] text-[hsl(var(--agenda-pocos-fg))]",
  medio: "bg-[hsl(var(--agenda-medio))] text-[hsl(var(--agenda-medio-fg))]",
  lleno: "bg-[hsl(var(--agenda-lleno))] text-[hsl(var(--agenda-lleno-fg))]",
};

function clasificarCarga(count: number): "sinturnos" | "pocos" | "medio" | "lleno" {
  if (count === 0) return "sinturnos";
  if (count <= 3) return "pocos";
  if (count <= 6) return "medio";
  return "lleno";
}

function MOTIVO_LABEL(m: string): string {
  const map: Record<string, string> = {
    vacaciones: "Vacaciones",
    enfermedad: "Enfermedad",
    capacitacion: "Capacitación",
    licencia: "Licencia",
    feriado: "Feriado",
    personal: "Personal",
    otro: "No disponible",
  };
  return map[m] ?? m;
}

interface Props {
  semanaInicio: Date; // lunes
  filtroProfesional?: string; // "" = todos
  search?: string;
}

export function AgendaSemanalMatriz({ semanaInicio, filtroProfesional, search }: Props) {
  const [loading, setLoading] = useState(true);
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [bloqueos, setBloqueos] = useState<Bloqueo[]>([]);
  const [turnos, setTurnos] = useState<TurnoLite[]>([]);
  const [detalle, setDetalle] = useState<{ prof: Profesional; fecha: Date } | null>(null);

  const dias = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(semanaInicio, i)),
    [semanaInicio]
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      const desde = format(semanaInicio, "yyyy-MM-dd");
      const hasta = format(addDays(semanaInicio, 6), "yyyy-MM-dd");
      const [pr, ho, bl, tu] = await Promise.all([
        supabase
          .from("profesionales")
          .select("id, nombre, apellido, especialidad, foto_url, color_agenda")
          .eq("activo", true)
          .order("apellido"),
        supabase.from("horarios_profesional").select("*").eq("activo", true),
        supabase
          .from("bloqueos_agenda")
          .select("id, profesional_id, fecha_desde, fecha_hasta, todo_el_dia, hora_desde, hora_hasta, motivo")
          .eq("estado", "activo")
          .lte("fecha_desde", hasta)
          .gte("fecha_hasta", desde),
        supabase
          .from("turnos")
          .select("id, profesional_id, fecha, hora_inicio, hora_fin, estado, motivo_consulta, paciente:pacientes(nombre, apellido)")
          .gte("fecha", desde)
          .lte("fecha", hasta),
      ]);
      setProfesionales((pr.data ?? []) as Profesional[]);
      setHorarios((ho.data ?? []) as Horario[]);
      setBloqueos((bl.data ?? []) as Bloqueo[]);
      setTurnos((tu.data ?? []) as unknown as TurnoLite[]);
      setLoading(false);
    })();
  }, [semanaInicio]);

  const filas = useMemo(() => {
    let list = profesionales;
    if (filtroProfesional) list = list.filter((p) => p.id === filtroProfesional);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.nombre.toLowerCase().includes(s) ||
          p.apellido.toLowerCase().includes(s) ||
          (p.especialidad ?? "").toLowerCase().includes(s)
      );
    }
    return list;
  }, [profesionales, filtroProfesional, search]);

  function cellFor(prof: Profesional, dia: Date): CellInfo {
    const fechaStr = format(dia, "yyyy-MM-dd");
    const dow = dia.getDay(); // 0=dom .. 6=sab

    const turnosDia = turnos.filter(
      (t) =>
        t.profesional_id === prof.id &&
        t.fecha === fechaStr &&
        !["cancelado", "reprogramado", "ausente", "solicitado", "rechazado"].includes(t.estado)
    );
    const count = turnosDia.length;

    const blq = bloqueos.find(
      (b) =>
        b.profesional_id === prof.id &&
        fechaStr >= b.fecha_desde &&
        fechaStr <= b.fecha_hasta
    );
    if (blq && blq.todo_el_dia) {
      if (blq.motivo === "feriado") {
        return { kind: "festivo", label: "Festivo", count, motivo: MOTIVO_LABEL(blq.motivo) };
      }
      return { kind: "ausencia", label: "Ausencia", count, motivo: MOTIVO_LABEL(blq.motivo) };
    }

    const horariosDia = horarios.filter((h) => h.profesional_id === prof.id && h.dia_semana === dow);
    if (horariosDia.length === 0) {
      return { kind: "libre", label: "Día libre", count };
    }

    horariosDia.sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
    const hi = horariosDia[0].hora_inicio.slice(0, 5);
    const hf = horariosDia[horariosDia.length - 1].hora_fin.slice(0, 5);
    const kind = clasificarCarga(count);
    const label =
      kind === "libre"
        ? "Sin turnos"
        : kind === "pocos"
        ? `${count} turno${count === 1 ? "" : "s"}`
        : kind === "medio"
        ? `${count} turnos`
        : `${count} turnos`;
    return { kind, label, rango: `${hi} - ${hf}`, count };
  }

  function totalHoras(prof: Profesional): number {
    const hs = horarios.filter((h) => h.profesional_id === prof.id);
    let mins = 0;
    for (const h of hs) {
      const [h1, m1] = h.hora_inicio.split(":").map(Number);
      const [h2, m2] = h.hora_fin.split(":").map(Number);
      mins += h2 * 60 + m2 - (h1 * 60 + m1);
    }
    return Math.round(mins / 60);
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (filas.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay profesionales para mostrar.</p>;
  }

  const turnosDetalle = detalle
    ? turnos
        .filter(
          (t) => t.profesional_id === detalle.prof.id && t.fecha === format(detalle.fecha, "yyyy-MM-dd")
        )
        .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))
    : [];

  return (
    <>
      <div className="overflow-auto rounded-lg border bg-card">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-30 w-[260px] min-w-[260px] border-b border-r bg-muted/60 p-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Profesional
              </th>
              {dias.map((d) => (
                <th
                  key={d.toISOString()}
                  className="sticky top-0 z-20 min-w-[140px] border-b bg-muted/60 p-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  <div className="flex items-baseline justify-center gap-1">
                    <span>{format(d, "EEE", { locale: es })}</span>
                    <span className="text-foreground">{format(d, "d", { locale: es })}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((p) => (
              <tr key={p.id}>
                <td className="sticky left-0 z-10 w-[260px] min-w-[260px] border-b border-r bg-card p-3 align-top">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10">
                      {p.foto_url && <AvatarImage src={p.foto_url} alt={`${p.apellido} ${p.nombre}`} />}
                      <AvatarFallback
                        className="text-xs font-medium"
                        style={{ backgroundColor: `${p.color_agenda}33`, color: p.color_agenda }}
                      >
                        {(p.apellido[0] ?? "") + (p.nombre[0] ?? "")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="truncate font-medium leading-tight">
                        {p.apellido}, {p.nombre}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {p.especialidad ?? "—"}
                      </div>
                      <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {totalHoras(p)} h / sem
                      </div>
                    </div>
                  </div>
                </td>
                {dias.map((d) => {
                  const info = cellFor(p, d);
                  return (
                    <td key={d.toISOString()} className="border-b p-1.5 align-top">
                      <button
                        type="button"
                        onClick={() => setDetalle({ prof: p, fecha: d })}
                        className={cn(
                          "group relative flex h-[64px] w-full flex-col items-start justify-between rounded-md px-2 py-1.5 text-left transition-all hover:ring-2 hover:ring-ring/40",
                          KIND_CLASSES[info.kind]
                        )}
                      >
                        <div className="text-xs font-semibold leading-tight">
                          {info.label}
                          {info.motivo && info.kind === "ausencia" && (
                            <span className="ml-1 font-normal opacity-80">· {info.motivo}</span>
                          )}
                        </div>
                        {info.rango && (
                          <div className="text-[11px] font-medium opacity-90">{info.rango}</div>
                        )}
                        {info.count > 0 && (
                          <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-background/70 px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
                            <Check className="h-2.5 w-2.5" />
                            {info.count}
                          </span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Leyenda */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="font-medium">Referencias:</span>
        {(
          [
            ["libre", "Día libre / sin turnos"],
            ["pocos", "1 a 3 turnos"],
            ["medio", "4 a 6 turnos"],
            ["lleno", "7 o más turnos"],
            ["ausencia", "Ausencia"],
            ["festivo", "Feriado"],
          ] as [CellKind, string][]
        ).map(([k, l]) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={cn("inline-block h-3 w-3 rounded", KIND_CLASSES[k])} />
            {l}
          </span>
        ))}
      </div>

      <Sheet open={!!detalle} onOpenChange={(v) => !v && setDetalle(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {detalle && (
            <>
              <SheetHeader>
                <SheetTitle>
                  {detalle.prof.apellido}, {detalle.prof.nombre}
                </SheetTitle>
                <SheetDescription>
                  {format(detalle.fecha, "EEEE d 'de' MMMM yyyy", { locale: es })}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-2">
                {turnosDetalle.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin turnos registrados este día.</p>
                ) : (
                  turnosDetalle.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-start justify-between gap-3 rounded-md border bg-card p-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium">
                          {t.hora_inicio.slice(0, 5)} - {t.hora_fin.slice(0, 5)}
                        </div>
                        <div className="truncate text-sm text-muted-foreground">
                          {t.paciente
                            ? `${t.paciente.apellido}, ${t.paciente.nombre}`
                            : "Sin paciente"}
                        </div>
                        {t.motivo_consulta && (
                          <div className="mt-1 truncate text-xs text-muted-foreground">
                            {t.motivo_consulta}
                          </div>
                        )}
                      </div>
                      <Badge className={TURNO_ESTADO_CLASSES[t.estado] ?? ""}>
                        {TURNO_ESTADO_LABELS[t.estado] ?? t.estado}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
