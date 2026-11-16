import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import multer from "multer";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { errorHandler } from "./errorHandler";
import { NotFoundError } from "../lib/errors";

function responder(err: unknown) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  errorHandler(err, { requestId: "req-123", originalUrl: "/api/x?token=1" } as unknown as Request, res as unknown as Response, vi.fn());
  return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
}

describe("errorHandler", () => {
  it("devuelve 422 con detalle por campo para errores de validación", () => {
    const resultado = z.object({ email: z.email("Correo inválido.") }).safeParse({ email: "x" });
    const { status, body } = responder(resultado.error);
    expect(status).toBe(422);
    expect(body.detalles).toEqual([{ campo: "email", mensaje: "Correo inválido." }]);
  });

  it("respeta el status de los errores de negocio (AppError)", () => {
    const { status, body } = responder(new NotFoundError("Multa no encontrada."));
    expect(status).toBe(404);
    expect(body.error).toBe("Multa no encontrada.");
  });

  it("explica que el archivo es muy grande en vez de un error generico", () => {
    const { status, body } = responder(new multer.MulterError("LIMIT_FILE_SIZE"));
    expect(status).toBe(413);
    expect(body.error).toMatch(/8 MB/);
  });

  it("traduce un registro duplicado de Prisma a 409", () => {
    const err = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "test",
    });
    const { status } = responder(err);
    expect(status).toBe(409);
  });

  it("devuelve 400 si el cuerpo JSON viene mal formado", () => {
    const { status } = responder(Object.assign(new SyntaxError("Unexpected token"), { type: "entity.parse.failed" }));
    expect(status).toBe(400);
  });

  it("nunca filtra el detalle interno de un error desconocido y entrega el código de referencia", () => {
    vi.stubEnv("LOG_LEVEL", "error");
    const salida = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const { status, body } = responder(new Error("connection string postgres://usuario:clave@host"));
    expect(status).toBe(500);
    expect(JSON.stringify(body)).not.toMatch(/postgres|clave|stack/);
    expect(body.referencia).toBe("req-123");
    // y el log tampoco muestra la contraseña de la base
    const escrito = salida.mock.calls.map((c) => String(c[0])).join("");
    expect(escrito).toContain("error no controlado");
    expect(escrito).not.toContain("clave@");
    salida.mockRestore();
    vi.unstubAllEnvs();
  });

  it("si la base de datos no responde, devuelve 503 (se puede reintentar)", () => {
    const salida = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const err = new Prisma.PrismaClientKnownRequestError("Can't reach database server", { code: "P1001", clientVersion: "test" });
    const { status, body } = responder(err);
    expect(status).toBe(503);
    expect(body.error).toMatch(/no está disponible/);
    salida.mockRestore();
  });
});
