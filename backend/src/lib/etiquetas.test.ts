import { EstadoIncidencia, EstadoMulta } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { ESTADO_INCIDENCIA_LABEL, ESTADO_MULTA_LABEL } from "./etiquetas";

describe("etiquetas de estado", () => {
  it("hay un nombre legible para cada estado de incidencia y de multa", () => {
    for (const estado of Object.values(EstadoIncidencia)) expect(ESTADO_INCIDENCIA_LABEL[estado]).toBeTruthy();
    for (const estado of Object.values(EstadoMulta)) expect(ESTADO_MULTA_LABEL[estado]).toBeTruthy();
  });

  it("ningun nombre legible es el valor crudo del enum", () => {
    for (const [clave, texto] of [...Object.entries(ESTADO_INCIDENCIA_LABEL), ...Object.entries(ESTADO_MULTA_LABEL)]) {
      expect(texto).not.toBe(clave);
      expect(texto).not.toMatch(/_/);
    }
  });
});
