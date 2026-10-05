import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { EstadoEncomienda, Rol } from "@prisma/client";

vi.mock("../../lib/prisma", () => ({
  prisma: {
    usuario: { findFirst: vi.fn() },
    encomienda: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  },
}));
vi.mock("../notificaciones/notificaciones.service", () => ({ crearNotificacion: vi.fn() }));

import { prisma } from "../../lib/prisma";
import { crearNotificacion } from "../notificaciones/notificaciones.service";
import {
  crearEncomienda,
  devolverEncomienda,
  entregarEncomienda,
  listarMisEncomiendas,
  obtenerEncomienda,
} from "./encomiendas.service";
import { ConflictError, ForbiddenError, NotFoundError } from "../../lib/errors";

const buscarUsuario = prisma.usuario.findFirst as unknown as Mock;
const crear = prisma.encomienda.create as unknown as Mock;
const buscar = prisma.encomienda.findFirst as unknown as Mock;
const listar = prisma.encomienda.findMany as unknown as Mock;
const actualizar = prisma.encomienda.updateMany as unknown as Mock;
const notificar = crearNotificacion as unknown as Mock;

const RESIDENTE = { id: "r-1", nombre: "Roberto", apellido: "Residente" };
const DETALLE = {
  id: "e-1",
  usuarioId: "r-1",
  remitente: "Starken",
  retiradaPor: "Roberto Residente",
  usuario: { ...RESIDENTE, departamento: null },
};

beforeEach(() => {
  vi.clearAllMocks();
  listar.mockResolvedValue([]);
});

describe("crearEncomienda", () => {
  it("guarda los datos nuevos y avisa al residente con la hora de Chile y el lugar", async () => {
    buscarUsuario.mockResolvedValue(RESIDENTE);
    crear.mockResolvedValue({ id: "e-1", fechaRecepcion: new Date("2026-10-04T21:43:00.000Z") });

    await crearEncomienda("condo-1", "conserje-1", {
      usuarioId: "r-1",
      remitente: "Starken",
      numeroSeguimiento: "ST-123",
      ubicacion: "Estante B",
      observaciones: "Caja grande",
      fotoUrl: "data:image/jpeg;base64,AAA",
    });

    expect(crear.mock.calls[0][0].data).toMatchObject({
      condominioId: "condo-1",
      registradaPorId: "conserje-1",
      numeroSeguimiento: "ST-123",
      ubicacion: "Estante B",
      observaciones: "Caja grande",
      estado: EstadoEncomienda.NOTIFICADA,
    });
    expect(notificar).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioId: "r-1",
        titulo: "Nueva encomienda",
        mensaje: "Llegó una encomienda de Starken a las 18:43. Retírala en conserjería (Estante B).",
        entidadTipo: "Encomienda",
      })
    );
  });

  it("solo acepta residentes activos del mismo condominio", async () => {
    buscarUsuario.mockResolvedValue(null);
    await expect(crearEncomienda("condo-1", "conserje-1", { usuarioId: "otro" })).rejects.toThrow(NotFoundError);
    expect(buscarUsuario.mock.calls[0][0].where).toEqual({ id: "otro", condominioId: "condo-1", rol: Rol.RESIDENTE, activo: true });
    expect(crear).not.toHaveBeenCalled();
  });
});

describe("listas sin fotos", () => {
  it("la lista del residente no trae la foto, pero indica si la tiene", async () => {
    listar.mockResolvedValueOnce([{ id: "e-1" }, { id: "e-2" }]).mockResolvedValueOnce([{ id: "e-2" }]);

    const r = await listarMisEncomiendas("r-1");

    expect(listar.mock.calls[0][0].select).not.toHaveProperty("fotoUrl");
    expect(r).toEqual([
      { id: "e-1", tieneFoto: false },
      { id: "e-2", tieneFoto: true },
    ]);
  });
});

describe("obtenerEncomienda", () => {
  it("un residente no puede ver la encomienda de otro", async () => {
    buscar.mockResolvedValue({ ...DETALLE, usuarioId: "otra-persona", fotoUrl: null });
    await expect(obtenerEncomienda("condo-1", "e-1", { id: "r-1", rol: Rol.RESIDENTE })).rejects.toThrow(ForbiddenError);
  });

  it("conserjería ve el detalle con la foto", async () => {
    buscar.mockResolvedValue({ ...DETALLE, fotoUrl: "data:image/jpeg;base64,AAA" });
    const r = await obtenerEncomienda("condo-1", "e-1", { id: "c-1", rol: Rol.CONSERJE });
    expect(r.fotoUrl).toBe("data:image/jpeg;base64,AAA");
    expect(r.tieneFoto).toBe(true);
  });
});

