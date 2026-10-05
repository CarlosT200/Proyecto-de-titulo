import { describe, expect, it } from "vitest";
import { ahoraEnChile, esFechaCalendario, fechaCalendario, horaEnChile, inicioDelDiaEnChile } from "./fechas";

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

describe("inicioDelDiaEnChile", () => {
  it("en horario de verano (UTC-3) el dia empieza a las 03:00 UTC", () => {
    expect(inicioDelDiaEnChile(new Date("2026-10-04T15:00:00.000Z")).toISOString()).toBe("2026-10-04T03:00:00.000Z");
  });

  it("a las 22:30 de Chile (ya es manana en UTC) sigue siendo el mismo dia de Chile", () => {
    // 2026-10-05 01:30 UTC = 2026-10-04 22:30 en Chile
    expect(inicioDelDiaEnChile(new Date("2026-10-05T01:30:00.000Z")).toISOString()).toBe("2026-10-04T03:00:00.000Z");
  });

  it("en horario de invierno (UTC-4) el dia empieza a las 04:00 UTC", () => {
    expect(inicioDelDiaEnChile(new Date("2026-07-15T12:00:00.000Z")).toISOString()).toBe("2026-07-15T04:00:00.000Z");
  });

  it("el instante calculado corresponde a las 00:00 en Chile", () => {
    const inicio = inicioDelDiaEnChile(new Date("2026-12-24T20:00:00.000Z"));
    expect(ahoraEnChile(inicio)).toEqual({ fecha: "2026-12-24", hora: "00:00" });
  });
});

describe("horaEnChile", () => {
  it("muestra la hora de Chile y no la del servidor", () => {
    expect(horaEnChile(new Date("2026-10-04T21:43:00.000Z"))).toBe("18:43");
  });
});
