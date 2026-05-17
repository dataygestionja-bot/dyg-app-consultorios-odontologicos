import { type DienteEstado, DIENTE_ESTADO_HEX } from "@/lib/constants";
import { toothType, type ToothType } from "@/lib/odontograma";
import { cn } from "@/lib/utils";

interface Props {
  fdi: number;
  estado?: DienteEstado | null;
  arcada: "superior" | "inferior";
  onClick?: () => void;
  highlighted?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  title?: string;
}

// Renderiza una silueta simple/anatómica por tipo de pieza.
// Dimensiones: 40 x 56 viewBox.
function ToothShape({
  type,
  fill,
  stroke,
  arcada,
}: {
  type: ToothType;
  fill: string;
  stroke: string;
  arcada: "superior" | "inferior";
}) {
  // Para arcada inferior invertimos verticalmente, así la corona
  // queda hacia el centro del odontograma.
  const transform = arcada === "inferior" ? "scale(1,-1) translate(0,-56)" : undefined;

  let path = "";
  switch (type) {
    case "molar":
      // Corona cuadrada con 4 cúspides + raíces gemelas
      path =
        "M6 4 Q4 12 6 22 Q3 24 4 30 Q5 38 8 46 Q10 52 14 52 Q15 44 14 36 Q18 36 20 36 Q22 36 26 36 Q25 44 26 52 Q30 52 32 46 Q35 38 36 30 Q37 24 34 22 Q36 12 34 4 Q28 1 20 1 Q12 1 6 4 Z";
      break;
    case "premolar":
      // Corona con 2 cúspides + 1 raíz
      path =
        "M8 4 Q6 14 9 22 Q6 26 7 34 Q9 44 14 52 Q17 54 20 54 Q23 54 26 52 Q31 44 33 34 Q34 26 31 22 Q34 14 32 4 Q26 1 20 1 Q14 1 8 4 Z";
      break;
    case "canino":
      // Corona puntiaguda + raíz larga
      path =
        "M10 6 Q8 14 11 22 Q8 28 9 38 Q11 48 16 54 Q18 55 20 55 Q22 55 24 54 Q29 48 31 38 Q32 28 29 22 Q32 14 30 6 Q26 1 20 1 Q14 1 10 6 Z";
      break;
    case "incisivo":
    default:
      // Corona plana con borde + 1 raíz cónica
      path =
        "M10 4 Q8 12 10 20 Q8 26 10 34 Q12 46 16 52 Q18 54 20 54 Q22 54 24 52 Q28 46 30 34 Q32 26 30 20 Q32 12 30 4 Q26 1 20 1 Q14 1 10 4 Z";
      break;
  }

  return (
    <g transform={transform}>
      <path d={path} fill={fill} stroke={stroke} strokeWidth="1.2" strokeLinejoin="round" />
      {/* Línea sutil corona/raíz */}
      <path
        d="M6 22 Q20 24 34 22"
        fill="none"
        stroke={stroke}
        strokeOpacity="0.35"
        strokeWidth="0.8"
      />
    </g>
  );
}

export default function ToothSVG({
  fdi,
  estado,
  arcada,
  onClick,
  highlighted,
  disabled,
  ariaLabel,
  title,
}: Props) {
  const type = toothType(fdi);
  const fill = estado ? DIENTE_ESTADO_HEX[estado] : "#ffffff";
  const stroke = "hsl(215 20% 45%)";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel ?? `Pieza ${fdi}`}
      className={cn(
        "group flex flex-col items-center gap-0.5 rounded-md p-0.5 transition",
        "hover:bg-accent/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        highlighted && "ring-2 ring-primary bg-accent/60",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      {arcada === "superior" && (
        <span className="text-[10px] font-medium text-muted-foreground leading-none">{fdi}</span>
      )}
      <svg
        viewBox="0 0 40 56"
        className="h-10 w-7 drop-shadow-sm transition-transform group-hover:scale-110"
      >
        <ToothShape type={type} fill={fill} stroke={stroke} arcada={arcada} />
      </svg>
      {arcada === "inferior" && (
        <span className="text-[10px] font-medium text-muted-foreground leading-none">{fdi}</span>
      )}
    </button>
  );
}
