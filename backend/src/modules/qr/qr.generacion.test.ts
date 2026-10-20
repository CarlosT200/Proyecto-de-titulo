import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { EstadoVisita } from "@prisma/client";

vi.mock("../../lib/prisma", () => ({
  prisma: {
    qrToken: { create: vi.fn(), updateMany: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    visita: { findFirst: vi.fn() },
  },
}));

import { prisma } from "../../lib/prisma";
import { esCodigoManual, esTokenCorto } from "../../lib/qrToken";
import { generarQrResidente, generarQrVisita } from "./qr.service";

const crear = prisma.qrToken.create as unknown as Mock;
const revocarTodos = prisma.qrToken.updateMany as unknown as Mock;
const buscarVisita = prisma.visita.findFirst as unknown as Mock;
const buscarToken = prisma.qrToken.findUnique as unknown as Mock;

beforeEach(() => {
  vi.clearAllMocks();
  revocarTodos.mockResolvedValue({ count: 0 });
  crear.mockResolvedValue({});
  // El codigo manual se confirma unico consultando la base: null = libre.
  buscarToken.mockResolvedValue(null);
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
    // codigo corto y opaco: el QR queda pequeno y legible para la camara de un celular
    expect(esTokenCorto(data.token)).toBe(true);
    expect(data.token).not.toContain(data.id);
    // Codigo corto y legible para la validacion manual en porteria.
    expect(esCodigoManual(data.codigoManual)).toBe(true);
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
    expect(esTokenCorto(data.token)).toBe(true);
  });
});
