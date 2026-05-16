import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { registrarEvento } from "@/lib/audit";
import rctaLogoFallback from "@/assets/rcta-logo.jpg";
import { ExternalLink } from "lucide-react";

interface Integracion {
  codigo: string;
  nombre: string;
  url: string;
  logo_url: string | null;
  activa: boolean;
  abrir_nueva_pestana: boolean;
}

interface Props {
  atencionId: string;
  pacienteNombre?: string;
}

export function IntegracionRctaCard({ atencionId, pacienteNombre }: Props) {
  const [integracion, setIntegracion] = useState<Integracion | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("integraciones_externas")
        .select("codigo, nombre, url, logo_url, activa, abrir_nueva_pestana")
        .eq("codigo", "rcta")
        .maybeSingle();
      setIntegracion(data as Integracion | null);
      setLoading(false);
    })();
  }, []);

  if (loading) return null;

  const inactiva = !integracion || !integracion.activa;
  const logo = integracion?.logo_url || rctaLogoFallback;
  const nombre = integracion?.nombre ?? "RCTA";

  const handleConfirm = async () => {
    if (!integracion) return;
    setOpen(false);
    const target = integracion.abrir_nueva_pestana ? "_blank" : "_self";
    window.open(integracion.url, target, "noopener,noreferrer");
    await registrarEvento({
      accion: "abrir_rcta",
      entidad: "atencion",
      entidadId: atencionId,
      descripcion: `${pacienteNombre ? `Paciente: ${pacienteNombre} – ` : ""}URL: ${integracion.url}`,
    });
  };

  if (inactiva) {
    return (
      <Card className="opacity-60 border-dashed">
        <CardContent className="p-6 flex flex-col items-center justify-center text-center gap-2">
          <img src={logo} alt={nombre} className="max-h-12 grayscale" />
          <p className="text-sm text-muted-foreground">Integración no disponible</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-left group"
        aria-label={`Abrir ${nombre}`}
      >
        <Card className="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/40 cursor-pointer">
          <CardContent className="p-6 flex flex-col items-center text-center gap-3">
            <img
              src={logo}
              alt={nombre}
              className="max-h-16 object-contain rounded-md transition-transform group-hover:scale-105"
            />
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <span>Abrir {nombre}</span>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground max-w-sm">
              Se abrirá la plataforma externa para gestionar la receta electrónica.
            </p>
          </CardContent>
        </Card>
      </button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Abrir {nombre}</AlertDialogTitle>
            <AlertDialogDescription>
              Se abrirá la plataforma externa {nombre} en una nueva pestaña. La emisión y validez
              legal de la receta se realiza dentro de {nombre}. Luego podrá registrar manualmente
              el número, link o PDF de la receta en esta atención.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Abrir {nombre}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
