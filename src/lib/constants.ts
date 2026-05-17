export const ROLES = {
  ADMIN: "admin",
  RECEPCION: "recepcion",
  PROFESIONAL: "profesional",
} as const;

export type AppRole = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador",
  recepcion: "Recepción",
  profesional: "Profesional",
};

export const TURNO_ESTADOS = [
  "solicitado",
  "reservado",
  "confirmado",
  "atendido",
  "cancelado",
  "ausente",
  "reprogramado",
  "rechazado",
  "pendiente_cierre",
] as const;

export type TurnoEstado = (typeof TURNO_ESTADOS)[number];

export const TURNO_ESTADO_LABELS: Record<TurnoEstado, string> = {
  solicitado: "Solicitado",
  reservado: "Reservado",
  confirmado: "Confirmado",
  atendido: "Atendido",
  cancelado: "Cancelado",
  ausente: "Ausente",
  reprogramado: "Reprogramado",
  rechazado: "Rechazado",
  pendiente_cierre: "Pendiente de cierre",
};

export const TURNO_ESTADO_CLASSES: Record<TurnoEstado, string> = {
  solicitado: "bg-[hsl(var(--estado-solicitado))] text-white",
  reservado: "bg-[hsl(var(--estado-reservado))] text-white",
  confirmado: "bg-[hsl(var(--estado-confirmado))] text-white",
  atendido: "bg-[hsl(var(--estado-atendido))] text-white",
  cancelado: "bg-[hsl(var(--estado-cancelado))] text-white",
  ausente: "bg-[hsl(var(--estado-ausente))] text-white",
  reprogramado: "bg-[hsl(var(--estado-reprogramado))] text-white",
  rechazado: "bg-[hsl(var(--estado-rechazado))] text-white",
  pendiente_cierre: "bg-[hsl(var(--estado-pendiente-cierre))] text-white",
};

export const DIENTE_ESTADOS = [
  "sano",
  "caries",
  "obturacion",
  "endodoncia",
  "corona",
  "extraccion_indicada",
  "ausente",
  "implante",
  "protesis",
  "fractura",
  "tratamiento_en_curso",
  "otro",
  // Legacy (no se ofrecen en el selector nuevo, pero se mantienen para historial existente):
  "restauracion",
  "observacion",
] as const;

export type DienteEstado = (typeof DIENTE_ESTADOS)[number];

// Estados ofrecidos en el selector del odontograma (excluye los legacy).
export const DIENTE_ESTADOS_SELECCIONABLES: DienteEstado[] = [
  "sano",
  "caries",
  "obturacion",
  "endodoncia",
  "corona",
  "extraccion_indicada",
  "ausente",
  "implante",
  "protesis",
  "fractura",
  "tratamiento_en_curso",
  "otro",
];

export const DIENTE_ESTADO_LABELS: Record<DienteEstado, string> = {
  sano: "Sano",
  caries: "Caries",
  obturacion: "Obturación",
  endodoncia: "Endodoncia",
  corona: "Corona",
  extraccion_indicada: "Extracción indicada",
  ausente: "Ausente",
  implante: "Implante",
  protesis: "Prótesis",
  fractura: "Fractura",
  tratamiento_en_curso: "Tratamiento en curso",
  otro: "Otro",
  restauracion: "Restauración",
  observacion: "Observación",
};

// Mapeo visual (clases Tailwind). HEX usado en SVG (rellenos anatómicos) abajo.
export const DIENTE_ESTADO_CLASSES: Record<DienteEstado, string> = {
  sano: "bg-emerald-500 text-white",
  caries: "bg-red-500 text-white",
  obturacion: "bg-blue-500 text-white",
  endodoncia: "bg-violet-500 text-white",
  corona: "bg-amber-400 text-black",
  extraccion_indicada: "bg-orange-500 text-white",
  ausente: "bg-gray-400 text-white",
  implante: "bg-sky-400 text-white",
  protesis: "bg-amber-700 text-white",
  fractura: "bg-red-800 text-white",
  tratamiento_en_curso: "bg-yellow-400 text-black",
  otro: "bg-slate-500 text-white",
  restauracion: "bg-blue-500 text-white",
  observacion: "bg-yellow-400 text-black",
};

export const DIENTE_ESTADO_DOT: Record<DienteEstado, string> = {
  sano: "bg-emerald-500",
  caries: "bg-red-500",
  obturacion: "bg-blue-500",
  endodoncia: "bg-violet-500",
  corona: "bg-amber-400",
  extraccion_indicada: "bg-orange-500",
  ausente: "bg-gray-400",
  implante: "bg-sky-400",
  protesis: "bg-amber-700",
  fractura: "bg-red-800",
  tratamiento_en_curso: "bg-yellow-400",
  otro: "bg-slate-500",
  restauracion: "bg-blue-500",
  observacion: "bg-yellow-400",
};

// HEX (para fill de SVG / inline styles).
export const DIENTE_ESTADO_HEX: Record<DienteEstado, string> = {
  sano: "#10b981",
  caries: "#ef4444",
  obturacion: "#3b82f6",
  endodoncia: "#8b5cf6",
  corona: "#fbbf24",
  extraccion_indicada: "#f97316",
  ausente: "#9ca3af",
  implante: "#38bdf8",
  protesis: "#b45309",
  fractura: "#991b1b",
  tratamiento_en_curso: "#facc15",
  otro: "#64748b",
  restauracion: "#3b82f6",
  observacion: "#facc15",
};

export const DIAS_SEMANA = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
