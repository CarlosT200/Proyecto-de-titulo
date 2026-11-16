import { ReactNode, useEffect, useState } from "react";
import { api } from "../api/client";
import { ConfigPublicaContext, type ConfigPublica, type EstadoConfigPublica } from "./configPublica";

// Reintentos con espera creciente: en Render el servidor gratuito puede tardar en despertar, y el
// SOS necesita saber el modo real antes de ofrecer una llamada sin confirmacion.
const ESPERAS_REINTENTO_MS = [2000, 5000, 10000];

// Carga /api/config una sola vez para toda la app (login, banner de demostracion y boton SOS
// comparten el mismo valor en vez de pedirlo cada uno por su cuenta).
export function ConfigPublicaProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoConfigPublica>({ estado: "cargando", config: null });

  useEffect(() => {
    let activo = true;
    let temporizador: number | undefined;

    async function cargar(intento: number) {
      try {
        const { data } = await api.get<Partial<ConfigPublica>>("/config");
        if (!activo) return;
        setEstado({
          estado: "ok",
          config: { cuentasDemo: data.cuentasDemo === true, sosModoDemo: data.sosModoDemo === true },
        });
      } catch {
        if (!activo) return;
        setEstado({ estado: "error", config: null });
        const espera = ESPERAS_REINTENTO_MS[intento];
        if (espera !== undefined) temporizador = window.setTimeout(() => cargar(intento + 1), espera);
      }
    }

    cargar(0);
    return () => {
      activo = false;
      if (temporizador !== undefined) window.clearTimeout(temporizador);
    };
  }, []);

  return <ConfigPublicaContext.Provider value={estado}>{children}</ConfigPublicaContext.Provider>;
}
