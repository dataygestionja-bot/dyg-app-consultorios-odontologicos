import { useEffect } from "react";
import { Link } from "react-router-dom";
import { CalendarPlus, LogIn, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Landing() {
  useEffect(() => {
    document.title = "Consultorios DG | Inicio";
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/40 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <header className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
            <Stethoscope className="h-8 w-8" aria-hidden />
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
            Consultorios DG
          </h1>
          <p className="mt-3 text-muted-foreground text-base sm:text-lg">
            Bienvenido. Elegí cómo querés continuar.
          </p>
        </header>

        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-6 sm:p-8">
            <div className="grid gap-4 sm:grid-cols-2">
              <Button
                asChild
                size="lg"
                className="h-auto py-5 px-5 flex flex-col items-center gap-2 text-base"
              >
                <Link to="/reservar" aria-label="Solicitar turno">
                  <CalendarPlus className="h-6 w-6" aria-hidden />
                  <span className="font-semibold">Solicitar turno</span>
                  <span className="text-xs font-normal opacity-90">
                    Para pacientes
                  </span>
                </Link>
              </Button>

              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-auto py-5 px-5 flex flex-col items-center gap-2 text-base"
              >
                <Link to="/auth" aria-label="Ingresar al sistema">
                  <LogIn className="h-6 w-6" aria-hidden />
                  <span className="font-semibold">Ingresar al sistema</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    Personal del consultorio
                  </span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <footer className="mt-8 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Consultorios DG
        </footer>
      </div>
    </main>
  );
}
