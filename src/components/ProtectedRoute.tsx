import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import type { AppRole } from "@/lib/constants";
import type { PermissionAction } from "@/lib/permissions";

interface Props {
  children: ReactNode;
  roles?: AppRole[];
  permission?: { module: string; action: PermissionAction };
}

export function ProtectedRoute({ children, roles, permission }: Props) {
  const { user, loading, hasAnyRole } = useAuth();
  const { can, loading: permLoading } = usePermissions();
  const location = useLocation();

  if (loading || (permission && permLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (roles && roles.length > 0 && !hasAnyRole(roles)) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Acceso denegado</h2>
          <p className="text-muted-foreground">No tenés permisos para ver esta sección.</p>
        </div>
      </div>
    );
  }

  if (permission && !can(permission.module, permission.action)) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Acceso denegado</h2>
          <p className="text-muted-foreground">No tenés permisos para ver esta sección.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

