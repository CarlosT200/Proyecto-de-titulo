import { CABECERA_CSRF, tokenCsrf } from "../api/client";
import type { TipoEmergenciaSos } from "../types";

// Numeros de emergencia de Chile. Operacion real: el telefono del residente llama de verdad a este
// numero via "tel:"; en paralelo se avisa a conserjeria/administracion para que puedan asistir
// (abrir reja, guiar a la ambulancia, etc.). Ese aviso interno es un complemento de mejor esfuerzo:
// NUNCA reemplaza ni condiciona la llamada real.
export const OPCIONES_SOS: {
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

// Tiempo durante el cual los botones quedan bloqueados despues de abrir una llamada real: evita
// que un segundo toque (nervios, rebote de la pantalla) abra dos veces el marcador o mande dos avisos.
export const BLOQUEO_TRAS_LLAMADA_MS = 4000;

// Envia el aviso de SOS. Se usa fetch con keepalive (no axios) porque, en operacion real, justo
// despues la pagina navega a "tel:...": keepalive MEJORA la probabilidad de que la peticion se
// complete aunque la pagina se descargue, pero NO la garantiza (puede fallar por red, tamano, etc.).
// Por eso nunca se afirma que el aviso "llego" sin confirmacion del servidor. Lanza si el servidor no
// responde 2xx, para poder distinguir exito de error cuando si se espera la respuesta (modo demo).
export async function enviarAlertaSos(tipo: TipoEmergenciaSos): Promise<void> {
  // La sesion va en la cookie HttpOnly (misma origen); el token anti-CSRF, en la cabecera.
  const csrf = tokenCsrf();
  const res = await fetch("/api/sos", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(csrf ? { [CABECERA_CSRF]: csrf } : {}),
    },
    body: JSON.stringify({ tipo }),
    keepalive: true,
  });
  if (!res.ok) throw new Error("No se pudo enviar la alerta.");
}

// Abre el marcador del telefono con el numero de emergencia. Es la UNICA funcion de la app que
// navega a un enlace "tel:"; esta separada para poder reemplazarla en las pruebas y comprobar que
// en modo demostracion nunca se llama.
export function abrirLlamada(numero: string): void {
  window.location.assign(`tel:${numero}`);
}
