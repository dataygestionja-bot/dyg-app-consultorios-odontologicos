export const PERMISSION_ACTIONS = ["read", "create", "update", "delete"] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export const ACTION_LABELS: Record<PermissionAction, string> = {
  read: "Lectura",
  create: "Alta",
  update: "Modificación",
  delete: "Baja",
};

export interface ModuleDef {
  key: string;
  label: string;
}

export const MODULES: ModuleDef[] = [
  { key: "pacientes", label: "Pacientes" },
  { key: "profesionales", label: "Profesionales" },
  { key: "turnos", label: "Turnos" },
  { key: "atenciones", label: "Atenciones" },
  { key: "prestaciones", label: "Prestaciones" },
  { key: "obras_sociales", label: "Obras sociales" },
  { key: "cobros", label: "Cobros" },
  { key: "presupuestos", label: "Presupuestos" },
  { key: "seguridad_usuarios", label: "Seguridad – Usuarios" },
  { key: "seguridad_perfiles", label: "Seguridad – Perfiles" },
  { key: "auditoria", label: "Auditoría" },
  { key: "reportes", label: "Reportes" },
];

export const permKey = (module: string, action: PermissionAction) => `${module}:${action}`;

import type { AppRole } from "@/lib/constants";

// Defaults usados por "Restaurar valores por defecto" en la pantalla de perfiles.
// Deben coincidir con el seed de la migración inicial.
export const DEFAULT_PERMISSIONS: Record<AppRole, Record<string, Record<PermissionAction, boolean>>> = {
  admin: Object.fromEntries(
    MODULES.map((m) => [m.key, { read: true, create: true, update: true, delete: true }]),
  ) as Record<string, Record<PermissionAction, boolean>>,
  recepcion: {
    pacientes: { read: true, create: true, update: true, delete: true },
    profesionales: { read: true, create: false, update: false, delete: false },
    turnos: { read: true, create: true, update: true, delete: true },
    atenciones: { read: true, create: false, update: false, delete: false },
    prestaciones: { read: true, create: true, update: true, delete: true },
    obras_sociales: { read: true, create: true, update: true, delete: true },
    cobros: { read: true, create: true, update: true, delete: true },
    presupuestos: { read: true, create: true, update: true, delete: true },
    seguridad_usuarios: { read: false, create: false, update: false, delete: false },
    seguridad_perfiles: { read: false, create: false, update: false, delete: false },
    auditoria: { read: false, create: false, update: false, delete: false },
    reportes: { read: true, create: false, update: false, delete: false },
  },
  profesional: {
    pacientes: { read: true, create: false, update: false, delete: false },
    profesionales: { read: true, create: false, update: false, delete: false },
    turnos: { read: true, create: false, update: true, delete: false },
    atenciones: { read: true, create: true, update: true, delete: true },
    prestaciones: { read: true, create: false, update: false, delete: false },
    obras_sociales: { read: true, create: false, update: false, delete: false },
    cobros: { read: false, create: false, update: false, delete: false },
    presupuestos: { read: true, create: false, update: false, delete: false },
    seguridad_usuarios: { read: false, create: false, update: false, delete: false },
    seguridad_perfiles: { read: false, create: false, update: false, delete: false },
    auditoria: { read: false, create: false, update: false, delete: false },
    reportes: { read: false, create: false, update: false, delete: false },
  },
};
