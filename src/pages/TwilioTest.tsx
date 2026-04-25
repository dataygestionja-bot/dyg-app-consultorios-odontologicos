import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertTriangle, Loader2, Send } from "lucide-react";

type Resultado =
  | { tipo: "ok"; data: any }
  | { tipo: "auth"; data: any; status: number }
  | { tipo: "error"; mensaje: string; data?: any; status?: number }
  | null;

export default function TwilioTest() {
  const [telefono, setTelefono] = useState("5492214189600");
  const [mensaje, setMensaje] = useState("Hola, prueba desde sistema Lovable");
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<Resultado>(null);

  const enviar = async () => {
    setLoading(true);
    setResultado(null);
    try {
      const { data, error } = await supabase.functions.invoke("send_whatsapp", {
        body: { telefono, mensaje },
      });

      if (error) {
        // FunctionsHttpError trae el body en error.context
        let detalle: any = null;
        try {
          const ctx: any = (error as any).context;
          if (ctx && typeof ctx.json === "function") detalle = await ctx.json();
        } catch {
          /* ignore */
        }
        const status = (error as any).context?.status as number | undefined;
        const code = detalle?.twilio?.code;
        if (status === 401 || code === 20003) {
          setResultado({ tipo: "auth", data: detalle ?? { error: error.message }, status: status ?? 401 });
        } else {
          setResultado({
            tipo: "error",
            mensaje: detalle?.error ?? error.message ?? "Error desconocido",
            data: detalle,
            status,
          });
        }
        return;
      }

      if (data?.success) {
        setResultado({ tipo: "ok", data });
      } else {
        setResultado({
          tipo: "error",
          mensaje: data?.error ?? "Respuesta inesperada",
          data,
        });
      }
    } catch (err) {
      setResultado({
        tipo: "error",
        mensaje: err instanceof Error ? err.message : "Error de red",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-3xl py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Prueba de conexión Twilio</h1>
        <p className="text-sm text-muted-foreground">
          Validá tus credenciales enviando un mensaje de WhatsApp de prueba a través del sandbox de Twilio.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Enviar mensaje de prueba</CardTitle>
          <CardDescription>
            Se usa el número emisor del sandbox <code className="text-xs">whatsapp:+14155238886</code>. El destinatario debe haber
            unido el sandbox enviando el código <code className="text-xs">join &lt;palabra&gt;</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="telefono">Teléfono destino (con código de país, sin "+")</Label>
            <Input
              id="telefono"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="5492214189600"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mensaje">Mensaje</Label>
            <Textarea
              id="mensaje"
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              rows={3}
            />
          </div>
          <Button onClick={enviar} disabled={loading || !telefono || !mensaje}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" /> Enviar prueba
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {resultado && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              Resultado
              {resultado.tipo === "ok" && <Badge>OK</Badge>}
              {resultado.tipo === "auth" && (
                <Badge variant="destructive">401 Auth</Badge>
              )}
              {resultado.tipo === "error" && (
                <Badge variant="destructive">Error</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {resultado.tipo === "ok" && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Mensaje enviado</AlertTitle>
                <AlertDescription>
                  SID: <code className="text-xs">{resultado.data.sid}</code> — Estado:{" "}
                  <code className="text-xs">{resultado.data.status}</code>
                </AlertDescription>
              </Alert>
            )}
            {resultado.tipo === "auth" && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Credenciales inválidas (401 / Twilio 20003)</AlertTitle>
                <AlertDescription>
                  Verificá <code className="text-xs">TWILIO_ACCOUNT_SID</code> (debe empezar con <code>AC</code>) y{" "}
                  <code className="text-xs">TWILIO_AUTH_TOKEN</code> en la consola de Twilio.
                </AlertDescription>
              </Alert>
            )}
            {resultado.tipo === "error" && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>
                  {resultado.status ? `Error ${resultado.status}` : "Error"}
                </AlertTitle>
                <AlertDescription>{resultado.mensaje}</AlertDescription>
              </Alert>
            )}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Respuesta cruda:</p>
              <pre className="bg-muted rounded-md p-3 text-xs overflow-auto max-h-80">
{JSON.stringify(resultado.tipo === "error" ? (resultado.data ?? { error: resultado.mensaje }) : resultado.data, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
