import { useEffect, useRef } from "react";

// Devuelve un ref para el elemento recien agregado a una lista: si la lista queda fuera de la pantalla
// (con una sola columna, el formulario esta arriba y la lista abajo) lo acerca con un desplazamiento
// suave, instantaneo con "reducir movimiento". Solo actua bajo `anchoMaximo` px de ancho.
export function useAcercarAlAparecer<T extends HTMLElement>(activo: boolean, anchoMaximo: number) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!activo || !window.matchMedia(`(max-width: ${anchoMaximo}px)`).matches) return;
    const reducir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView({ behavior: reducir ? "auto" : "smooth", block: "nearest" });
  }, [activo, anchoMaximo]);
  return ref;
}
