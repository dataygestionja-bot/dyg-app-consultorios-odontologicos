// Mapeo entre numeración interna (1–32) usada en la base
// y numeración FDI (estándar odontológico) usada en la UI.
//
// Interno → FDI por cuadrantes:
//   1–8   → 18..11 (sup. derecho, distal → mesial)
//   9–16  → 21..28 (sup. izquierdo, mesial → distal)
//   17–24 → 31..38 (inf. izquierdo, mesial → distal)
//   25–32 → 41..48 (inf. derecho, mesial → distal)

export function internoToFdi(n: number): number {
  if (n >= 1 && n <= 8) return 18 - (n - 1); // 1->18, 8->11
  if (n >= 9 && n <= 16) return 20 + (n - 8); // 9->21, 16->28
  if (n >= 17 && n <= 24) return 30 + (n - 16); // 17->31, 24->38
  if (n >= 25 && n <= 32) return 48 - (n - 25); // 25->48, 32->41
  return n;
}

export function fdiToInterno(fdi: number): number {
  const q = Math.floor(fdi / 10);
  const p = fdi % 10;
  if (q === 1) return 9 - p; // 18->1
  if (q === 2) return 8 + p; // 21->9
  if (q === 3) return 16 + p; // 31->17
  if (q === 4) return 49 - p; // 41->32
  return fdi;
}

export type ToothType = "molar" | "premolar" | "canino" | "incisivo";

// Tipo anatómico por número FDI (válido para dientes permanentes).
export function toothType(fdi: number): ToothType {
  const p = fdi % 10;
  if (p >= 6) return "molar"; // 6,7,8
  if (p >= 4) return "premolar"; // 4,5
  if (p === 3) return "canino"; // 3
  return "incisivo"; // 1,2
}

// Listas ordenadas por arcada, de derecha a izquierda del paciente
// (visto de frente). Cuadrantes superior: 18..11 | 21..28, inferior: 48..41 | 31..38.
export const FDI_SUPERIOR: number[] = [
  18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28,
];
export const FDI_INFERIOR: number[] = [
  48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38,
];