describe("entregarEncomienda", () => {
  it("la marca como retirada de forma atómica y avisa al residente quién la retiró", async () => {
    buscar
      .mockResolvedValueOnce({ id: "e-1", usuarioId: "r-1", remitente: "Starken", usuario: RESIDENTE })
      .mockResolvedValueOnce(DETALLE);
    actualizar.mockResolvedValue({ count: 1 });

    await entregarEncomienda("condo-1", "e-1", "conserje-1", "María Residente");

    const { where, data } = actualizar.mock.calls[0][0];
    expect(where).toEqual({ id: "e-1", condominioId: "condo-1", estado: EstadoEncomienda.NOTIFICADA });
    expect(data).toMatchObject({ estado: EstadoEncomienda.RETIRADA, retiradaPor: "María Residente", cerradaPorId: "conserje-1" });
    expect(notificar.mock.calls[0][0].mensaje).toMatch(/^Tu encomienda de Starken fue entregada a María Residente a las \d\d:\d\d\.$/);
  });

  it("si no se indica quién retira, se registra al mismo residente", async () => {
    buscar
      .mockResolvedValueOnce({ id: "e-1", usuarioId: "r-1", remitente: null, usuario: RESIDENTE })
      .mockResolvedValueOnce(DETALLE);
    actualizar.mockResolvedValue({ count: 1 });

    await entregarEncomienda("condo-1", "e-1", "conserje-1");

    expect(actualizar.mock.calls[0][0].data.retiradaPor).toBe("Roberto Residente");
  });

  it("no permite entregarla dos veces (doble clic o dos conserjes a la vez)", async () => {
    buscar
      .mockResolvedValueOnce({ id: "e-1", usuarioId: "r-1", remitente: null, usuario: RESIDENTE })
      .mockResolvedValueOnce({ estado: EstadoEncomienda.RETIRADA, retiradaPor: "Roberto Residente" });
    actualizar.mockResolvedValue({ count: 0 });

    const intento = entregarEncomienda("condo-1", "e-1", "conserje-1");
    await expect(intento).rejects.toThrow(ConflictError);
    await expect(intento).rejects.toThrow("Esta encomienda ya fue entregada a Roberto Residente.");
    expect(notificar).not.toHaveBeenCalled();
  });

  it("no permite entregar una encomienda devuelta", async () => {
    buscar
      .mockResolvedValueOnce({ id: "e-1", usuarioId: "r-1", remitente: null, usuario: RESIDENTE })
      .mockResolvedValueOnce({ estado: EstadoEncomienda.DEVUELTA, retiradaPor: null });
    actualizar.mockResolvedValue({ count: 0 });

    await expect(entregarEncomienda("condo-1", "e-1", "conserje-1")).rejects.toThrow("Esta encomienda ya fue devuelta al remitente.");
  });

  it("una encomienda inexistente o de otro condominio da 404", async () => {
    buscar.mockResolvedValue(null);
    await expect(entregarEncomienda("condo-1", "nada", "conserje-1")).rejects.toThrow(NotFoundError);
    expect(actualizar).not.toHaveBeenCalled();
  });
});

describe("devolverEncomienda", () => {
  it("la marca como devuelta con el motivo y avisa al residente", async () => {
    buscar.mockResolvedValueOnce({ id: "e-1", usuarioId: "r-1", remitente: "Starken" }).mockResolvedValueOnce(DETALLE);
    actualizar.mockResolvedValue({ count: 1 });

    await devolverEncomienda("condo-1", "e-1", "conserje-1", "No se retiró en 5 días");

    expect(actualizar.mock.calls[0][0].data).toMatchObject({
      estado: EstadoEncomienda.DEVUELTA,
      motivoDevolucion: "No se retiró en 5 días",
      cerradaPorId: "conserje-1",
    });
    expect(notificar.mock.calls[0][0].mensaje).toBe(
      "Tu encomienda de Starken fue devuelta al remitente. Motivo: No se retiró en 5 días."
    );
  });

  it("no se puede devolver una encomienda ya entregada", async () => {
    buscar
      .mockResolvedValueOnce({ id: "e-1", usuarioId: "r-1", remitente: null })
      .mockResolvedValueOnce({ estado: EstadoEncomienda.RETIRADA, retiradaPor: null });
    actualizar.mockResolvedValue({ count: 0 });

    await expect(devolverEncomienda("condo-1", "e-1", "conserje-1", "x")).rejects.toThrow("Esta encomienda ya fue entregada.");
  });
});
