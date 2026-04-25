import { useState, type MouseEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format, parseISO, isValid } from "date-fns";

interface WhatsAppTurnoButtonProps {
  telefono?: string | null;
  nombrePaciente: string;
  fecha: string; // yyyy-MM-dd
  hora: string; // HH:mm[:ss]
  size?: "sm" | "md";
}

// Ícono oficial de WhatsApp (SVG inline para mantener el color de marca #25D366).
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.143-.73-2.09-.832-2.335-.143-.372-.214-.487-.6-.487-.187 0-.36-.043-.53-.043-.302 0-.53.115-.717.43-.273.487-1.045 1.413-1.045 2.49 0 1.104.46 2.16 1.135 3.066 1.292 1.747 3.07 3.213 5.155 3.97.387.143 1.18.43 1.563.43.633 0 1.985-.387 2.346-1.06.158-.302.158-.547.158-.832 0-.16-.043-.345-.158-.43-.272-.215-1.706-.962-1.93-1.062z"/>
      <path d="M16.05 2.5C8.835 2.5 2.985 8.35 2.985 15.567c0 2.49.696 4.93 2.027 7.04L2.5 29.5l7.04-2.475a13.04 13.04 0 0 0 6.51 1.755h.004c7.213 0 13.063-5.85 13.063-13.067 0-3.49-1.358-6.77-3.823-9.235A12.96 12.96 0 0 0 16.05 2.5zm0 23.95h-.003a10.85 10.85 0 0 1-5.526-1.514l-.396-.235-4.114 1.448 1.473-4.012-.258-.413a10.86 10.86 0 0 1-1.66-5.78c0-6.005 4.886-10.89 10.893-10.89 2.91 0 5.642 1.135 7.7 3.193a10.83 10.83 0 0 1 3.187 7.7c0 6.006-4.886 10.892-10.89 10.892z"/>
    </svg>
  );
}

export function WhatsAppTurnoButton({
  telefono,
  nombrePaciente,
  fecha,
  hora,
  size = "sm",
}: WhatsAppTurnoButtonProps) {
  const [loading, setLoading] = useState(false);
  const tieneTelefono = !!telefono && telefono.trim().length > 0;

  const dim = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const iconDim = size === "sm" ? "h-6 w-6" : "h-7 w-7";

  function formatearFechaHora() {
    const d = parseISO(fecha);
    const fechaLeg = isValid(d) ? format(d, "dd/MM/yyyy") : fecha;
    const horaLeg = (hora ?? "").slice(0, 5);
    return { fechaLeg, horaLeg };
  }

  async function handleClick(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    e.preventDefault();
    if (!tieneTelefono || loading) return;

    setLoading(true);
    try {
      const { fechaLeg, horaLeg } = formatearFechaHora();
      const mensaje = `Hola ${nombrePaciente}, te recordamos tu turno el día ${fechaLeg} a las ${horaLeg}. Por favor confirma o responde a este mensaje.`;

      const { data, error } = await supabase.functions.invoke("send_whatsapp", {
        body: { telefono, mensaje },
      });

      if (error || (data && data.success === false)) {
        const msg =
          (data && (data.error as string)) ||
          error?.message ||
          "Error al enviar";
        toast.error("Error al enviar", { description: msg });
        return;
      }
      toast.success("Mensaje enviado");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al enviar";
      toast.error("Error al enviar", { description: msg });
    } finally {
      setLoading(false);
    }
  }

  const tooltipText = !tieneTelefono
    ? "Paciente sin teléfono"
    : loading
      ? "Enviando..."
      : "Enviar WhatsApp";

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleClick}
            disabled={!tieneTelefono || loading}
            aria-label={tooltipText}
            className={`${dim} inline-flex items-center justify-center rounded-full transition shrink-0 ${
              tieneTelefono
                ? "text-[#25D366] hover:bg-[#25D366]/10 cursor-pointer"
                : "text-muted-foreground/40 cursor-not-allowed"
            } ${loading ? "opacity-70" : ""}`}
          >
            {loading ? (
              <Loader2 className={`${iconDim} animate-spin`} />
            ) : (
              <WhatsAppIcon className={iconDim} />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">{tooltipText}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default WhatsAppTurnoButton;
