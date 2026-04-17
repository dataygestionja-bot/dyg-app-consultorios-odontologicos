import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCog, FileBarChart, ScrollText, ShieldCheck } from "lucide-react";

const submodulos = [
  {
    titulo: "Usuarios",
    descripcion: "Alta, baja y asignación de roles a los usuarios del sistema.",
    icon: Users,
    to: "/seguridad/usuarios",
  },
  {
    titulo: "Perfiles",
    descripcion: "Mi perfil personal y descripción de los roles disponibles.",
    icon: UserCog,
    to: "/seguridad/perfiles",
  },
  {
    titulo: "Reportes de seguridad",
    descripcion: "Usuarios activos, accesos fallidos y acciones por usuario.",
    icon: FileBarChart,
    to: "/seguridad/reportes",
  },
  {
    titulo: "Auditoría de seguridad",
    descripcion: "Bitácora de cambios sobre pacientes, turnos, roles y más.",
    icon: ScrollText,
    to: "/seguridad/auditoria",
  },
];

export default function Seguridad() {
  useEffect(() => {
    document.title = "Administración de seguridad | Consultorio";
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center text-primary">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Administración de seguridad</h1>
          <p className="text-sm text-muted-foreground">Gestión de usuarios, perfiles, reportes y auditoría</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {submodulos.map((s) => (
          <Link key={s.to} to={s.to} className="group">
            <Card className="h-full transition-colors hover:border-primary/50 hover:bg-accent/30">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <s.icon className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-base">{s.titulo}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{s.descripcion}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
