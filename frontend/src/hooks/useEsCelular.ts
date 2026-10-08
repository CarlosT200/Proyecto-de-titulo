import { useEffect, useState } from "react";

// true bajo 640 px (el punto "sm" de Tailwind). Sirve para textos que deben ser mas cortos en un
// celular, por ejemplo las opciones de un selector que comparte la fila con otro: un <option> no se
// puede ocultar con CSS por tamano de pantalla.
export function useEsCelular(): boolean {
  const consulta = "(max-width: 639px)";
  const [esCelular, setEsCelular] = useState(() => (typeof window === "undefined" ? false : window.matchMedia(consulta).matches));
  useEffect(() => {
    const m = window.matchMedia(consulta);
    const alCambiar = () => setEsCelular(m.matches);
    alCambiar();
    m.addEventListener("change", alCambiar);
    return () => m.removeEventListener("change", alCambiar);
  }, []);
  return esCelular;
}
