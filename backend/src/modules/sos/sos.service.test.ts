import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { Rol, TipoEmergenciaSos } from "@prisma/client";

vi.mock("../../lib/prisma", () => ({
  prisma: {
    usuario: { findUnique: vi.fn(), findMany: vi.fn() },
    alertaSos: { create: vi.fn(), findFirst: vi.fn() },
  },
}));

vi.mock("../notificaciones/notificaciones.service", () => ({
  crearNotificacionesMasivas: vi.fn(),
}));

vi.mock("../push/push.service", () => ({
  enviarPushAUsuarios: vi.fn(),
}));

import { prisma } from "../../lib/prisma";
import { crearNotificacionesMasivas } from "../notificaciones/notificaciones.service";
import { enviarPushAUsuarios } from "../push/push.service";
import { crearAlerta, VENTANA_IDEMPOTENCIA_SOS_MS } from "./sos.service";

const findUniqueUsuario = prisma.usuario.findUnique as unknown as Mock;
const findManyUsuario = prisma.usuario.findMany as unknown as Mock;
const crearAlertaSos = prisma.alertaSos.create as unknown as Mock;
const buscarAlertaReciente = prisma.alertaSos.findFirst as unknown as Mock;
const notificarMasivo = crearNotificacionesMasivas as unknown as Mock;
const enviarPush = enviarPushAUsuarios as unknown as Mock;

beforeEach(() => {
  vi.clearAllMocks();
  // Por defecto no hay una alerta reciente: se crea una nueva.
  buscarAlertaReciente.mockResolvedValue(null);
});

// Boton de panico (ver BotonSOS.tsx): si esto notifica a la gente
// equivocada, o a nadie, el feature no cumple su unico proposito.
describe("crearAlerta (SOS)", () => {
  it("notifica solo a ADMIN y CONSERJE del condominio, nunca a otros residentes", async () => {
    findUniqueUsuario.mockResolvedValue({
      nombre: "Roberto",
      apellido: "Residente",
      departamento: { numero: "101", torre: { nombre: "Torre A" } },
    });
    crearAlertaSos.mockResolvedValue({ id: "alerta-1" });
    findManyUsuario.mockResolvedValue([{ id: "admin-1" }, { id: "conserje-1" }]);

    await crearAlerta("condo-1", "residente-1", TipoEmergenciaSos.BOMBEROS);

    expect(findManyUsuario).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ condominioId: "condo-1", rol: { in: [Rol.ADMIN, Rol.CONSERJE] } }),
      })
    );
    expect(notificarMasivo).toHaveBeenCalledWith(
      ["admin-1", "conserje-1"],
      expect.objectContaining({
        tipo: "SOS_BOMBEROS",
        entidadTipo: "AlertaSos",
        entidadId: "alerta-1",
      }),
      { urgencia: "high" }
    );
  });

  it("incluye el nombre y la unidad del residente en el mensaje de la alerta", async () => {
    findUniqueUsuario.mockResolvedValue({
      nombre: "Roberto",
      apellido: "Residente",
      departamento: { numero: "101", torre: { nombre: "Torre A" } },
    });
    crearAlertaSos.mockResolvedValue({ id: "alerta-2" });
    findManyUsuario.mockResolvedValue([{ id: "admin-1" }]);

    await crearAlerta("condo-1", "residente-1", TipoEmergenciaSos.AMBULANCIA);

    expect(notificarMasivo).toHaveBeenCalledWith(
      ["admin-1"],
      expect.objectContaining({
        mensaje: "Roberto Residente (Torre A 101) activó una alerta de Ambulancia.",
      }),
      { urgencia: "high" }
    );
  });

  it("no revienta si no hay nadie que notificar (condominio sin admin/conserje activo)", async () => {
    findUniqueUsuario.mockResolvedValue({ nombre: "Roberto", apellido: "Residente", departamento: null });
    crearAlertaSos.mockResolvedValue({ id: "alerta-3" });
    findManyUsuario.mockResolvedValue([]);

    await expect(crearAlerta("condo-1", "residente-1", TipoEmergenciaSos.CARABINEROS)).resolves.toBeDefined();
    expect(notificarMasivo).toHaveBeenCalledWith([], expect.anything(), { urgencia: "high" });
  });

  // Confiabilidad: una emergencia no puede fallarle al residente. Aunque el aviso en la app falle
  // (p. ej. un problema puntual de base de datos), la alerta ya quedó registrada, así que crearAlerta
  // igual devuelve la alerta y, como respaldo, intenta el push (el canal que llega con la app cerrada).
  it("si falla el aviso en la app, la alerta igual se crea y se intenta el push", async () => {
    findUniqueUsuario.mockResolvedValue({ nombre: "Roberto", apellido: "Residente", departamento: null });
    crearAlertaSos.mockResolvedValue({ id: "alerta-4" });
    findManyUsuario.mockResolvedValue([{ id: "admin-1" }, { id: "conserje-1" }]);
    notificarMasivo.mockRejectedValueOnce(new Error("base de datos no disponible"));

    const alerta = await crearAlerta("condo-1", "residente-1", TipoEmergenciaSos.BOMBEROS);

    expect(alerta).toEqual({ id: "alerta-4", repetida: false });
    expect(enviarPush).toHaveBeenCalledWith(
      ["admin-1", "conserje-1"],
      expect.objectContaining({ tipo: "SOS_BOMBEROS", entidadId: "alerta-4" }),
      { urgencia: "high" }
    );
  });
});

