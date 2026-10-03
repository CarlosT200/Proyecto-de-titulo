import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import {
  describirModelos,
  FORMATO_RESPALDO,
  ordenarPorDependencias,
  reconstruirFila,
  validarArchivo,
} from "./respaldo";

// RNF-12: si el orden de restauracion o la conversion de fechas falla, el respaldo no se puede
// volver a cargar justo cuando mas se necesita.
describe("respaldo", () => {
  const modelos = describirModelos();

  it("incluye todas las tablas del esquema, sin escribirlas a mano", () => {
    const nombres = modelos.map((m) => m.nombre);
    for (const esperado of ["Condominio", "Usuario", "Reserva", "Multa", "Comunicado", "Documento", "AccesoLog", "Auditoria"]) {
      expect(nombres).toContain(esperado);
    }
    expect(new Set(nombres).size).toBe(nombres.length);
  });

  it("ordena las tablas de modo que cada una llega despues de las que referencia", () => {
    const orden = ordenarPorDependencias(modelos);
    expect(orden).toHaveLength(modelos.length);
    const posicion = new Map(orden.map((m, i) => [m.nombre, i]));
    for (const m of orden) {
      for (const dependencia of m.dependencias) {
        expect(posicion.get(dependencia)!).toBeLessThan(posicion.get(m.nombre)!);
      }
    }
    expect(posicion.get("Condominio")!).toBeLessThan(posicion.get("Usuario")!);
    expect(posicion.get("Visita")!).toBeLessThan(posicion.get("QrToken")!);
    expect(posicion.get("QrToken")!).toBeLessThan(posicion.get("AccesoLog")!);
  });

  it("detecta dependencias circulares en vez de quedarse en un ciclo infinito", () => {
    const base = { delegado: "x", camposFecha: [], camposJson: [] };
    expect(() =>
      ordenarPorDependencias([
        { ...base, nombre: "A", dependencias: ["B"] },
        { ...base, nombre: "B", dependencias: ["A"] },
      ])
    ).toThrow(/circulares/);
  });

  it("al restaurar vuelve a convertir en fechas los textos ISO y respeta los Json nulos", () => {
    const fila = reconstruirFila(
      { id: "1", createdAt: "2026-10-03T17:00:00.000Z", sugerenciaIA: null, titulo: "2026-10-03" },
      { camposFecha: ["createdAt"], camposJson: ["sugerenciaIA"] }
    );
    expect(fila.createdAt).toEqual(new Date("2026-10-03T17:00:00.000Z"));
    expect(fila.sugerenciaIA).toBe(Prisma.DbNull);
    // un texto que parece fecha pero no es un campo de fecha no se toca
    expect(fila.titulo).toBe("2026-10-03");
  });

  it("rechaza archivos que no son un respaldo o que estan incompletos", () => {
    expect(() => validarArchivo({ hola: 1 })).toThrow(/no es un respaldo/);
    expect(() =>
      validarArchivo({ formato: FORMATO_RESPALDO, creadoEn: "x", conteos: { Usuario: 2 }, tablas: { Usuario: [{}] } })
    ).toThrow(/dañado o incompleto/);
    expect(
      validarArchivo({ formato: FORMATO_RESPALDO, creadoEn: "x", conteos: { Usuario: 1 }, tablas: { Usuario: [{}] } }).conteos
    ).toEqual({ Usuario: 1 });
  });
});
