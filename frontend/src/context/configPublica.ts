import { createContext, useContext } from "react";

// Configuracion publica del servidor (GET /api/config): lo que la app necesita saber antes o
// independientemente de la sesion. La decide SIEMPRE el servidor; el cliente solo la lee.
export interface ConfigPublica {
  // Mostrar los botones de "entrar con una cuenta de demostracion" en el login.
  cuentasDemo: boolean;
  // Modo demostracion del boton SOS: avisa a conserjeria/administracion pero NO llama a numeros
  // reales. Es independiente de cuentasDemo a proposito (ver backend/src/config/env.ts).
  sosModoDemo: boolean;
}

// "cargando": todavia no respondio. "error": no se pudo obtener (red caida, servidor iniciando).
// Quien dependa de un valor para una accion delicada (el SOS) debe tratar "cargando" y "error" como
// desconocido, nunca asumir un valor por defecto.
export type EstadoConfigPublica =
  | { estado: "cargando"; config: null }
  | { estado: "ok"; config: ConfigPublica }
  | { estado: "error"; config: null };

export const ConfigPublicaContext = createContext<EstadoConfigPublica>({ estado: "cargando", config: null });

export function useConfigPublica(): EstadoConfigPublica {
  return useContext(ConfigPublicaContext);
}
