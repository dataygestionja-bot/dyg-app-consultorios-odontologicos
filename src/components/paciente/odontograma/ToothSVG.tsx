import { useState, useRef, useEffect } from "react";
import { type DienteEstado, DIENTE_ESTADO_HEX, DIENTE_ESTADO_LABELS, DIENTE_ESTADOS_SELECCIONABLES, DIENTE_ESTADO_DOT } from "@/lib/constants";
import { type ToothType, type CaraDental, CARA_LABELS, caraOclusalLabel } from "@/lib/odontograma";
import { cn } from "@/lib/utils";
import type { UltimaPractica } from "../Odontograma";

interface CaraRegistro {
  cara: CaraDental;
  estado: DienteEstado;
  pendiente?: boolean;
}

interface Props {
  fdi: number;
  arcada: "superior" | "inferior";
  caras: CaraRegistro[];
  toothTypeFn?: (fdi: number) => ToothType;
  onCaraEstado?: (cara: CaraDental, estado: DienteEstado) => void;
  disabled?: boolean;
  highlighted?: boolean;
  canCreate?: boolean;
  ultimaPractica?: UltimaPractica;
}

const STROKE = "#475569";
const STROKE_W = 1.5;
const SIZE = 44;

function getCaraFill(cara: CaraDental, caras: CaraRegistro[]): string {
  const r = caras.find((c) => c.cara === cara);
  if (!r) return "#ffffff";
  const hex = DIENTE_ESTADO_HEX[r.estado] ?? "#ffffff";
  // Pendientes con opacidad reducida
  return r.pendiente ? hex + "99" : hex;
}

function getCaraStroke(cara: CaraDental, caras: CaraRegistro[]): string {
  const r = caras.find((c) => c.cara === cara);
  if (r?.pendiente) return "#f59e0b"; // amber para pendientes
  return STROKE;
}

function OclusalMolar({ caras, caraOcl, onZoneClick, disabled }: {
  caras: CaraRegistro[];
  caraOcl: CaraDental;
  onZoneClick: (cara: CaraDental, e: React.MouseEvent) => void;
  disabled?: boolean;
}) {
  const s = SIZE;
  const pad = 3;
  const inner = 12;
  const x0 = pad, y0 = pad, x1 = s - pad, y1 = s - pad;
  const ix0 = s / 2 - inner / 2, iy0 = s / 2 - inner / 2;
  const ix1 = s / 2 + inner / 2, iy1 = s / 2 + inner / 2;

  const zoneProps = (cara: CaraDental) => ({
    fill: getCaraFill(cara, caras),
    stroke: getCaraStroke(cara, caras),
    strokeWidth: STROKE_W,
    className: cn("transition-all", !disabled ? "cursor-pointer hover:brightness-75" : "cursor-default"),
    onClick: disabled ? undefined : (e: React.MouseEvent) => onZoneClick(cara, e),
  });

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full h-full">
      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill="none" stroke={STROKE} strokeWidth={STROKE_W} rx={2} />
      <polygon points={`${x0},${y0} ${x1},${y0} ${ix1},${iy0} ${ix0},${iy0}`} {...zoneProps("vestibular")} />
      <polygon points={`${x0},${y1} ${x1},${y1} ${ix1},${iy1} ${ix0},${iy1}`} {...zoneProps("palatino")} />
      <polygon points={`${x0},${y0} ${x0},${y1} ${ix0},${iy1} ${ix0},${iy0}`} {...zoneProps("mesial")} />
      <polygon points={`${x1},${y0} ${x1},${y1} ${ix1},${iy1} ${ix1},${iy0}`} {...zoneProps("distal")} />
      <rect x={ix0} y={iy0} width={inner} height={inner} {...zoneProps(caraOcl)} />
      <line x1={x0} y1={y0} x2={ix0} y2={iy0} stroke={STROKE} strokeWidth={STROKE_W * 0.7} />
      <line x1={x1} y1={y0} x2={ix1} y2={iy0} stroke={STROKE} strokeWidth={STROKE_W * 0.7} />
      <line x1={x0} y1={y1} x2={ix0} y2={iy1} stroke={STROKE} strokeWidth={STROKE_W * 0.7} />
      <line x1={x1} y1={y1} x2={ix1} y2={iy1} stroke={STROKE} strokeWidth={STROKE_W * 0.7} />
    </svg>
  );
}

