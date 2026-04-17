import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import type { AppRole } from "@/lib/constants";

interface Props {
  children: ReactNode;
  roles?: AppRole[];
}

export function ProtectedRoute({ children, roles }: Props) {
  const { user, loading, hasAnyRole } = useAuth();
  const location = useLocation();

  if (loading) {
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

  return <>{children}</>;
}
