import { describe, expect, it } from "vitest";
import { CATEGORIAS_INCIDENCIA, etiquetaCategoria, normalizarCategoria } from "./categorias";

describe("categorías de incidencias", () => {
  it("los códigos y las etiquetas no se repiten", () => {
    const codigos = CATEGORIAS_INCIDENCIA.map((c) => c.codigo);
    const etiquetas = CATEGORIAS_INCIDENCIA.map((c) => c.etiqueta);
    expect(new Set(codigos).size).toBe(codigos.length);
    expect(new Set(etiquetas).size).toBe(etiquetas.length);
    expect(codigos).toContain("OTROS");
  });

  it("reconoce el código, la etiqueta y los nombres antiguos sin importar tildes ni mayúsculas", () => {
    expect(normalizarCategoria("AGUA")).toBe("AGUA");
    expect(normalizarCategoria("Agua y filtraciones")).toBe("AGUA");
    expect(normalizarCategoria("Filtración")).toBe("AGUA");
    expect(normalizarCategoria("filtracion")).toBe("AGUA");
    expect(normalizarCategoria("Eléctrico")).toBe("ELECTRICIDAD");
    expect(normalizarCategoria("Estructural")).toBe("INFRAESTRUCTURA");
    expect(normalizarCategoria("Otro")).toBe("OTROS");
  });

  it("un texto desconocido no se inventa una categoría", () => {
    expect(normalizarCategoria("Gasfitería")).toBeNull();
    expect(normalizarCategoria("")).toBeNull();
    expect(normalizarCategoria(null)).toBeNull();
  });

  it("la etiqueta de un valor desconocido es el mismo texto (no se pierde información)", () => {
    expect(etiquetaCategoria("AREAS_VERDES")).toBe("Áreas verdes");
    expect(etiquetaCategoria("Filtración")).toBe("Agua y filtraciones");
    expect(etiquetaCategoria("Gasfitería")).toBe("Gasfitería");
    expect(etiquetaCategoria(null)).toBeNull();
  });
});
