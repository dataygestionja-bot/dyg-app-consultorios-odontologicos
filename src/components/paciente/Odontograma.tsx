import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import {
  DIENTE_ESTADO_LABELS,
  DIENTE_ESTADO_DOT,
  DIENTE_ESTADOS_SELECCIONABLES,
  type DienteEstado,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import OdontogramaAnatomico from "./OdontogramaAnatomico";
import { internoToFdi, type CaraDental } from "@/lib/odontograma";

export interface PendienteCara {
  diente: number;
  cara: CaraDental;
  estado: DienteEstado;
}

interface Registro {
  id: string;
  paciente_id: string;
  diente: number;
  estado: DienteEstado;
  fecha: string;
  profesional_id: string;
  observaciones: string | null;
  cara?: string | null;
  tipo_denticion?: string | null;
  profesionales?: { nombre: string; apellido: string } | null;
}

export default function Odontograma({
  pacienteId,
  mode = "full",
  profesionalId,
  fechaAtencion,
  pendientes,
  onAgregarPendiente,
  onLimpiarPendientes,
}: {
  pacienteId: string;
  mode?: "full" | "inline";
  profesionalId?: string;
  fechaAtencion?: string;
  pendientes?: Map<string, PendienteCara>;
  onAgregarPendiente?: (key: string, p: PendienteCara) => void;
  onLimpiarPendientes?: () => void;
}) {
  const { user } = useAuth();
  const { can } = usePermissions();
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(false);

  async function cargar() {
    setLoading(true);
    const { data, error } = await supabase
      .from("odontograma_registros")
      .select("*, profesionales(nombre, apellido)")
      .eq("paciente_id", pacienteId)
      .order("fecha", { ascending: false });
    if (error) toast.error("No se pudo cargar el odontograma", { description: error.message });
    setRegistros((data ?? []) as Registro[]);
    setLoading(false);
  }

  useEffect(() => {
    if (pacienteId) cargar();
  }, [pacienteId]);

  const puedeAgregar = can("odontograma", "create");
  const modoDiferido = !!onAgregarPendiente;

  // Registros sintéticos para visualizar pendientes
  const registrosConPendientes = useMemo(() => {
    if (!pendientes || pendientes.size === 0) return registros;
    const fechaSint = new Date().toISOString();
    const sinteticos: Registro[] = [];
    pendientes.forEach((p) => {
      sinteticos.push({
        id: `pending-${p.diente}-${p.cara}`,
        paciente_id: pacienteId,
        diente: p.diente,
        estado: p.estado,
        fecha: fechaSint,
        profesional_id: profesionalId ?? "",
        observaciones: "(pendiente)",
        cara: p.cara,
        tipo_denticion: "permanente",
        profesionales: null,
      });
    });
    return [...sinteticos, ...registros];
  }, [registros, pendientes, pacienteId, profesionalId]);

  function handleCaraEstado(dienteInterno: number, cara: CaraDental, estado: DienteEstado) {
    if (modoDiferido) {
      const key = `${dienteInterno}-${cara}`;
      onAgregarPendiente!(key, { diente: dienteInterno, cara, estado });
      const fdi = internoToFdi(dienteInterno);
      toast.success(`Pieza ${fdi} · ${cara}: ${DIENTE_ESTADO_LABELS[estado]}`, {
        description: "Se guardará al confirmar la atención.",
      });
    }
  }

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Odontograma</h3>
          <p className="text-sm text-muted-foreground">
            {mode === "full" ? "Historial odontológico por pieza dental" : "Registrá cambios — se guardan al confirmar la atención"}
          </p>
        </div>
        {modoDiferido && pendientes && pendientes.size > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-amber-500 text-amber-700">
              {pendientes.size} {pendientes.size === 1 ? "cambio pendiente" : "cambios pendientes"}
            </Badge>
            <Button type="button" variant="ghost" size="sm" onClick={onLimpiarPendientes}>
              Descartar
            </Button>
          </div>
        )}
      </div>

      {/* Odontograma anatómico */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Odontograma</CardTitle>
          <CardDescription>
            {mode === "full"
              ? "Vista del estado actual por cara dental."
              : profesionalId
              ? "Hacé clic en una cara para registrar el estado."
              : "Seleccioná un profesional para poder registrar."}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 sm:px-2">
          <OdontogramaAnatomico
            registros={registrosConPendientes}
            pendientesKeys={pendientes ? new Set(pendientes.keys()) : new Set()}
            disabled={mode === "full" || (mode === "inline" && !profesionalId)}
            canCreate={modoDiferido && puedeAgregar && !!profesionalId}
            onCaraEstado={handleCaraEstado}
          />
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 px-3 text-[11px] text-muted-foreground">
            {DIENTE_ESTADOS_SELECCIONABLES.map((e) => (
              <div key={e} className="flex items-center gap-1.5">
                <span className={`inline-block h-2 w-2 rounded-sm ${DIENTE_ESTADO_DOT[e]}`} />
                <span>{DIENTE_ESTADO_LABELS[e]}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
