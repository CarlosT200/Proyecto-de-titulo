import { useEffect, useState } from "react";
import { Siren, X } from "@phosphor-icons/react";
import { Modal } from "./ui";
import { api, getToken } from "../api/client";
import { useToast } from "../context/ToastContext";
import type { TipoEmergenciaSos } from "../types";

// Boton SOS para residentes: siempre visible (flotante), pensado para una
// emergencia real -- nunca debe quedar escondido en un menu. Al elegir el
// tipo, el telefono del propio residente llama de verdad al numero de
// emergencia (Chile: 133/132/131) via "tel:"; en paralelo se avisa a
// conserjeria/administracion para que puedan asistir (abrir reja, guiar a
// la ambulancia, etc.) -- ese aviso interno es un plus, jamas un
// reemplazo de la llamada real, por eso nunca bloquea ni demora el tel:.
// Los colores siguen el codigo ya usado en las notificaciones de admin/
// conserje: Carabineros verde, Bomberos rojo, Ambulancia amarillo.
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

// Entrega garantizada del aviso de SOS. Se usa fetch con keepalive (no axios) porque justo despues
// la pagina navega a "tel:...": una peticion normal (XHR/fetch) puede cancelarse al cambiar de
// ubicacion y el aviso a conserjeria se perderia. Con keepalive el navegador termina de enviarla
// aunque la pagina se descargue. El cuerpo es minimo (muy por debajo del limite de 64 KB de keepalive).
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

export function BotonSOS() {
  const toast = useToast();
  const [abierto, setAbierto] = useState(false);
  // En entornos de demostracion/desarrollo (los mismos donde se muestran las cuentas demo) el SOS
  // NUNCA marca un numero real: solo envia el aviso interno. Asi se puede mostrar el flujo completo
  // en la defensa, y probar en desarrollo, sin llamar de verdad a Carabineros/Bomberos/SAMU. En
  // produccion (cuentasDemo = false) si abre la llamada real.
  const [modoDemo, setModoDemo] = useState(false);

  useEffect(() => {
    api
      .get<{ cuentasDemo: boolean }>("/config")
      .then((r) => setModoDemo(r.data.cuentasDemo))
      .catch(() => {});
  }, []);

  function activar(tipo: TipoEmergenciaSos, numero: string) {
    // El aviso interno se dispara primero y con entrega garantizada (keepalive); nunca bloquea ni
    // demora la llamada real.
    enviarAlertaSos(tipo).catch(() => {});
    setAbierto(false);

    if (modoDemo) {
      toast.info(
        "Modo demostración: se avisó a conserjería y administración, pero NO se llamó a ningún número de emergencia."
      );
      return;
    }

    toast.info("Se avisó a conserjería y administración.");
    window.location.href = `tel:${numero}`;
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
          {modoDemo ? (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
              <strong>Modo demostración.</strong> Se avisará a conserjería y administración, pero{" "}
              <strong>no se llamará</strong> a ningún número de emergencia real.
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
                onClick={() => activar(op.tipo, op.numero)}
                className={`flex min-h-[64px] w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left shadow-sm transition-colors ${op.clases} ${op.textoClases}`}
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
