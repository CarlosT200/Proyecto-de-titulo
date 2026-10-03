import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import multer from "multer";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { errorHandler } from "./errorHandler";
import { NotFoundError } from "../lib/errors";

function responder(err: unknown) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  errorHandler(err, {} as Request, res as unknown as Response, vi.fn());
  return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
}

describe("errorHandler", () => {
  it("devuelve 422 con detalle por campo para errores de validación", () => {
    const resultado = z.object({ email: z.string().email("Correo inválido.") }).safeParse({ email: "x" });
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

  it("nunca filtra el detalle interno de un error desconocido", () => {
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});
    const { status, body } = responder(new Error("connection string postgres://usuario:clave@host"));
    expect(status).toBe(500);
    expect(body.error).not.toMatch(/postgres|clave/);
    consola.mockRestore();
  });
});
