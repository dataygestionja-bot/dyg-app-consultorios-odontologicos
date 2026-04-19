import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

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
      return (
        <div className="flex min-h-screen items-center justify-center p-6 bg-background">
          <div className="max-w-md w-full text-center space-y-4">
            <h2 className="text-2xl font-semibold">Ocurrió un error inesperado</h2>
            <p className="text-sm text-muted-foreground">
              No se pudo mostrar esta sección. Probá recargar la página o volver al inicio.
            </p>
            {this.state.error?.message && (
              <pre className="text-left text-xs bg-muted/40 rounded-md p-3 overflow-auto max-h-40">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => window.location.assign("/")}>
                Ir al inicio
              </Button>
              <Button onClick={() => window.location.reload()}>Recargar</Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