function OclusalIncisor({ caras, caraOcl, onZoneClick, disabled }: {
  caras: CaraRegistro[];
  caraOcl: CaraDental;
  onZoneClick: (cara: CaraDental, e: React.MouseEvent) => void;
  disabled?: boolean;
}) {
  const s = SIZE;
  const cx = s / 2, cy = s / 2;
  const R = s / 2 - 3;
  const r = R * 0.32;

  const zoneProps = (cara: CaraDental) => ({
    fill: getCaraFill(cara, caras),
    stroke: getCaraStroke(cara, caras),
    strokeWidth: STROKE_W,
    className: cn("transition-all", !disabled ? "cursor-pointer hover:brightness-75" : "cursor-default"),
    onClick: disabled ? undefined : (e: React.MouseEvent) => onZoneClick(cara, e),
  });

  function annularSector(a1: number, a2: number) {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const cos1 = Math.cos(toRad(a1)), sin1 = Math.sin(toRad(a1));
    const cos2 = Math.cos(toRad(a2)), sin2 = Math.sin(toRad(a2));
    const large = a2 - a1 > 180 ? 1 : 0;
    return [
      `M ${cx + R * cos1} ${cy + R * sin1}`,
      `A ${R} ${R} 0 ${large} 1 ${cx + R * cos2} ${cy + R * sin2}`,
      `L ${cx + r * cos2} ${cy + r * sin2}`,
      `A ${r} ${r} 0 ${large} 0 ${cx + r * cos1} ${cy + r * sin1}`,
      "Z",
    ].join(" ");
  }

  const d45 = Math.cos(Math.PI / 4);

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full h-full">
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={STROKE} strokeWidth={STROKE_W} />
      <path d={annularSector(-135, -45)} {...zoneProps("vestibular")} />
      <path d={annularSector(-45, 45)} {...zoneProps("distal")} />
      <path d={annularSector(45, 135)} {...zoneProps("palatino")} />
      <path d={annularSector(135, 225)} {...zoneProps("mesial")} />
      <circle cx={cx} cy={cy} r={r} {...zoneProps(caraOcl)} />
      <line x1={cx - R * d45} y1={cy - R * d45} x2={cx - r * d45} y2={cy - r * d45} stroke={STROKE} strokeWidth={STROKE_W * 0.7} />
      <line x1={cx + R * d45} y1={cy - R * d45} x2={cx + r * d45} y2={cy - r * d45} stroke={STROKE} strokeWidth={STROKE_W * 0.7} />
      <line x1={cx - R * d45} y1={cy + R * d45} x2={cx - r * d45} y2={cy + r * d45} stroke={STROKE} strokeWidth={STROKE_W * 0.7} />
      <line x1={cx + R * d45} y1={cy + R * d45} x2={cx + r * d45} y2={cy + r * d45} stroke={STROKE} strokeWidth={STROKE_W * 0.7} />
    </svg>
  );
}

