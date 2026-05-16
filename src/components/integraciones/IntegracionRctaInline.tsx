import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { registrarEvento } from "@/lib/audit";
import rctaLogoFallback from "@/assets/rcta-logo.jpg";

interface Integracion {
  codigo: string;
  nombre: string;
  url: string;
  logo_url: string | null;
  activa: boolean;
  abrir_nueva_pestana: boolean;
}

interface Props {
  atencionId: string | null;
  pacienteNombre?: string;
}

export function IntegracionRctaInline({ atencionId, pacienteNombre }: Props) {
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

  if (loading || !integracion || !integracion.activa) return null;

  const logo = integracion.logo_url || rctaLogoFallback;
  const nombre = integracion.nombre || "RCTA";
  const deshabilitado = !atencionId;

  const handleConfirm = async () => {
    setOpen(false);
    const target = integracion.abrir_nueva_pestana ? "_blank" : "_self";
    window.open(integracion.url, target, "noopener,noreferrer");
    if (atencionId) {
      await registrarEvento({
        accion: "abrir_rcta",
        entidad: "atencion",
        entidadId: atencionId,
        descripcion: `${pacienteNombre ? `Paciente: ${pacienteNombre} – ` : ""}URL: ${integracion.url}`,
      });
    }
  };

  const boton = (
    <button
      type="button"
      onClick={() => !deshabilitado && setOpen(true)}
      disabled={deshabilitado}
      aria-label={`Abrir ${nombre}`}
      className="inline-flex items-center justify-center rounded-md border border-border bg-background px-2 py-1 transition-all hover:border-primary/40 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <img src={logo} alt={nombre} className="h-6 object-contain" />
    </button>
  );

  return (
    <>
      {deshabilitado ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>{boton}</span>
            </TooltipTrigger>
            <TooltipContent>Guardá la atención primero para abrir {nombre}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        boton
      )}

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
