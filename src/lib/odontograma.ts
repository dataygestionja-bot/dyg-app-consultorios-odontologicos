// Mapeo entre numeración interna (1–32) usada en la base
// y numeración FDI (estándar odontológico) usada en la UI.
//
// Interno → FDI por cuadrantes:
//   1–8   → 18..11 (sup. derecho, distal → mesial)
//   9–16  → 21..28 (sup. izquierdo, mesial → distal)
//   17–24 → 31..38 (inf. izquierdo, mesial → distal)
//   25–32 → 41..48 (inf. derecho, mesial → distal)

export function internoToFdi(n: number): number {
  if (n >= 1 && n <= 8) return 18 - (n - 1);
  if (n >= 9 && n <= 16) return 20 + (n - 8);
  if (n >= 17 && n <= 24) return 30 + (n - 16);
  if (n >= 25 && n <= 32) return 48 - (n - 25);
  return n;
}

export function fdiToInterno(fdi: number): number {
  const q = Math.floor(fdi / 10);
  const p = fdi % 10;
  if (q === 1) return 9 - p;
  if (q === 2) return 8 + p;
  if (q === 3) return 16 + p;
  if (q === 4) return 49 - p;
  return fdi;
}

// ── Dentición temporal ──────────────────────────────────────────────────────
// FDI: 55-51 | 61-65 (superior), 85-81 | 71-75 (inferior)
// Interno temporal: 101–120 (para no colisionar con permanente 1–32)
//   101–105 → 55..51 (sup. derecho)
//   106–110 → 61..65 (sup. izquierdo)
//   111–115 → 85..81 (inf. derecho)
//   116–120 → 71..75 (inf. izquierdo)

export function internoToFdiTemporal(n: number): number {
  if (n >= 101 && n <= 105) return 55 - (n - 101); // 101->55, 105->51
  if (n >= 106 && n <= 110) return 60 + (n - 105); // 106->61, 110->65
  if (n >= 111 && n <= 115) return 85 - (n - 111); // 111->85, 115->81
  if (n >= 116 && n <= 120) return 70 + (n - 115); // 116->71, 120->75
  return n;
}

export function fdiTemporalToInterno(fdi: number): number {
  const q = Math.floor(fdi / 10);
  const p = fdi % 10;
  if (q === 5) return 101 + (5 - p); // 55->101, 51->105
  if (q === 6) return 105 + p;       // 61->106, 65->110
  if (q === 8) return 111 + (5 - p); // 85->111, 81->115
  if (q === 7) return 115 + p;       // 71->116, 75->120
  return fdi;
}

export const FDI_SUPERIOR_TEMPORAL: number[] = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65];
export const FDI_INFERIOR_TEMPORAL: number[] = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75];

// ── Tipo anatómico ──────────────────────────────────────────────────────────
export type ToothType = "molar" | "premolar" | "canino" | "incisivo";

export function toothType(fdi: number): ToothType {
  const p = fdi % 10;
  if (p >= 6) return "molar";
  if (p >= 4) return "premolar";
  if (p === 3) return "canino";
  return "incisivo";
}

// Tipo para dientes temporales (solo molares, caninos e incisivos)
export function toothTypeTemporal(fdi: number): ToothType {
  const p = fdi % 10;
  if (p >= 4) return "molar";   // 4,5 → molares temporales
  if (p === 3) return "canino";
  return "incisivo";
}

export const FDI_SUPERIOR: number[] = [
  18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28,
];
export const FDI_INFERIOR: number[] = [
  48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38,
];

// ── Caras dentales ──────────────────────────────────────────────────────────
export type CaraDental = "vestibular" | "palatino" | "mesial" | "distal" | "oclusal" | "incisal";

export const CARA_LABELS: Record<CaraDental, string> = {
  vestibular: "Vestibular",
  palatino: "Palatino/Lingual",
  mesial: "Mesial",
  distal: "Distal",
  oclusal: "Oclusal",
  incisal: "Incisal",
};

// Qué cara central usar según tipo de diente
export function caraOclusalLabel(type: ToothType): CaraDental {
  return type === "incisivo" || type === "canino" ? "incisal" : "oclusal";
}
