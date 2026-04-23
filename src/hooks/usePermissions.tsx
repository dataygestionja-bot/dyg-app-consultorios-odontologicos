import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { permKey, type PermissionAction } from "@/lib/permissions";

interface PermissionsContextValue {
  perms: Set<string>;
  loading: boolean;
  can: (module: string, action: PermissionAction) => boolean;
  refresh: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextValue | undefined>(undefined);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { roles, user } = useAuth();
  const [perms, setPerms] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user || roles.length === 0) {
      setPerms(new Set());
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("role_permissions")
      .select("module, action, allowed, role")
      .in("role", roles)
      .eq("allowed", true);
    if (error) {
      console.error("Error cargando permisos:", error);
      setPerms(new Set());
    } else {
      setPerms(new Set((data ?? []).map((r) => permKey(r.module, r.action as PermissionAction))));
    }
    setLoading(false);
  }, [user, roles]);

  useEffect(() => {
    load();
  }, [load]);

  const can = useCallback(
    (module: string, action: PermissionAction) => perms.has(permKey(module, action)),
    [perms],
  );

  return (
    <PermissionsContext.Provider value={{ perms, loading, can, refresh: load }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const ctx = useContext(PermissionsContext);
  if (!ctx) throw new Error("usePermissions debe usarse dentro de PermissionsProvider");
  return ctx;
}
