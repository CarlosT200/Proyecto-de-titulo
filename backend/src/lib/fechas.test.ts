import { describe, expect, it } from "vitest";
import { ahoraEnChile, esFechaCalendario, fechaCalendario } from "./fechas";

describe("esFechaCalendario", () => {
  it("acepta fechas reales, incluido el 29 de febrero de un año bisiesto", () => {
    expect(esFechaCalendario("2026-10-03")).toBe(true);
    expect(esFechaCalendario("2028-02-29")).toBe(true);
  });

  it("rechaza días que no existen aunque tengan la forma correcta", () => {
    expect(esFechaCalendario("2027-02-31")).toBe(false);
    expect(esFechaCalendario("2027-02-29")).toBe(false);
    expect(esFechaCalendario("2026-13-01")).toBe(false);
    expect(esFechaCalendario("2026-00-10")).toBe(false);
  });

  it("rechaza formatos distintos de YYYY-MM-DD", () => {
    expect(esFechaCalendario("03-10-2026")).toBe(false);
    expect(esFechaCalendario("2026-10-3")).toBe(false);
    expect(esFechaCalendario("")).toBe(false);
  });
});

describe("fechaCalendario (zod)", () => {
  it("entrega un mensaje distinto segun si falla la forma o el calendario", () => {
    const forma = fechaCalendario.safeParse("hoy");
    const calendario = fechaCalendario.safeParse("2027-02-31");
    expect(forma.success).toBe(false);
    expect(calendario.success).toBe(false);
    if (!forma.success) expect(forma.error.issues[0].message).toMatch(/Formato de fecha/);
    if (!calendario.success) expect(calendario.error.issues[0].message).toMatch(/no existe/);
  });
});

describe("ahoraEnChile", () => {
  it("usa el día de Chile y no el de UTC cuando difieren", () => {
    // 2026-10-04 01:30 UTC = 2026-10-03 22:30 en Chile (UTC-3, horario de verano)
    const resultado = ahoraEnChile(new Date("2026-10-04T01:30:00.000Z"));
    expect(resultado).toEqual({ fecha: "2026-10-03", hora: "22:30" });
  });

  it("respeta el horario de invierno (UTC-4)", () => {
    // 2026-07-15 02:15 UTC = 2026-07-14 22:15 en Chile
    expect(ahoraEnChile(new Date("2026-07-15T02:15:00.000Z"))).toEqual({ fecha: "2026-07-14", hora: "22:15" });
  });

  it("devuelve la hora en formato de 24 horas con ceros a la izquierda", () => {
    expect(ahoraEnChile(new Date("2026-10-03T12:05:00.000Z")).hora).toBe("09:05");
  });
});
