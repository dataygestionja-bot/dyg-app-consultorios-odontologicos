import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { PermissionsProvider } from "@/hooks/usePermissions";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import AuthPage from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Pacientes from "./pages/Pacientes";
import PacienteForm from "./pages/PacienteForm";
import Profesionales from "./pages/Profesionales";
import ProfesionalForm from "./pages/ProfesionalForm";
import ObrasSociales from "./pages/ObrasSociales";
import Turnos from "./pages/Turnos";
import MisTurnos from "./pages/MisTurnos";
import Bloqueos from "./pages/Bloqueos";
import Atenciones from "./pages/Atenciones";
import AtencionForm from "./pages/AtencionForm";
import AtencionDetalle from "./pages/AtencionDetalle";
import Prestaciones from "./pages/Prestaciones";
import Presupuestos from "./pages/Presupuestos";
import PresupuestoDetalle from "./pages/PresupuestoDetalle";
import Cobros from "./pages/Cobros";
import Seguridad from "./pages/seguridad/Seguridad";
import Usuarios from "./pages/seguridad/Usuarios";
import Perfiles from "./pages/seguridad/Perfiles";
import MiPerfil from "./pages/seguridad/MiPerfil";
import Reportes from "./pages/seguridad/Reportes";
import Auditoria from "./pages/seguridad/Auditoria";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const Private = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <AppLayout>
      <ErrorBoundary>{children}</ErrorBoundary>
    </AppLayout>
  </ProtectedRoute>
);

const AdminOnly = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute roles={["admin"]}>
    <AppLayout>
      <ErrorBoundary>{children}</ErrorBoundary>
    </AppLayout>
  </ProtectedRoute>
);

const RoleProtected = ({
  roles,
  children,
}: {
  roles: ("admin" | "recepcion" | "profesional")[];
  children: React.ReactNode;
}) => (
  <ProtectedRoute roles={roles}>
    <AppLayout>
      <ErrorBoundary>{children}</ErrorBoundary>
    </AppLayout>
  </ProtectedRoute>
);

const PermProtected = ({
  module,
  action,
  children,
}: {
  module: string;
  action: "read" | "create" | "update" | "delete";
  children: React.ReactNode;
}) => (
  <ProtectedRoute permission={{ module, action }}>
    <AppLayout>
      <ErrorBoundary>{children}</ErrorBoundary>
    </AppLayout>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <PermissionsProvider>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/" element={<Private><Dashboard /></Private>} />
            <Route path="/pacientes" element={<Private><Pacientes /></Private>} />
            <Route path="/pacientes/:id" element={<Private><PacienteForm /></Private>} />
            <Route path="/profesionales" element={<AdminOnly><Profesionales /></AdminOnly>} />
            <Route path="/profesionales/:id" element={<AdminOnly><ProfesionalForm /></AdminOnly>} />
            <Route path="/obras-sociales" element={
              <RoleProtected roles={["admin", "recepcion"]}><ObrasSociales /></RoleProtected>
            } />
            <Route path="/turnos" element={
              <PermProtected module="agenda" action="read"><Turnos /></PermProtected>
            } />
            <Route path="/mis-turnos" element={<Private><MisTurnos /></Private>} />
            <Route path="/bloqueos" element={
              <PermProtected module="bloqueos_agenda" action="read"><Bloqueos /></PermProtected>
            } />
            <Route path="/atenciones" element={<Private><Atenciones /></Private>} />
            <Route path="/atenciones/:id/ver" element={<Private><AtencionDetalle /></Private>} />
            <Route path="/atenciones/:id" element={<Private><AtencionForm /></Private>} />

            {/* Gestión */}
            <Route path="/prestaciones" element={
              <RoleProtected roles={["admin", "recepcion"]}><Prestaciones /></RoleProtected>
            } />
            <Route path="/presupuestos" element={
              <RoleProtected roles={["admin", "recepcion"]}><Presupuestos /></RoleProtected>
            } />
            <Route path="/presupuestos/:id" element={
              <RoleProtected roles={["admin", "recepcion"]}><PresupuestoDetalle /></RoleProtected>
            } />
            <Route path="/cobros" element={
              <RoleProtected roles={["admin", "recepcion"]}><Cobros /></RoleProtected>
            } />

            {/* Administración de seguridad */}
            <Route path="/seguridad" element={<AdminOnly><Seguridad /></AdminOnly>} />
            <Route path="/seguridad/usuarios" element={<AdminOnly><Usuarios /></AdminOnly>} />
            <Route path="/seguridad/perfiles" element={<AdminOnly><Perfiles /></AdminOnly>} />
            <Route path="/seguridad/mi-perfil" element={<Private><MiPerfil /></Private>} />
            <Route path="/seguridad/reportes" element={<AdminOnly><Reportes /></AdminOnly>} />
            <Route path="/seguridad/auditoria" element={<AdminOnly><Auditoria /></AdminOnly>} />

            {/* Compatibilidad ruta vieja */}
            <Route path="/usuarios" element={<AdminOnly><Usuarios /></AdminOnly>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
          </PermissionsProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
