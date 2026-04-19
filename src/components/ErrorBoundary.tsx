import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Languages } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

const isDomMutationError = (error: Error | null) => {
  if (!error?.message) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("removechild") ||
    msg.includes("insertbefore") ||
    msg.includes("not a child of this node")
  );
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary capturó un error:", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const translatorIssue = isDomMutationError(this.state.error);

      return (
        <div className="flex min-h-screen items-center justify-center p-6 bg-background">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="flex justify-center">
              {translatorIssue ? (
                <Languages className="h-10 w-10 text-primary" />
              ) : (
                <AlertTriangle className="h-10 w-10 text-destructive" />
              )}
            </div>
            <h2 className="text-2xl font-semibold">
              {translatorIssue
                ? "El traductor del navegador interrumpió la página"
                : "Ocurrió un error inesperado"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {translatorIssue ? (
                <>
                  Detectamos que una extensión de traducción (por ejemplo Google Translate) está
                  modificando el contenido y eso impide que la app funcione correctamente.
                  <br />
                  <br />
                  Por favor desactivá la traducción automática para este sitio y volvé a intentar.
                </>
              ) : (
                "No se pudo mostrar esta sección. Probá reintentar o volver al inicio."
              )}
            </p>
            {!translatorIssue && this.state.error?.message && (
              <pre className="text-left text-xs bg-muted/40 rounded-md p-3 overflow-auto max-h-40">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-2 justify-center flex-wrap">
              <Button variant="outline" onClick={() => window.location.assign("/")}>
                Ir al inicio
              </Button>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Recargar
              </Button>
              <Button onClick={this.handleReset}>Reintentar</Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
