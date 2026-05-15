import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { addDays, format, startOfWeek, isValid, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { AgendaSemanalMatriz } from "@/components/turnos/AgendaSemanalMatriz";
import ListadoPorPacienteDialog from "@/components/turnos/ListadoPorPacienteDialog";

const safeFormat = (d: Date | null | undefined, fmt: string, opts?: Parameters<typeof format>[2]) => {
  if (!d || !isValid(d)) return "";
  try { return format(d, fmt, opts); } catch { return ""; }
};
const safeParseISO = (s: string | null | undefined): Date | null => {
  if (!s) return null;
  const d = parseISO(s);
  return isValid(d) ? d : null;
};

export default function Turnos() {
  const [fecha, setFecha] = useState<Date>(new Date());
  const [search, setSearch] = useState("");
  const [listadoOpen, setListadoOpen] = useState(false);

  useEffect(() => {
    document.title = "Turnos | Consultorio";
  }, []);

  const inicio = startOfWeek(fecha, { weekStartsOn: 1 });
  const fin = addDays(inicio, 6);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Turnos</h1>
          <p className="text-sm text-muted-foreground">Agenda semanal por profesional</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setListadoOpen(true)}>
            <Users className="h-4 w-4 mr-2" />
            Listar por paciente
          </Button>
          <Input
            placeholder="Buscar profesional..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-[200px]"
          />
          <div className="flex items-center gap-1 rounded-md border">
            <Button variant="ghost" size="icon" onClick={() => setFecha(addDays(inicio, -7))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="date"
              value={safeFormat(inicio, "yyyy-MM-dd")}
              onChange={(e) => {
                const d = safeParseISO(e.target.value);
                if (d) setFecha(d);
              }}
              className="w-[150px] border-0 focus-visible:ring-0"
            />
            <Button variant="ghost" size="icon" onClick={() => setFecha(addDays(inicio, 7))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Semana del {safeFormat(inicio, "d MMM", { locale: es })} al {safeFormat(fin, "d MMM yyyy", { locale: es })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AgendaSemanalMatriz semanaInicio={inicio} search={search} />
        </CardContent>
      </Card>
    </div>
  );
}
