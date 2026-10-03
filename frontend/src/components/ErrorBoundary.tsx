import { Component, ErrorInfo, ReactNode } from "react";
import { ArrowClockwise, WarningCircle } from "@phosphor-icons/react";

const CLAVE_RECARGA = "habitasmart_recarga_por_chunk";

// Con code-splitting (React.lazy en App.tsx) cada pagina es un archivo JS con
// hash en el nombre. Tras un deploy esos archivos se reemplazan, asi que
// quien tenia la app abierta recibe un 404 al navegar a una pagina que aun
// no habia cargado -- sin esto, React se cae y queda la pantalla en blanco.
function esErrorDeCarga(error: Error): boolean {
  return /dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i.test(
    error.message
  );
}

function leerMarca(): boolean {
  try {
    return sessionStorage.getItem(CLAVE_RECARGA) === "1";
  } catch {
    return false;
  }
}

function escribirMarca(valor: boolean) {
  try {
    if (valor) sessionStorage.setItem(CLAVE_RECARGA, "1");
    else sessionStorage.removeItem(CLAVE_RECARGA);
  } catch {
    // sessionStorage bloqueado (modo privado estricto): se pierde solo la proteccion anti-bucle.
  }
}

interface Props {
  children: ReactNode;
  /** Al cambiar (ej. la ruta actual), se limpia el error y se vuelve a intentar renderizar. */
  resetKey?: string;
}

export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  private limpiarMarca?: ReturnType<typeof setTimeout>;

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidMount() {
    // Si la app lleva unos segundos funcionando, la recarga anterior (si hubo) sirvio.
    this.limpiarMarca = setTimeout(() => escribirMarca(false), 10_000);
  }

  componentWillUnmount() {
    clearTimeout(this.limpiarMarca);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Una sola recarga automatica: trae el index.html nuevo con los nombres de
    // archivo vigentes. La marca evita un bucle infinito si el problema es otro
    // (sin conexion, servidor caido).
    if (esErrorDeCarga(error) && !leerMarca()) {
      escribirMarca(true);
      window.location.reload();
      return;
    }
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    const deCarga = esErrorDeCarga(this.state.error);
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-lg dark:border-slate-700 dark:bg-slate-800">
          <WarningCircle size={40} weight="fill" className="mx-auto mb-3 text-amber-500" />
          <p className="font-display text-base font-bold text-slate-900 dark:text-white">
            {deCarga ? "Hay una versión nueva de HabitaSmart" : "Algo salió mal en esta pantalla"}
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {deCarga
              ? "Recarga la página para continuar. Si no tienes conexión, revísala e intenta de nuevo."
              : "Recarga la página para intentarlo de nuevo. Tus datos están a salvo."}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
          >
            <ArrowClockwise size={16} weight="bold" /> Recargar página
          </button>
        </div>
      </div>
    );
  }
}