function EstadoPopover({ cara, fdi, position, onSelect, onClose, submitting }: {
  cara: CaraDental;
  fdi: number;
  position: { x: number; y: number };
  onSelect: (estado: DienteEstado) => void;
  onClose: () => void;
  submitting: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const popW = 280, popH = 220;
  const vw = window.innerWidth, vh = window.innerHeight;
  let left = position.x + 10;
  let top = position.y - 40;
  if (left + popW > vw - 8) left = position.x - popW - 10;
  if (top + popH > vh - 8) top = vh - popH - 8;
  if (top < 8) top = 8;

  return (
    <div
      ref={ref}
      className="fixed z-50 rounded-lg border bg-popover text-popover-foreground shadow-lg p-2"
      style={{ left, top, width: popW }}
    >
      <div className="text-[11px] font-semibold text-muted-foreground mb-1.5 px-1 border-b pb-1">
        Pieza {fdi} · {CARA_LABELS[cara]}
      </div>
      <div className="grid grid-cols-2 gap-0.5">
        {DIENTE_ESTADOS_SELECCIONABLES.map((e) => (
          <button
            key={e}
            type="button"
            disabled={submitting}
            className="flex items-center gap-2 rounded px-2 py-1 text-xs text-left hover:bg-accent transition-colors disabled:opacity-50 w-full"
            onClick={() => onSelect(e)}
          >
            <span className={cn("h-2.5 w-2.5 shrink-0 rounded-sm", DIENTE_ESTADO_DOT[e])} />
            {DIENTE_ESTADO_LABELS[e]}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ToothSVG({
  fdi,
  arcada,
  caras,
  toothTypeFn,
  onCaraEstado,
  disabled,
  highlighted,
  canCreate,
  ultimaPractica,
}: Props) {
  const [popover, setPopover] = useState<{ cara: CaraDental; x: number; y: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const getType = toothTypeFn ?? ((f: number): ToothType => {
    const p = f % 10;
    if (p >= 6) return "molar";
    if (p >= 4) return "premolar";
    if (p === 3) return "canino";
    return "incisivo";
  });

  const type = getType(fdi);
  const caraOcl = caraOclusalLabel(type);
  const isMolarType = type === "molar" || type === "premolar";

  function handleZoneClick(cara: CaraDental, e: React.MouseEvent) {
    e.stopPropagation();
    if (!canCreate || disabled) return;
    setPopover({ cara, x: e.clientX, y: e.clientY });
  }

  async function handleEstadoSelect(estado: DienteEstado) {
    if (!popover) return;
    setSubmitting(true);
    await onCaraEstado?.(popover.cara, estado);
    setSubmitting(false);
    setPopover(null);
  }

  return (
    <>
      <div
        className={cn(
          "flex flex-col items-center gap-0.5",
          highlighted && "ring-2 ring-primary rounded-md",
        )}
        onMouseEnter={(e) => ultimaPractica && setTooltipPos({ x: e.clientX, y: e.clientY })}
        onMouseMove={(e) => ultimaPractica && setTooltipPos({ x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setTooltipPos(null)}
      >
        {arcada === "superior" && (
          <span className="text-[9px] font-medium text-muted-foreground leading-none">{fdi}</span>
        )}
        <div className={cn("w-9 h-9", disabled && "opacity-50")}>
          {isMolarType ? (
            <OclusalMolar caras={caras} caraOcl={caraOcl} onZoneClick={handleZoneClick} disabled={disabled || !canCreate} />
          ) : (
            <OclusalIncisor caras={caras} caraOcl={caraOcl} onZoneClick={handleZoneClick} disabled={disabled || !canCreate} />
          )}
        </div>
        {arcada === "inferior" && (
          <span className="text-[9px] font-medium text-muted-foreground leading-none">{fdi}</span>
        )}
      </div>

      {tooltipPos && ultimaPractica && (
        <div
          className="fixed z-50 rounded-md border bg-popover text-popover-foreground shadow-md p-2.5 text-xs pointer-events-none max-w-[220px]"
          style={{ left: tooltipPos.x + 14, top: tooltipPos.y - 10 }}
        >
          <div className="font-semibold leading-tight">{ultimaPractica.codigo} · {ultimaPractica.descripcion}</div>
          <div className="text-muted-foreground mt-1">{ultimaPractica.fecha}</div>
          <div className="text-muted-foreground">{ultimaPractica.profesional}</div>
        </div>
      )}

      {popover && (
        <EstadoPopover
          cara={popover.cara}
          fdi={fdi}
          position={{ x: popover.x, y: popover.y }}
          onSelect={handleEstadoSelect}
          onClose={() => setPopover(null)}
          submitting={submitting}
        />
      )}
    </>
  );
}
