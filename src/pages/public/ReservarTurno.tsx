import { useEffect, useMemo, useState } from "react";
import { CalendarIcon, CheckCircle2, Loader2, Stethoscope } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { es } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Profesional {
  id: string;
  nombre: string;
  apellido: string;
  especialidad: string | null;
}

interface Slot {
  hora_inicio: string;
  hora_fin: string;
  ocupado: boolean;
}

interface FormData {
  profesional_id: string;
  fecha: Date | undefined;
  slot: Slot | null;
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string;
  email: string;
  motivo: string;
  observaciones: string;
}

const PHONE_RE = /^\+?\d{8,15}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const initialForm: FormData = {
  profesional_id: "",
  fecha: undefined,
  slot: null,
  nombre: "",
  apellido: "",
  dni: "",
  telefono: "",
  email: "",
  motivo: "",
  observaciones: "",
};

export default function ReservarTurno() {
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [loadingProf, setLoadingProf] = useState(true);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState<FormData>(initialForm);

  // ----- Cargar profesionales -----
  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke(
          "public_agenda_disponibilidad",
          { method: "GET" as never },
          // Fallback manual: invoke no admite query string fácil; usamos fetch directo
        );
        if (error) throw error;
        if (activo && data?.profesionales) {
          setProfesionales(data.profesionales);
        }
      } catch {
        // Reintento con fetch directo (el SDK no setea ?listar=...)
        try {
          const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public_agenda_disponibilidad?listar=profesionales`;
          const res = await fetch(url, {
            headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "" },
          });
          const json = await res.json();
          if (activo && json?.profesionales) setProfesionales(json.profesionales);
        } catch (e) {
          console.error(e);
          toast.error("No se pudieron cargar los profesionales");
        }
      } finally {
        if (activo) setLoadingProf(false);
      }
    })();
    return () => { activo = false; };
  }, []);

  // ----- Cargar slots cuando cambia profesional o fecha -----
  useEffect(() => {
    if (!form.profesional_id || !form.fecha) {
      setSlots([]);
      return;
    }
    let activo = true;
    (async () => {
      setLoadingSlots(true);
      setSlots([]);
      try {
        const fechaStr = format(form.fecha!, "yyyy-MM-dd");
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public_agenda_disponibilidad?profesional_id=${form.profesional_id}&fecha=${fechaStr}`;
        const res = await fetch(url, {
          headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "" },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Error obteniendo horarios");
        if (activo) setSlots(json.slots ?? []);
      } catch (e) {
        console.error(e);
        if (activo) toast.error(e instanceof Error ? e.message : "Error obteniendo horarios");
      } finally {
        if (activo) setLoadingSlots(false);
      }
    })();
    return () => { activo = false; };
  }, [form.profesional_id, form.fecha]);

  const slotsLibres = useMemo(() => slots.filter((s) => !s.ocupado), [slots]);

  const profesionalSeleccionado = useMemo(
    () => profesionales.find((p) => p.id === form.profesional_id),
    [profesionales, form.profesional_id],
  );

  function set<K extends keyof FormData>(k: K, v: FormData[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function validarForm(): string | null {
    if (!form.profesional_id) return "Elegí un profesional";
    if (!form.fecha) return "Elegí una fecha";
    if (!form.slot) return "Elegí un horario disponible";
    if (form.nombre.trim().length < 2) return "Ingresá tu nombre";
    if (form.apellido.trim().length < 2) return "Ingresá tu apellido";
    const dni = form.dni.replace(/\D/g, "");
    if (dni.length < 6) return "DNI inválido";
    const tel = form.telefono.replace(/[\s-]/g, "");
    if (!PHONE_RE.test(tel)) return "Teléfono inválido. Incluí código de país (ej: 5492214189600)";
    if (form.email && !EMAIL_RE.test(form.email)) return "Email inválido";
    if (form.motivo.trim().length < 5) return "Contanos brevemente el motivo";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validarForm();
    if (err) {
      toast.error(err);
      return;
    }
    setSubmitting(true);
    try {
      const fechaStr = format(form.fecha!, "yyyy-MM-dd");
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public_solicitar_turno`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
        },
        body: JSON.stringify({
          profesional_id: form.profesional_id,
          fecha: fechaStr,
          hora_inicio: form.slot!.hora_inicio,
          hora_fin: form.slot!.hora_fin,
          nombre: form.nombre.trim(),
          apellido: form.apellido.trim(),
          dni: form.dni.replace(/\D/g, ""),
          telefono: form.telefono.replace(/[\s-]/g, ""),
          email: form.email.trim() || undefined,
          motivo: form.motivo.trim(),
          observaciones: form.observaciones.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error ?? "No se pudo enviar la solicitud");
      }
      setSuccess(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al enviar la solicitud");
    } finally {
      setSubmitting(false);
    }
  }

  // ----- Pantalla de éxito -----
  if (success) {
    const fechaLeg = form.fecha && isValid(form.fecha)
      ? format(form.fecha, "EEEE d 'de' MMMM 'de' yyyy", { locale: es })
      : "";
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-lg w-full">
          <CardHeader className="text-center space-y-3">
            <div className="mx-auto h-14 w-14 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <CardTitle className="text-2xl">¡Solicitud recibida!</CardTitle>
            <CardDescription>
              Te enviamos un WhatsApp confirmando que recibimos tu pedido.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-md border bg-muted/30 p-4 space-y-1">
              <p><strong>Profesional:</strong> {profesionalSeleccionado?.nombre} {profesionalSeleccionado?.apellido}</p>
              <p><strong>Fecha:</strong> {fechaLeg}</p>
              <p><strong>Hora:</strong> {form.slot?.hora_inicio.slice(0,5)} hs</p>
              <p><strong>Paciente:</strong> {form.nombre} {form.apellido}</p>
            </div>
            <p className="text-muted-foreground text-center pt-2">
              Recibirás otro mensaje cuando el turno sea confirmado por la recepción.
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => { setForm(initialForm); setSuccess(false); setSlots([]); }}
            >
              Solicitar otro turno
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-3xl mx-auto px-4 py-5 flex items-center gap-3">
          <div className="relative h-9 w-9 rounded-md bg-primary flex items-center justify-center text-primary-foreground">
            <span className="font-semibold leading-none">O</span>
            <span className="absolute top-1 right-1 text-[10px] leading-none font-semibold">+</span>
          </div>
          <div>
            <h1 className="font-semibold leading-tight">Reservá tu turno</h1>
            <p className="text-xs text-muted-foreground leading-tight">
              Consultorio Odontológico
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Solicitud de turno online</CardTitle>
            <CardDescription>
              Completá el formulario y recibirás un WhatsApp cuando confirmemos tu turno.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Profesional */}
              <div className="grid gap-2">
                <Label htmlFor="profesional">Profesional *</Label>
                <Select
                  value={form.profesional_id}
                  onValueChange={(v) => { set("profesional_id", v); set("slot", null); }}
                  disabled={loadingProf}
                >
                  <SelectTrigger id="profesional">
                    <SelectValue placeholder={loadingProf ? "Cargando..." : "Seleccioná un profesional"} />
                  </SelectTrigger>
                  <SelectContent>
                    {profesionales.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="flex items-center gap-2">
                          <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" />
                          {p.nombre} {p.apellido}
                          {p.especialidad ? <span className="text-muted-foreground"> · {p.especialidad}</span> : null}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Fecha */}
              <div className="grid gap-2">
                <Label>Fecha *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !form.fecha && "text-muted-foreground",
                      )}
                      disabled={!form.profesional_id}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.fecha
                        ? format(form.fecha, "EEEE d 'de' MMMM 'de' yyyy", { locale: es })
                        : "Elegí una fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={form.fecha}
                      onSelect={(d) => { set("fecha", d ?? undefined); set("slot", null); }}
                      disabled={(date) => {
                        const hoy = new Date(); hoy.setHours(0,0,0,0);
                        return date < hoy;
                      }}
                      locale={es}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Slots */}
              {form.profesional_id && form.fecha && (
                <div className="grid gap-2">
                  <Label>Horarios disponibles *</Label>
                  {loadingSlots ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                      <Loader2 className="h-4 w-4 animate-spin" /> Buscando horarios...
                    </div>
                  ) : slotsLibres.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-3">
                      No hay horarios disponibles para esta fecha. Probá con otro día.
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                      {slotsLibres.map((s) => {
                        const selected =
                          form.slot?.hora_inicio === s.hora_inicio &&
                          form.slot?.hora_fin === s.hora_fin;
                        return (
                          <Button
                            key={`${s.hora_inicio}-${s.hora_fin}`}
                            type="button"
                            variant={selected ? "default" : "outline"}
                            size="sm"
                            onClick={() => set("slot", s)}
                          >
                            {s.hora_inicio.slice(0,5)}
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Datos personales */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="nombre">Nombre *</Label>
                  <Input id="nombre" value={form.nombre} onChange={(e) => set("nombre", e.target.value)} maxLength={80} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="apellido">Apellido *</Label>
                  <Input id="apellido" value={form.apellido} onChange={(e) => set("apellido", e.target.value)} maxLength={80} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dni">DNI *</Label>
                  <Input
                    id="dni"
                    value={form.dni}
                    onChange={(e) => set("dni", e.target.value)}
                    inputMode="numeric"
                    maxLength={12}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="telefono">Teléfono WhatsApp *</Label>
                  <Input
                    id="telefono"
                    placeholder="Ej: 5492214189600"
                    value={form.telefono}
                    onChange={(e) => set("telefono", e.target.value)}
                    inputMode="tel"
                    maxLength={20}
                  />
                  <p className="text-xs text-muted-foreground">Incluí código de país sin espacios.</p>
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="email">Email (opcional)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    maxLength={120}
                  />
                </div>
              </div>

              {/* Motivo */}
              <div className="grid gap-2">
                <Label htmlFor="motivo">Motivo o práctica *</Label>
                <Textarea
                  id="motivo"
                  rows={2}
                  value={form.motivo}
                  onChange={(e) => set("motivo", e.target.value)}
                  maxLength={500}
                  placeholder="Ej: Control general, dolor de muela, limpieza..."
                />
              </div>

              {/* Observaciones */}
              <div className="grid gap-2">
                <Label htmlFor="observaciones">Observaciones (opcional)</Label>
                <Textarea
                  id="observaciones"
                  rows={2}
                  value={form.observaciones}
                  onChange={(e) => set("observaciones", e.target.value)}
                  maxLength={1000}
                />
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando solicitud...
                  </>
                ) : (
                  "Solicitar turno"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
