import { useMemo, useState } from "react";
import { format } from "date-fns";
import ToothSVG from "./odontograma/ToothSVG";
import {
  FDI_SUPERIOR,
  FDI_INFERIOR,
  FDI_SUPERIOR_TEMPORAL,
  FDI_INFERIOR_TEMPORAL,
  fdiToInterno,
  fdiTemporalToInterno,
  toothType,
  toothTypeTemporal,
  type CaraDental,
} from "@/lib/odontograma";
import { type DienteEstado } from "@/lib/constants";

interface Registro {
  diente: number;
  estado: DienteEstado;
  fecha: string;
  cara?: string | null;
  tipo_denticion?: string | null;
  profesionales?: { nombre: string; apellido: string } | null;
}

interface Props {
  registros: Registro[];
  onCaraEstado?: (dienteInterno: number, cara: CaraDental, estado: DienteEstado) => void;
  disabled?: boolean;
  piezaResaltada?: number | null;
  canCreate?: boolean;
  pendientesKeys?: Set<string>; // keys "diente-cara" pendientes
}

export default function OdontogramaAnatomico({
  registros,
  onCaraEstado,
  disabled,
  piezaResaltada,
  canCreate,
  pendientesKeys = new Set(),
}: Props) {
  const [denticion, setDenticion] = useState<"permanente" | "temporal">("permanente");

  const esTemporal = denticion === "temporal";
  const fdiSuperior = esTemporal ? FDI_SUPERIOR_TEMPORAL : FDI_SUPERIOR;
  const fdiInferior = esTemporal ? FDI_INFERIOR_TEMPORAL : FDI_INFERIOR;

  function getInterno(fdi: number): number {
    return esTemporal ? fdiTemporalToInterno(fdi) : fdiToInterno(fdi);
  }

  // Caras con último estado por diente interno
  const carasPorDiente = useMemo(() => {
    const map = new Map<number, Map<CaraDental, { estado: DienteEstado; pendiente: boolean }>>();
    // Primero registros reales (desc) — el primero es el más reciente
    for (const r of registros) {
      if (!r.cara) continue;
      const esPendiente = r.id?.startsWith("pending-") ?? false;
      if (!map.has(r.diente)) map.set(r.diente, new Map());
      const caraMap = map.get(r.diente)!;
      if (!caraMap.has(r.cara as CaraDental)) {
        caraMap.set(r.cara as CaraDental, { estado: r.estado, pendiente: esPendiente });
      }
    }
    return map;
  }, [registros]);

  function getCaras(interno: number) {
    const m = carasPorDiente.get(interno);
    if (!m) return [];
    return Array.from(m.entries()).map(([cara, { estado, pendiente }]) => ({ cara, estado, pendiente }));
  }

  function renderArcada(fdis: number[], arcada: "superior" | "inferior") {
    const mitad = Math.floor(fdis.length / 2);
    const der = fdis.slice(0, mitad);
    const izq = fdis.slice(mitad);
    return (
      <div className="flex items-center justify-center gap-0.5">
        <div className="flex items-center gap-0.5">
          {der.map((fdi) => renderTooth(fdi, arcada))}
        </div>
        <div className="mx-1 h-10 w-px bg-border" aria-hidden />
        <div className="flex items-center gap-0.5">
          {izq.map((fdi) => renderTooth(fdi, arcada))}
        </div>
      </div>
    );
  }

  function renderTooth(fdi: number, arcada: "superior" | "inferior") {
    const interno = getInterno(fdi);
    const caras = getCaras(interno);
    const getToothTypeFn = esTemporal ? toothTypeTemporal : toothType;

    return (
      <ToothSVG
        key={fdi}
        fdi={fdi}
        arcada={arcada}
        caras={caras}
        highlighted={piezaResaltada === interno}
        disabled={disabled}
        canCreate={canCreate}
        toothTypeFn={getToothTypeFn}
        onCaraEstado={(cara, estado) => onCaraEstado?.(interno, cara, estado)}
      />
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      {/* Toggle permanente / temporal */}
      <div className="flex justify-center mb-3">
        <div className="inline-flex rounded-md border overflow-hidden text-sm">
          <button
            type="button"
            onClick={() => setDenticion("permanente")}
            className={`px-4 py-1.5 font-medium transition-colors ${
              denticion === "permanente"
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            Permanente
          </button>
          <button
            type="button"
            onClick={() => setDenticion("temporal")}
            className={`px-4 py-1.5 font-medium transition-colors ${
              denticion === "temporal"
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            Temporal
          </button>
        </div>
      </div>

      <div className="mx-auto min-w-[400px] max-w-4xl space-y-2 px-2 py-2">
        <div className="flex items-center justify-between px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <span>Derecha</span>
          <span className="text-xs italic text-muted-foreground/80">Arcada superior</span>
          <span>Izquierda</span>
        </div>
        {renderArcada(fdiSuperior, "superior")}
        <div className="my-2 h-px bg-border" />
        {renderArcada(fdiInferior, "inferior")}
        <div className="flex items-center justify-between px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <span>Derecha</span>
          <span className="text-xs italic text-muted-foreground/80">Arcada inferior</span>
          <span>Izquierda</span>
        </div>
      </div>
    </div>
  );
}
