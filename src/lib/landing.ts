import type { AppRole } from "./constants";

/**
 * Determina la pantalla inicial del personal interno tras iniciar sesión.
 * Todos los perfiles internos aterrizan en /dashboard.
 * (La raíz "/" es ahora una landing pública con dos accesos: paciente / staff.)
 */
export function getLandingPathForRoles(_roles: AppRole[]): string {
  return "/dashboard";
}

export function resolvePostLoginPath(
  roles: AppRole[],
  _attemptedPath?: string | null,
): string {
  return getLandingPathForRoles(roles);
}
