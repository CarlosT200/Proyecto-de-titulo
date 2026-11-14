import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// Se simulan el entorno (para que el módulo quede "habilitado" con claves VAPID), web-push y la base.
vi.mock("../../config/env", () => ({
  env: { vapidPublicKey: "pub", vapidPrivateKey: "priv", vapidSubject: "mailto:soporte@habitasmart.cl" },
}));
vi.mock("web-push", () => ({
  default: { setVapidDetails: vi.fn(), sendNotification: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock("../../lib/prisma", () => ({
  prisma: { pushSubscription: { findMany: vi.fn(), deleteMany: vi.fn() } },
}));

import webpush from "web-push";
import { prisma } from "../../lib/prisma";
import { enviarPushAUsuarios } from "./push.service";

const sendNotification = (webpush as unknown as { sendNotification: Mock }).sendNotification;
const findMany = prisma.pushSubscription.findMany as unknown as Mock;

beforeEach(() => vi.clearAllMocks());

describe("enviarPushAUsuarios", () => {
  it("envía el push de una emergencia con urgencia alta (entrega inmediata)", async () => {
    findMany.mockResolvedValue([{ id: "s1", endpoint: "https://push/1", p256dh: "k", auth: "a" }]);

    await enviarPushAUsuarios(["u1"], { titulo: "T", mensaje: "M" }, { urgencia: "high" });

    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: "https://push/1" }),
      expect.any(String),
      expect.objectContaining({ urgency: "high" })
    );
  });

  it("usa urgencia normal por defecto", async () => {
    findMany.mockResolvedValue([{ id: "s1", endpoint: "https://push/1", p256dh: "k", auth: "a" }]);

    await enviarPushAUsuarios(["u1"], { titulo: "T", mensaje: "M" });

    expect(sendNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      expect.objectContaining({ urgency: "normal" })
    );
  });

  it("no lanza si falla leer las suscripciones (el push es complementario, no el único canal)", async () => {
    findMany.mockRejectedValue(new Error("base de datos no disponible"));

    await expect(enviarPushAUsuarios(["u1"], { titulo: "T", mensaje: "M" })).resolves.toBeUndefined();
  });
});
