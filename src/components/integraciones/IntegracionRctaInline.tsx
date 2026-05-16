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
import { registrarEvento } from "@/lib/audit";
import { toast } from "@/hooks/use-toast";
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

  if (loading) return null;

  const nombre = integracion?.nombre || "RCTA";
  const logo = integracion?.logo_url || rctaLogoFallback;
  const urlValida = !!integracion?.url && /^https?:\/\//i.test(integracion.url);
  const inactiva = !integracion || !integracion.activa;
  const sinUrl = !inactiva && !urlValida;
  const motivoError = inactiva
    ? `La integración con ${nombre} está inactiva. Activala desde Seguridad › Integraciones.`
    : sinUrl
      ? `Falta configurar la URL de ${nombre}. Completala desde Seguridad › Integraciones.`
      : null;

  const handleClick = () => {
    if (motivoError) {
      toast({
        title: `No se puede abrir ${nombre}`,
        description: motivoError,
        variant: "destructive",
      });
      return;
    }
    setOpen(true);
  };

  const handleConfirm = async () => {
    setOpen(false);
    if (!integracion || !urlValida) return;
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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Abrir ${nombre}`}
        className="inline-flex items-center justify-center rounded-md border border-border bg-background px-2 py-1 transition-all hover:border-primary/40 hover:shadow-sm"
      >
        <img src={logo} alt={nombre} className="h-6 object-contain" />
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
