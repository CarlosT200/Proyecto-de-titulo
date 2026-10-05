import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

// Filtro de una lista guardado en la direccion (ej. /incidencias?estado=REPORTADA). Asi los paneles
// pueden enlazar a una lista ya filtrada, y el filtro sobrevive a recargar la pagina. Un valor que
// no esta en la lista permitida se ignora (no deja la lista vacia por un enlace viejo).
export function useFiltroUrl<T extends string>(nombre: string, permitidos: readonly T[]): [T | "", (valor: T | "") => void] {
  const [params, setParams] = useSearchParams();
  const crudo = params.get(nombre) ?? "";
  const valor = (permitidos as readonly string[]).includes(crudo) ? (crudo as T) : "";

  const cambiar = useCallback(
    (nuevo: T | "") => {
      setParams(
        (actuales) => {
          const siguientes = new URLSearchParams(actuales);
          if (nuevo) siguientes.set(nombre, nuevo);
          else siguientes.delete(nombre);
          return siguientes;
        },
        { replace: true }
      );
    },
    [nombre, setParams]
  );

  return [valor, cambiar];
}
