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
  attemptedPath?: string | null,
): string {
  const landing = getLandingPathForRoles(roles);
  if (!attemptedPath) return landing;
  if (NON_RETURNABLE.has(attemptedPath)) return landing;

  // Para perfil recepción, siempre forzamos Dashboard al iniciar sesión.
  if (roles.includes("recepcion")) return landing;

  return attemptedPath;
}