// Idempotencia: un doble clic, un reintento del navegador o la peticion keepalive repetida no
// deben generar dos alertas ni dos rondas de avisos a conserjeria/administracion.
describe("crearAlerta (SOS) — idempotencia", () => {
  it("si hay una alerta ACTIVA del mismo tipo dentro de la ventana, la reutiliza y no vuelve a avisar", async () => {
    buscarAlertaReciente.mockResolvedValue({ id: "alerta-previa", tipo: TipoEmergenciaSos.BOMBEROS, estado: "ACTIVA" });

    const antes = Date.now();
    const alerta = await crearAlerta("condo-1", "residente-1", TipoEmergenciaSos.BOMBEROS);

    expect(alerta).toEqual({ id: "alerta-previa", tipo: "BOMBEROS", estado: "ACTIVA", repetida: true });
    expect(crearAlertaSos).not.toHaveBeenCalled();
    expect(notificarMasivo).not.toHaveBeenCalled();
    expect(enviarPush).not.toHaveBeenCalled();

    // La busqueda se acota al residente, al tipo, al condominio, al estado ACTIVA y a la ventana.
    const where = buscarAlertaReciente.mock.calls[0][0].where;
    expect(where).toMatchObject({ condominioId: "condo-1", usuarioId: "residente-1", tipo: "BOMBEROS", estado: "ACTIVA" });
    const desde = (where.createdAt.gte as Date).getTime();
    expect(antes - desde).toBeGreaterThanOrEqual(VENTANA_IDEMPOTENCIA_SOS_MS - 50);
    expect(antes - desde).toBeLessThanOrEqual(VENTANA_IDEMPOTENCIA_SOS_MS + 1000);
  });

  it("un tipo distinto dentro de la ventana SI crea una alerta nueva (se equivoco de boton y corrigio)", async () => {
    // findFirst filtra por tipo, asi que para AMBULANCIA no encuentra la de BOMBEROS.
    buscarAlertaReciente.mockResolvedValue(null);
    findUniqueUsuario.mockResolvedValue({ nombre: "Roberto", apellido: "Residente", departamento: null });
    crearAlertaSos.mockResolvedValue({ id: "alerta-5" });
    findManyUsuario.mockResolvedValue([{ id: "admin-1" }]);

    const alerta = await crearAlerta("condo-1", "residente-1", TipoEmergenciaSos.AMBULANCIA);

    expect(alerta).toEqual({ id: "alerta-5", repetida: false });
    expect(buscarAlertaReciente.mock.calls[0][0].where.tipo).toBe("AMBULANCIA");
    expect(crearAlertaSos).toHaveBeenCalledTimes(1);
  });
});

// Modo demostracion: la alerta se registra y se avisa igual (asi la defensa muestra el flujo
// completo), pero el aviso deja claro que no es una emergencia real.
describe("crearAlerta (SOS) — modo demostración", () => {
  it("marca el titulo y el mensaje como [DEMO] cuando el servidor esta en modo demo", async () => {
    findUniqueUsuario.mockResolvedValue({ nombre: "Roberto", apellido: "Residente", departamento: null });
    crearAlertaSos.mockResolvedValue({ id: "alerta-demo" });
    findManyUsuario.mockResolvedValue([{ id: "conserje-1" }]);

    await crearAlerta("condo-1", "residente-1", TipoEmergenciaSos.CARABINEROS, { modoDemo: true });

    expect(notificarMasivo).toHaveBeenCalledWith(
      ["conserje-1"],
      expect.objectContaining({
        titulo: "[DEMO] 🚨 Alerta SOS: Carabineros",
        mensaje: "Roberto Residente activó una alerta de Carabineros. Modo demostración: no se llamó a ningún número real.",
      }),
      { urgencia: "high" }
    );
  });

  it("sin la opcion (operacion real) el aviso no lleva ninguna marca de demo", async () => {
    findUniqueUsuario.mockResolvedValue({ nombre: "Roberto", apellido: "Residente", departamento: null });
    crearAlertaSos.mockResolvedValue({ id: "alerta-real" });
    findManyUsuario.mockResolvedValue([{ id: "conserje-1" }]);

    await crearAlerta("condo-1", "residente-1", TipoEmergenciaSos.CARABINEROS);

    const aviso = notificarMasivo.mock.calls[0][1];
    expect(aviso.titulo).toBe("🚨 Alerta SOS: Carabineros");
    expect(aviso.mensaje).not.toContain("demostración");
    expect(aviso.titulo).not.toContain("DEMO");
  });
});
