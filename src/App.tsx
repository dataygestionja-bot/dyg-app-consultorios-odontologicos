import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
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
import Usuarios from "./pages/Usuarios";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const Private = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <AppLayout>{children}</AppLayout>
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
            <Route path="/profesionales" element={
              <ProtectedRoute roles={["admin"]}><AppLayout><Profesionales /></AppLayout></ProtectedRoute>
            } />
            <Route path="/profesionales/:id" element={
              <ProtectedRoute roles={["admin"]}><AppLayout><ProfesionalForm /></AppLayout></ProtectedRoute>
            } />
            <Route path="/obras-sociales" element={
              <ProtectedRoute roles={["admin", "recepcion"]}><AppLayout><ObrasSociales /></AppLayout></ProtectedRoute>
            } />
            <Route path="/turnos" element={<Private><Turnos /></Private>} />
            <Route path="/atenciones" element={<Private><Atenciones /></Private>} />
            <Route path="/atenciones/:id" element={<Private><AtencionForm /></Private>} />
            <Route path="/usuarios" element={
              <ProtectedRoute roles={["admin"]}><AppLayout><Usuarios /></AppLayout></ProtectedRoute>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
