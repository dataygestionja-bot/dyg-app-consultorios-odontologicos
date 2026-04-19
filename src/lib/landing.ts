import type { AppRole } from "./constants";

/**
 * Determina la pantalla inicial según el perfil del usuario.
 * - recepcion -> Dashboard (/)
 * - admin / profesional -> Dashboard (/) por defecto (se puede personalizar luego)
 */
export function getLandingPathForRoles(roles: AppRole[]): string {
  if (roles.includes("recepcion")) return "/";
  if (roles.includes("admin")) return "/";
  if (roles.includes("profesional")) return "/";
  return "/";
}

/**
 * Rutas a las que NO se debe volver automáticamente tras login
 * (deben caer al landing por rol).
 */
const NON_RETURNABLE = new Set<string>(["/auth", "/", ""]);

export function resolvePostLoginPath(
  roles: AppRole[],
  _attemptedPath?: string | null,
): string {
  // Todos los perfiles aterrizan en el Dashboard tras iniciar sesión.
  return getLandingPathForRoles(roles);
}
