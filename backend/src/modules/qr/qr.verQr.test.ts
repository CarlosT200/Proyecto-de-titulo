import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { EstadoVisita } from "@prisma/client";

vi.mock("../../lib/prisma", () => ({
  prisma: { visita: { findFirst: vi.fn() } },
}));

import { prisma } from "../../lib/prisma";
import { verQrVisita } from "./qr.service";
import { ConflictError, NotFoundError } from "../../lib/errors";

const findFirst = prisma.visita.findFirst as unknown as Mock;
const enUnaHora = () => new Date(Date.now() + 3600_000);

function visita(cambios: Record<string, unknown> = {}, token: Record<string, unknown> | null = {}) {
  return {
    id: "v-1",
    estado: EstadoVisita.VIGENTE,
    periodoFin: enUnaHora(),
    qrToken: token === null ? null : { token: "AbCdEfGhIjKlMnOpQrStUv", revocado: false, ...token },
    ...cambios,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("verQrVisita (volver a mostrar el QR sin crear uno nuevo)", () => {
  it("devuelve la imagen del mismo codigo de una visita vigente", async () => {
    findFirst.mockResolvedValue(visita());
    const r = await verQrVisita("condo-1", "res-1", "v-1");
    expect(r.qrDataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "v-1", condominioId: "condo-1", residenteId: "res-1" } }));
  });

  it("no muestra visitas de otro residente ni sin codigo", async () => {
    findFirst.mockResolvedValue(null);
    await expect(verQrVisita("condo-1", "res-1", "v-1")).rejects.toBeInstanceOf(NotFoundError);
    findFirst.mockResolvedValue(visita({}, null));
    await expect(verQrVisita("condo-1", "res-1", "v-1")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("no muestra un codigo revocado, usado o vencido", async () => {
    findFirst.mockResolvedValue(visita({}, { revocado: true }));
    await expect(verQrVisita("condo-1", "res-1", "v-1")).rejects.toBeInstanceOf(ConflictError);
    findFirst.mockResolvedValue(visita({ estado: EstadoVisita.USADA }));
    await expect(verQrVisita("condo-1", "res-1", "v-1")).rejects.toBeInstanceOf(ConflictError);
    findFirst.mockResolvedValue(visita({ periodoFin: new Date(Date.now() - 1000) }));
    await expect(verQrVisita("condo-1", "res-1", "v-1")).rejects.toBeInstanceOf(ConflictError);
  });
});
