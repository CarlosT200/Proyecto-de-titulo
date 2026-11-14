import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { clavePorConserje } from "./qr.routes";

// El límite de validación de QR debe contarse por conserje y no por IP: en una portería varios
// dispositivos comparten la misma red, así que contar por IP castigaría a un conserje por los
// intentos de otro (o de un residente en la misma WiFi).
describe("clave del límite de validación de QR", () => {
  it("usa el id del conserje cuando hay sesión", () => {
    const req = { auth: { sub: "conserje-1" }, ip: "10.0.0.5" } as unknown as Request;
    expect(clavePorConserje(req)).toBe("conserje-1");
  });

  it("cae a la IP si por algún motivo no hay sesión", () => {
    const req = { ip: "10.0.0.5" } as unknown as Request;
    expect(clavePorConserje(req)).toBe("10.0.0.5");
  });
});
