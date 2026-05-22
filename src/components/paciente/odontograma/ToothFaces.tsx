import { type CaraDental, caraOclusalLabel, type ToothType, CARA_LABELS } from "@/lib/odontograma";
import { type DienteEstado, DIENTE_ESTADO_HEX, DIENTE_ESTADO_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface CaraInfo {
  cara: CaraDental;
  estado: DienteEstado | null;
}

interface Props {
  fdi: number;
  toothType: ToothType;
  caras: CaraInfo[];
  onCaraClick: (cara: CaraDental) => void;
  disabled?: boolean;
}

/**
 * Diagrama de 5 caras del diente en forma de cruz/cuadrado:
 *
 *       [Vestibular]
 *  [Mesial] [Oclusal] [Distal]
 *       [Palatino]
 */
export default function ToothFaces({ fdi, toothType, caras, onCaraClick, disabled }: Props) {
  const caraMap = new Map<CaraDental, DienteEstado | null>(
    caras.map((c) => [c.cara, c.estado])
  );

  const caraOcl = caraOclusalLabel(toothType);

  function getColor(cara: CaraDental): string {
    const estado = caraMap.get(cara);
    if (!estado) return "#f8fafc";
    return DIENTE_ESTADO_HEX[estado] ?? "#f8fafc";
  }

  function getLabel(cara: CaraDental): string {
    const estado = caraMap.get(cara);
    return `${CARA_LABELS[cara]}${estado ? `: ${DIENTE_ESTADO_LABELS[estado]}` : ""}`;
  }

  const cellClass = cn(
    "flex items-center justify-center rounded text-[9px] font-medium border transition-all cursor-pointer select-none",
    "hover:brightness-90 hover:ring-2 hover:ring-primary/50",
    disabled && "cursor-not-allowed opacity-50 pointer-events-none"
  );

  const cellStyle = (cara: CaraDental) => ({
    backgroundColor: getColor(cara),
    borderColor: "#94a3b8",
  });

  return (
    <div className="flex flex-col items-center gap-0.5 w-full">
      <p className="text-xs font-semibold text-muted-foreground mb-1">Pieza {fdi} — seleccioná una cara</p>

      {/* Vestibular */}
      <button
        type="button"
        title={getLabel("vestibular")}
        className={cn(cellClass, "w-14 h-6")}
        style={cellStyle("vestibular")}
        onClick={() => onCaraClick("vestibular")}
        disabled={disabled}
      >
        V
      </button>

      {/* Fila del medio: Mesial | Oclusal/Incisal | Distal */}
      <div className="flex gap-0.5">
        <button
          type="button"
          title={getLabel("mesial")}
          className={cn(cellClass, "w-6 h-14")}
          style={cellStyle("mesial")}
          onClick={() => onCaraClick("mesial")}
          disabled={disabled}
        >
          M
        </button>
        <button
          type="button"
          title={getLabel(caraOcl)}
          className={cn(cellClass, "w-14 h-14 text-[10px]")}
          style={cellStyle(caraOcl)}
          onClick={() => onCaraClick(caraOcl)}
          disabled={disabled}
        >
          {caraOcl === "oclusal" ? "Ocl" : "Inc"}
        </button>
        <button
          type="button"
          title={getLabel("distal")}
          className={cn(cellClass, "w-6 h-14")}
          style={cellStyle("distal")}
          onClick={() => onCaraClick("distal")}
          disabled={disabled}
        >
          D
        </button>
      </div>

      {/* Palatino/Lingual */}
      <button
        type="button"
        title={getLabel("palatino")}
        className={cn(cellClass, "w-14 h-6")}
        style={cellStyle("palatino")}
        onClick={() => onCaraClick("palatino")}
        disabled={disabled}
      >
        P/L
      </button>

      {/* Leyenda */}
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px] text-muted-foreground">
        <span>V = Vestibular</span>
        <span>P/L = Palatino/Lingual</span>
        <span>M = Mesial</span>
        <span>D = Distal</span>
        <span className="col-span-2">{caraOcl === "oclusal" ? "Ocl = Oclusal" : "Inc = Incisal"}</span>
      </div>
    </div>
  );
}
