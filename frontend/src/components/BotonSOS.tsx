import { useEffect, useState } from "react";
import { Siren, X } from "@phosphor-icons/react";
import { Modal } from "./ui";
import { api, getToken } from "../api/client";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import type { TipoEmergenciaSos } from "../types";

// Boton SOS para residentes: siempre visible (flotante), pensado para una emergencia real -- nunca
// debe quedar escondido en un menu. En operacion real, el telefono del residente llama de verdad al
// numero de emergencia (Chile: 133/132/131) via "tel:"; en paralelo se avisa a conserjeria/
// administracion para que puedan asistir (abrir reja, guiar a la ambulancia, etc.). Ese aviso interno
// es un complemento: NUNCA reemplaza ni condiciona la llamada real.
const OPCIONES: {
  tipo: TipoEmergenciaSos;
  numero: string;
  titulo: string;
  clases: string;
  textoClases: string;
}[] = [
  {
    tipo: "CARABINEROS",
    numero: "133",
    titulo: "Carabineros",
    clases: "bg-emerald-600 hover:bg-emerald-700",
    textoClases: "text-white",
  },
  {
    tipo: "BOMBEROS",
    numero: "132",
    titulo: "Bomberos",
    clases: "bg-red-600 hover:bg-red-700",
    textoClases: "text-white",
  },
  {
    tipo: "AMBULANCIA",
    numero: "131",
    titulo: "Ambulancia (SAMU)",
    clases: "bg-amber-400 hover:bg-amber-500",
    textoClases: "text-slate-900",
  },
];

// Envia el aviso de SOS. Se usa fetch con keepalive (no axios) porque, en operacion real, justo
// despues la pagina navega a "tel:...": keepalive MEJORA la probabilidad de que la peticion se
// complete aunque la pagina se descargue, pero NO la garantiza (puede fallar por red, tamano, etc.).
// Por eso nunca se afirma que el aviso "llego" sin confirmacion del servidor. Lanza si el servidor no
// responde 2xx, para poder distinguir exito de error cuando si se espera la respuesta (modo demo).
async function enviarAlertaSos(tipo: TipoEmergenciaSos): Promise<void> {
  const token = getToken();
  const res = await fetch("/api/sos", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ tipo }),
    keepalive: true,
  });
  if (!res.ok) throw new Error("No se pudo enviar la alerta.");
}

// "indeterminado" mientras no se sepa el modo (config aun no cargo o fallo): en ese estado NO se abre
// una llamada real sin confirmar, para evitar una llamada accidental.
type ModoSos = "indeterminado" | "demo" | "real";

export function BotonSOS() {
  const toast = useToast();
  const confirmar = useConfirm();
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  // El modo del SOS viene de una configuracion EXPLICITA del servidor (SOS_MODO_DEMO), separada de
  // las cuentas de demostracion. En "demo" el SOS avisa pero no marca numeros reales; en "real" si.
  const [modo, setModo] = useState<ModoSos>("indeterminado");

  useEffect(() => {
    api
      .get<{ sosModoDemo?: boolean }>("/config")
      .then((r) => setModo(r.data.sosModoDemo ? "demo" : "real"))
      .catch(() => setModo("indeterminado")); // sigue indeterminado: se pedira confirmacion antes de llamar
  }, []);

  // Dispara el aviso interno y abre la llamada real de inmediato (la llamada es la prioridad, no se
  // demora esperando el aviso). No se afirma que el aviso llego: no esta confirmado.
  function llamarReal(tipo: TipoEmergenciaSos, numero: string) {
    enviarAlertaSos(tipo).catch(() => {});
    setAbierto(false);
    toast.info(`Abriendo la llamada de emergencia a ${numero}. También se está avisando a conserjería.`);
    window.location.href = `tel:${numero}`;
  }

  async function activar(tipo: TipoEmergenciaSos, numero: string) {
    // Modo demostracion: NUNCA llama a un numero real. Se espera la respuesta del servidor y se
    // muestra exito o error reales (no un "se aviso" optimista).
    if (modo === "demo") {
      setEnviando(true);
      try {
        await enviarAlertaSos(tipo);
        toast.success(
          "Modo demostración: el aviso se envió a conserjería y administración. No se llamó a ningún número real."
        );
        setAbierto(false);
      } catch {
        toast.error("Modo demostración: no se pudo enviar el aviso. Inténtalo nuevamente.");
      } finally {
        setEnviando(false);
      }
      return;
    }

    // Operacion real: siempre se puede llamar. El aviso interno es complemento.
    if (modo === "real") {
      llamarReal(tipo, numero);
      return;
    }

    // Modo indeterminado (no se pudo cargar la configuracion): evitar una llamada accidental; se pide
    // confirmacion explicita antes de abrir un numero real.
    const ok = await confirmar(
      `No se pudo determinar el modo de la aplicación (demostración o real). ¿Quieres llamar al número de emergencia real ${numero}? El aviso a conserjería se enviará igual.`,
      {
        titulo: "Confirmar llamada de emergencia",
        textoConfirmar: `Llamar ${numero}`,
        textoCancelar: "Cancelar",
      }
    );
    if (!ok) {
      setAbierto(false);
      return;
    }
    llamarReal(tipo, numero);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Emergencia SOS"
        className="fixed bottom-6 right-6 z-30 flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-white shadow-lg shadow-red-600/40 transition-transform active:scale-95"
      >
        <span className="absolute inset-0 animate-ping rounded-full bg-red-600 opacity-75" />
        <Siren size={28} weight="fill" className="relative" />
      </button>

      <Modal open={abierto} onClose={() => setAbierto(false)} title="Emergencia">
        <div className="space-y-4">
          {modo === "demo" ? (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
              <strong>Modo demostración.</strong> Se avisará a conserjería y administración, pero{" "}
              <strong>no se llamará</strong> a ningún número de emergencia real.
            </p>
          ) : modo === "indeterminado" ? (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
              No se pudo determinar el modo de la aplicación. Antes de abrir un número real se te pedirá
              confirmación.
            </p>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Elige el tipo de emergencia. Esto abrirá la llamada real desde tu celular — úsalo solo si es una
              emergencia de verdad.
            </p>
          )}

          <div className="space-y-3">
            {OPCIONES.map((op) => (
              <button
                key={op.tipo}
                type="button"
                disabled={enviando}
                onClick={() => activar(op.tipo, op.numero)}
                className={`flex min-h-[64px] w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left shadow-sm transition-colors disabled:opacity-60 ${op.clases} ${op.textoClases}`}
              >
                <span className="text-lg font-bold">{op.titulo}</span>
                <span className="text-3xl font-bold">{op.numero}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <X size={16} />
            Cancelar
          </button>
        </div>
      </Modal>
    </>
  );
}
