import { useEffect, useRef, useState } from "react";
import { Siren, X } from "@phosphor-icons/react";
import { Modal } from "./ui";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import { useConfigPublica } from "../context/configPublica";
import { abrirLlamada, BLOQUEO_TRAS_LLAMADA_MS, enviarAlertaSos, OPCIONES_SOS } from "../lib/sos";
import type { TipoEmergenciaSos } from "../types";

// Boton SOS para residentes: siempre visible (flotante), pensado para una emergencia real -- nunca
// debe quedar escondido en un menu. Los numeros, el envio del aviso y la apertura de la llamada
// viven en lib/sos.ts; aqui solo esta la decision de QUE hacer segun el modo.
//
// "indeterminado" mientras no se sepa el modo (la configuracion no cargo o fallo): en ese estado NO
// se abre una llamada real sin confirmar, para evitar una llamada accidental.
type ModoSos = "indeterminado" | "demo" | "real";

export function BotonSOS() {
  const toast = useToast();
  const confirmar = useConfirm();
  const configPublica = useConfigPublica();
  const [abierto, setAbierto] = useState(false);
  // Que boton esta en curso (muestra el progreso en ese boton y bloquea los demas).
  const [enCurso, setEnCurso] = useState<TipoEmergenciaSos | null>(null);
  // Bloqueo breve despues de abrir una llamada real (ver BLOQUEO_TRAS_LLAMADA_MS).
  const [bloqueado, setBloqueado] = useState(false);
  // Candado sincronico: dos clics en el mismo instante no alcanzan a ver el estado actualizado,
  // asi que el segundo se descarta aqui antes de hacer nada.
  const ocupadoRef = useRef(false);
  const temporizadorRef = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(temporizadorRef.current), []);

  // El modo del SOS viene de una configuracion EXPLICITA del servidor (SOS_MODO_DEMO), separada de
  // las cuentas de demostracion. En "demo" el SOS avisa pero no marca numeros reales; en "real" si.
  const modo: ModoSos =
    configPublica.estado === "ok" ? (configPublica.config.sosModoDemo ? "demo" : "real") : "indeterminado";

  function liberar() {
    ocupadoRef.current = false;
    setEnCurso(null);
  }

  // Dispara el aviso interno y abre la llamada real de inmediato (la llamada es la prioridad, no se
  // demora esperando el aviso). No se afirma que el aviso llego: no esta confirmado. Los botones
  // quedan bloqueados unos segundos para que un segundo toque no abra otra llamada.
  function llamarReal(tipo: TipoEmergenciaSos, numero: string) {
    enviarAlertaSos(tipo).catch(() => {});
    setBloqueado(true);
    temporizadorRef.current = window.setTimeout(() => {
      setBloqueado(false);
      liberar();
    }, BLOQUEO_TRAS_LLAMADA_MS);
    setAbierto(false);
    toast.info(`Abriendo la llamada de emergencia a ${numero}. También se está avisando a conserjería.`);
    abrirLlamada(numero);
  }

  async function activar(tipo: TipoEmergenciaSos, numero: string) {
    if (ocupadoRef.current || bloqueado) return;
    ocupadoRef.current = true;
    setEnCurso(tipo);

    // Modo demostracion: NUNCA llama a un numero real. Se espera la respuesta del servidor y se
    // muestra exito o error reales (no un "se aviso" optimista).
    if (modo === "demo") {
      try {
        await enviarAlertaSos(tipo);
        toast.success(
          "Modo demostración: el aviso se envió a conserjería y administración. No se llamó a ningún número real."
        );
        setAbierto(false);
      } catch {
        toast.error("Modo demostración: no se pudo enviar el aviso. Inténtalo nuevamente.");
      } finally {
        liberar();
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
      liberar();
      setAbierto(false);
      return;
    }
    llamarReal(tipo, numero);
  }

  const deshabilitado = enCurso !== null || bloqueado;

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
            <p
              data-testid="sos-aviso-modo"
              className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200"
            >
              <strong>Modo demostración.</strong> Se avisará a conserjería y administración, pero{" "}
              <strong>no se llamará</strong> a ningún número de emergencia real.
            </p>
          ) : modo === "indeterminado" ? (
            <p
              data-testid="sos-aviso-modo"
              className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200"
            >
              No se pudo determinar el modo de la aplicación. Antes de abrir un número real se te pedirá
              confirmación.
            </p>
          ) : (
            <p data-testid="sos-aviso-modo" className="text-sm text-slate-600 dark:text-slate-300">
              Elige el tipo de emergencia. Esto abrirá la llamada real desde tu celular — úsalo solo si es una
              emergencia de verdad. El aviso a conserjería se envía en paralelo, como apoyo.
            </p>
          )}

          <div className="space-y-3">
            {OPCIONES_SOS.map((op) => {
              const esteEnCurso = enCurso === op.tipo;
              return (
                <button
                  key={op.tipo}
                  type="button"
                  disabled={deshabilitado}
                  aria-busy={esteEnCurso}
                  onClick={() => activar(op.tipo, op.numero)}
                  className={`flex min-h-[64px] w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left shadow-sm transition-colors disabled:opacity-60 ${op.clases} ${op.textoClases}`}
                >
                  <span className="text-lg font-bold">{op.titulo}</span>
                  {esteEnCurso ? (
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <span
                        aria-hidden
                        className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                      />
                      {modo === "demo" ? "Enviando aviso…" : "Abriendo llamada…"}
                    </span>
                  ) : (
                    <span className="text-3xl font-bold">{op.numero}</span>
                  )}
                </button>
              );
            })}
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
