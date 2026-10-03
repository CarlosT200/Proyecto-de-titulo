import { createContext, ReactNode, useCallback, useContext, useState } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { Button, Modal } from "../components/ui";

interface ConfirmOptions {
  titulo?: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  /** "peligro" (rojo, por defecto) para acciones destructivas; "normal" para confirmaciones neutras. */
  tono?: "peligro" | "normal";
}

interface ConfirmState extends ConfirmOptions {
  mensaje: string;
  resolve: (valor: boolean) => void;
}

type Confirmar = (mensaje: string, opciones?: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirmar | undefined>(undefined);

// Reemplaza window.confirm() -- ese dialogo nativo del navegador se ve fuera
// de lugar (barra con el dominio, botones del sistema) en vez de parte de la
// app. Mismo patron que useToast(): un provider montado una vez en main.tsx
// que renderiza el modal, y un hook que cualquier pagina puede llamar de
// forma imperativa (await confirmar(...)) sin tener que manejar su propio
// estado de modal para cada confirmacion puntual (revocar visita, cancelar
// reserva, deshabilitar usuario, etc).
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<ConfirmState | null>(null);

  const confirmar = useCallback<Confirmar>((mensaje, opciones) => {
    return new Promise<boolean>((resolve) => {
      setEstado({ mensaje, ...opciones, resolve });
    });
  }, []);

  function responder(valor: boolean) {
    estado?.resolve(valor);
    setEstado(null);
  }

  return (
    <ConfirmContext.Provider value={confirmar}>
      {children}
      <Modal open={!!estado} onClose={() => responder(false)} title={estado?.titulo ?? "Confirmar acción"}>
        {estado && (
          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <WarningCircle
                size={22}
                weight="fill"
                className={`mt-0.5 shrink-0 ${estado.tono === "normal" ? "text-brand-500" : "text-amber-500"}`}
              />
              <p className="text-sm text-slate-600 dark:text-slate-300">{estado.mensaje}</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => responder(false)}>
                {estado.textoCancelar ?? "Cancelar"}
              </Button>
              <Button variant={estado.tono === "normal" ? "primary" : "danger"} onClick={() => responder(true)}>
                {estado.textoConfirmar ?? "Confirmar"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): Confirmar {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm debe usarse dentro de ConfirmProvider");
  return ctx;
}
