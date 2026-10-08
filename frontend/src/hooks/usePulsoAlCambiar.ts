import { useEffect, useRef, useState } from "react";

// Cuenta las veces que cambio un valor despues del primer pintado. Sirve para reproducir un
// destello solo cuando algo cambia (con la actualizacion automatica o al cambiar un estado), y no
// al cargar la pagina: en el primer pintado vale 0.
export function usePulsoAlCambiar(valor: string | number): number {
  const previo = useRef(valor);
  const [pulso, setPulso] = useState(0);
  useEffect(() => {
    if (previo.current !== valor) {
      previo.current = valor;
      setPulso((p) => p + 1);
    }
  }, [valor]);
  return pulso;
}
