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
  "restauracion",
  "ausente",
  "observacion",
] as const;

export type DienteEstado = (typeof DIENTE_ESTADOS)[number];

export const DIENTE_ESTADO_LABELS: Record<DienteEstado, string> = {
  sano: "Sano",
  caries: "Caries",
  restauracion: "Restauración",
  ausente: "Ausente",
  observacion: "Observación",
};

// Mapeo visual (solo UI). Usamos clases Tailwind con colores de marca.
export const DIENTE_ESTADO_CLASSES: Record<DienteEstado, string> = {
  sano: "bg-green-500 text-white",
  caries: "bg-red-500 text-white",
  restauracion: "bg-blue-500 text-white",
  ausente: "bg-gray-400 text-white",
  observacion: "bg-yellow-400 text-black",
};

// Color "punto" para tabla resumen
export const DIENTE_ESTADO_DOT: Record<DienteEstado, string> = {
  sano: "bg-green-500",
  caries: "bg-red-500",
  restauracion: "bg-blue-500",
  ausente: "bg-gray-400",
  observacion: "bg-yellow-400",
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
