import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
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
import Atenciones from "./pages/Atenciones";
import AtencionForm from "./pages/AtencionForm";
import Prestaciones from "./pages/Prestaciones";
import Presupuestos from "./pages/Presupuestos";
import PresupuestoDetalle from "./pages/PresupuestoDetalle";
import Cobros from "./pages/Cobros";
import Seguridad from "./pages/seguridad/Seguridad";
import Usuarios from "./pages/seguridad/Usuarios";
import Perfiles from "./pages/seguridad/Perfiles";
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/" element={<Private><Dashboard /></Private>} />
            <Route path="/pacientes" element={<Private><Pacientes /></Private>} />
            <Route path="/pacientes/:id" element={<Private><PacienteForm /></Private>} />
            <Route path="/profesionales" element={<AdminOnly><Profesionales /></AdminOnly>} />
            <Route path="/profesionales/:id" element={<AdminOnly><ProfesionalForm /></AdminOnly>} />
            <Route path="/obras-sociales" element={
              <ProtectedRoute roles={["admin", "recepcion"]}><AppLayout><ObrasSociales /></AppLayout></ProtectedRoute>
            } />
            <Route path="/turnos" element={<Private><Turnos /></Private>} />
            <Route path="/atenciones" element={<Private><Atenciones /></Private>} />
            <Route path="/atenciones/:id" element={<Private><AtencionForm /></Private>} />

            {/* Gestión */}
            <Route path="/prestaciones" element={
              <ProtectedRoute roles={["admin", "recepcion"]}><AppLayout><Prestaciones /></AppLayout></ProtectedRoute>
            } />
            <Route path="/presupuestos" element={
              <ProtectedRoute roles={["admin", "recepcion"]}><AppLayout><Presupuestos /></AppLayout></ProtectedRoute>
            } />
            <Route path="/presupuestos/:id" element={
              <ProtectedRoute roles={["admin", "recepcion"]}><AppLayout><PresupuestoDetalle /></AppLayout></ProtectedRoute>
            } />
            <Route path="/cobros" element={
              <ProtectedRoute roles={["admin", "recepcion"]}><AppLayout><Cobros /></AppLayout></ProtectedRoute>
            } />

            {/* Administración de seguridad */}
            <Route path="/seguridad" element={<AdminOnly><Seguridad /></AdminOnly>} />
            <Route path="/seguridad/usuarios" element={<AdminOnly><Usuarios /></AdminOnly>} />
            <Route path="/seguridad/perfiles" element={<Private><Perfiles /></Private>} />
            <Route path="/seguridad/reportes" element={<AdminOnly><Reportes /></AdminOnly>} />
            <Route path="/seguridad/auditoria" element={<AdminOnly><Auditoria /></AdminOnly>} />

            {/* Compatibilidad ruta vieja */}
            <Route path="/usuarios" element={<AdminOnly><Usuarios /></AdminOnly>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
