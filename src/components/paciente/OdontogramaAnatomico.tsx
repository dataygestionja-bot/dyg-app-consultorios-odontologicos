import { useMemo } from "react";
import { format } from "date-fns";
import ToothSVG from "./odontograma/ToothSVG";
import {
  FDI_SUPERIOR,
  FDI_INFERIOR,
  fdiToInterno,
} from "@/lib/odontograma";
import { DIENTE_ESTADO_LABELS, type DienteEstado } from "@/lib/constants";

interface Registro {
  diente: number;
  estado: DienteEstado;
  fecha: string;
  profesionales?: { nombre: string; apellido: string } | null;
}

export default function OdontogramaAnatomico({
  registros,
  onPiezaClick,
  disabled,
  piezaResaltada,
}: {
  registros: Registro[];
  onPiezaClick?: (dienteInterno: number) => void;
  disabled?: boolean;
  piezaResaltada?: number | null;
}) {
  // Último estado por número interno
  const ultimoPorInterno = useMemo(() => {
    const map = new Map<number, Registro>();
    for (const r of registros) {
      if (!map.has(r.diente)) map.set(r.diente, r); // registros vienen desc por fecha
    }
    return map;
  }, [registros]);

  function renderArcada(fdis: number[], arcada: "superior" | "inferior") {
    // Mitad derecha (primeros 8) + separador central + mitad izquierda (últimos 8)
    const der = fdis.slice(0, 8);
    const izq = fdis.slice(8);
    return (
      <div className="flex items-end justify-center gap-1">
        <div className="flex items-end gap-0.5">
          {der.map((fdi) => renderTooth(fdi, arcada))}
        </div>
        <div className="mx-1 h-12 w-px bg-border" aria-hidden />
        <div className="flex items-end gap-0.5">
          {izq.map((fdi) => renderTooth(fdi, arcada))}
        </div>
      </div>
    );
  }

  function renderTooth(fdi: number, arcada: "superior" | "inferior") {
    const interno = fdiToInterno(fdi);
    const ult = ultimoPorInterno.get(interno);
    const estadoLabel = ult ? DIENTE_ESTADO_LABELS[ult.estado] : "Sin registros";
    const fechaLabel = ult ? format(new Date(ult.fecha), "dd/MM/yyyy") : "";
    const profLabel = ult?.profesionales
      ? ` · ${ult.profesionales.apellido}, ${ult.profesionales.nombre}`
      : "";
    const title = `Pieza ${fdi} — ${estadoLabel}${fechaLabel ? ` · ${fechaLabel}` : ""}${profLabel}`;

    return (
      <ToothSVG
        key={fdi}
        fdi={fdi}
        estado={ult?.estado ?? null}
        arcada={arcada}
        highlighted={piezaResaltada === interno}
        disabled={disabled}
        onClick={() => onPiezaClick?.(interno)}
        title={title}
        ariaLabel={title}
      />
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className="mx-auto min-w-[640px] max-w-3xl space-y-3 px-2 py-4">
        {/* Etiquetas Derecha / Izquierda (del paciente) */}
        <div className="flex items-center justify-between px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <span>Derecha</span>
          <span className="text-xs italic text-muted-foreground/80">
            Arcada superior
          </span>
          <span>Izquierda</span>
        </div>

        {renderArcada(FDI_SUPERIOR, "superior")}

        <div className="my-2 h-px bg-border" />

        {renderArcada(FDI_INFERIOR, "inferior")}

        <div className="flex items-center justify-between px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <span>Derecha</span>
          <span className="text-xs italic text-muted-foreground/80">
            Arcada inferior
          </span>
          <span>Izquierda</span>
        </div>
      </div>
    </div>
  );
}
