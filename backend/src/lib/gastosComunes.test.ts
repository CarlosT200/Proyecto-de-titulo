import { describe, expect, it } from "vitest";
import { estadoCobro, fechaLarga, hoyEnChile, nombrePeriodo, nombreUnidad, pesos, recargoFondoReserva, repartirMonto } from "./gastosComunes";

const sumar = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("repartirMonto", () => {
  it("reparte en partes iguales y la suma calza exacto con el total", () => {
    const montos = repartirMonto(1_000_000, [1, 1, 1]);
    expect(sumar(montos)).toBe(1_000_000);
    expect(Math.max(...montos) - Math.min(...montos)).toBeLessThanOrEqual(1);
    expect(montos).toEqual([333_334, 333_333, 333_333]);
  });

  it("reparte según alícuota", () => {
    expect(repartirMonto(2_000_000, [50, 30, 20])).toEqual([1_000_000, 600_000, 400_000]);
  });

  it("con alícuotas con decimales, el redondeo nunca deja pesos sin cobrar ni de más", () => {
    const alicuotas = [12.3456, 7.6544, 33.3333, 33.3333, 13.3334];
    for (const total of [1, 999, 1_234_567, 987_654_321]) {
      const montos = repartirMonto(total, alicuotas);
      expect(sumar(montos)).toBe(total);
      montos.forEach((m, i) => expect(Math.abs(m - (total * alicuotas[i]) / 100)).toBeLessThan(1));
    }
  });

  it("una sola unidad paga todo, y sin unidades no hay cobros", () => {
    expect(repartirMonto(45_990, [1])).toEqual([45_990]);
    expect(repartirMonto(45_990, [])).toEqual([]);
  });

  it("rechaza pesos que suman cero", () => {
    expect(() => repartirMonto(100, [0, 0])).toThrow();
  });
});

describe("recargoFondoReserva", () => {
  it("aplica el porcentaje y redondea al peso", () => {
    expect(recargoFondoReserva(100_000, 5)).toBe(5_000);
    expect(recargoFondoReserva(33_333, 5)).toBe(1_667);
    expect(recargoFondoReserva(33_333, 0)).toBe(0);
  });
});

describe("estadoCobro", () => {
  const vence = new Date("2026-10-10T00:00:00.000Z");

  it("el día del vencimiento todavía está pendiente; al día siguiente, vencido", () => {
    expect(estadoCobro(false, vence, new Date("2026-10-10T00:00:00.000Z"))).toBe("PENDIENTE");
    expect(estadoCobro(false, vence, new Date("2026-10-11T00:00:00.000Z"))).toBe("VENCIDO");
  });

  it("pagado manda sobre la fecha", () => {
    expect(estadoCobro(true, vence, new Date("2026-12-01T00:00:00.000Z"))).toBe("PAGADO");
  });
});

describe("hoyEnChile", () => {
  it("a las 23:30 de Chile sigue siendo el mismo día aunque en UTC ya sea mañana", () => {
    // 10 de octubre 23:30 en Chile (UTC-3) = 11 de octubre 02:30 UTC
    expect(hoyEnChile(new Date("2026-10-11T02:30:00.000Z"))).toEqual(new Date("2026-10-10T00:00:00.000Z"));
  });
});

describe("textos", () => {
  it("nombra el periodo, la fecha, la unidad y el monto en español", () => {
    expect(nombrePeriodo(2026, 10)).toBe("octubre de 2026");
    expect(fechaLarga(new Date("2026-11-10T00:00:00.000Z"))).toBe("10 de noviembre");
    expect(nombreUnidad({ numero: "101", torre: { nombre: "Torre A" } })).toBe("Torre A 101");
    expect(nombreUnidad({ numero: "12", torre: null })).toBe("12");
    expect(pesos(1_234_567)).toBe("$1.234.567");
  });
});
