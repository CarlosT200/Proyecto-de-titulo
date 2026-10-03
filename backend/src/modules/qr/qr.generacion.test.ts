import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { EstadoVisita } from "@prisma/client";

vi.mock("../../lib/prisma", () => ({
  prisma: {
    qrToken: { create: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    visita: { findFirst: vi.fn() },
  },
}));

import { prisma } from "../../lib/prisma";
import { verifyQrToken } from "../../lib/qrToken";
import { generarQrResidente, generarQrVisita } from "./qr.service";

const crear = prisma.qrToken.create as unknown as Mock;
const revocarTodos = prisma.qrToken.updateMany as unknown as Mock;
const buscarVisita = prisma.visita.findFirst as unknown as Mock;

beforeEach(() => {
  vi.clearAllMocks();
  revocarTodos.mockResolvedValue({ count: 0 });
  crear.mockResolvedValue({});
});

// La columna "token" es unica. Antes cada QR se creaba con token "" y despues se actualizaba: dos
// QR generados al mismo tiempo (aunque fueran de residentes distintos) chocaban en el "" y el
// segundo recibia un error 409.
describe("generacion de QR", () => {
  it("el QR del residente se crea de una vez con su token final (nunca con un token vacio)", async () => {
    await generarQrResidente("condo-1", "u-1");

    expect(crear).toHaveBeenCalledTimes(1);
    const { data } = crear.mock.calls[0][0];
    expect(data.token).toBeTruthy();
    expect(data.token).not.toBe("");
    // el token firmado lleva el mismo id con el que se guardo el registro
    expect(verifyQrToken(data.token).jti).toBe(data.id);
  });

  it("dos QR simultaneos reciben tokens distintos (no chocan en la columna unica)", async () => {
    await Promise.all([generarQrResidente("condo-1", "u-1"), generarQrResidente("condo-1", "u-2")]);

    const tokens = crear.mock.calls.map((llamada) => llamada[0].data.token);
    expect(new Set(tokens).size).toBe(2);
  });

  it("el QR de una visita tambien se crea con su token final", async () => {
    const periodoFin = new Date(Date.now() + 60_000);
    buscarVisita.mockResolvedValue({ id: "v-1", estado: EstadoVisita.VIGENTE, periodoFin, soloUnUso: true, qrToken: null });

    await generarQrVisita("condo-1", "u-1", "v-1");

    const { data } = crear.mock.calls[0][0];
    expect(data.token).not.toBe("");
    expect(data.usosMaximos).toBe(1);
    expect(verifyQrToken(data.token).jti).toBe(data.id);
  });
});
