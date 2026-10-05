import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { EstadoIncidencia, PrioridadIncidencia, Rol } from "@prisma/client";

vi.mock("../../lib/prisma", () => ({
  prisma: {
    incidencia: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    usuario: { findUnique: vi.fn(), findMany: vi.fn() },
  },
}));
vi.mock("../notificaciones/notificaciones.service", () => ({
  crearNotificacion: vi.fn(),
  crearNotificacionesMasivas: vi.fn(),
}));

import { prisma } from "../../lib/prisma";
import { crearNotificacion, crearNotificacionesMasivas } from "../notificaciones/notificaciones.service";
import { actualizarIncidencia, crearIncidencia } from "./incidencias.service";
import { crearIncidenciaSchema } from "./incidencias.schema";

const crear = prisma.incidencia.create as unknown as Mock;
const buscar = prisma.incidencia.findFirst as unknown as Mock;
const actualizar = prisma.incidencia.update as unknown as Mock;
const buscarUsuario = prisma.usuario.findUnique as unknown as Mock;
const buscarUsuarios = prisma.usuario.findMany as unknown as Mock;
const notificar = crearNotificacion as unknown as Mock;
const notificarVarios = crearNotificacionesMasivas as unknown as Mock;

beforeEach(() => {
  vi.clearAllMocks();
  crear.mockImplementation(async ({ data }) => ({ id: "i-1", ...data, fotoUrl: data.fotoUrl ?? null }));
  buscarUsuario.mockResolvedValue({ nombre: "Roberto", apellido: "Residente", departamento: { numero: "101", torre: { nombre: "Torre A" } } });
  buscarUsuarios.mockResolvedValue([{ id: "admin-1" }]);
});

const base = { titulo: "Luz del pasillo", descripcion: "No enciende la luz del pasillo", ubicacion: "Piso 2" };

describe("crearIncidencia", () => {
  it("usa la categoría que eligió el residente y guarda aparte la sugerencia automática", async () => {
    await crearIncidencia("condo-1", "r-1", { ...base, categoria: "SEGURIDAD" });
    const { data } = crear.mock.calls[0][0];
    expect(data.categoria).toBe("SEGURIDAD");
    expect(data.sugerenciaIA.categoria).toBe("ELECTRICIDAD");
  });

  it("si el residente no elige, usa la categoría y prioridad sugeridas", async () => {
    await crearIncidencia("condo-1", "r-1", base);
    const { data } = crear.mock.calls[0][0];
    expect(data.categoria).toBe("ELECTRICIDAD");
    expect(data.prioridad).toBe(PrioridadIncidencia.MEDIA);
    expect(notificarVarios).not.toHaveBeenCalled();
  });

  it("marcada como urgente queda en prioridad alta y avisa a la administración", async () => {
    await crearIncidencia("condo-1", "r-1", { ...base, urgente: true });
    expect(crear.mock.calls[0][0].data.prioridad).toBe(PrioridadIncidencia.ALTA);
    expect(buscarUsuarios.mock.calls[0][0].where).toEqual({ condominioId: "condo-1", rol: Rol.ADMIN, activo: true });
    expect(notificarVarios).toHaveBeenCalledWith(
      ["admin-1"],
      expect.objectContaining({
        titulo: "Incidencia urgente",
        mensaje: 'Roberto Residente (Torre A 101) reportó: "Luz del pasillo".',
        entidadTipo: "Incidencia",
      })
    );
  });

  it("si el texto describe una emergencia, también avisa aunque no la marque urgente", async () => {
    await crearIncidencia("condo-1", "r-1", { titulo: "Agua en el baño", descripcion: "Está saliendo agua del techo", ubicacion: "Depto 101" });
    expect(crear.mock.calls[0][0].data.prioridad).toBe(PrioridadIncidencia.ALTA);
    expect(notificarVarios).toHaveBeenCalledTimes(1);
  });

  it("la respuesta no devuelve la foto completa", async () => {
    const r = await crearIncidencia("condo-1", "r-1", { ...base, fotoUrl: "data:image/jpeg;base64,AAA" });
    expect(r).not.toHaveProperty("fotoUrl");
  });
});

describe("crearIncidenciaSchema (formulario multipart)", () => {
  it("acepta el formulario mínimo y convierte 'urgente' de texto a booleano", () => {
    expect(crearIncidenciaSchema.parse({ ...base, categoria: "", urgente: "true" })).toEqual({ ...base, urgente: true });
    expect(crearIncidenciaSchema.parse(base).urgente).toBe(false);
  });

  it("rechaza categorías que no están en la lista y campos vacíos", () => {
    expect(crearIncidenciaSchema.safeParse({ ...base, categoria: "INVENTADA" }).success).toBe(false);
    expect(crearIncidenciaSchema.safeParse({ ...base, titulo: "   " }).success).toBe(false);
  });
});

describe("actualizarIncidencia: avisos al residente", () => {
  const incidencia = { id: "i-1", usuarioId: "r-1", titulo: "Filtración", estado: EstadoIncidencia.REPORTADA };

  beforeEach(() => {
    buscar.mockResolvedValue(incidencia);
    actualizar.mockResolvedValue(incidencia);
  });

  it("al cambiar el estado avisa e incluye el comentario si lo hay", async () => {
    await actualizarIncidencia("condo-1", "i-1", "admin-1", { estado: EstadoIncidencia.EN_PROCESO, observacion: "El gasfíter viene mañana." });
    expect(notificar.mock.calls[0][0].mensaje).toBe(
      'Tu incidencia "Filtración" cambió de estado a "En proceso". Comentario: "El gasfíter viene mañana."'
    );
  });

  it("un comentario sin cambio de estado también le llega al residente", async () => {
    await actualizarIncidencia("condo-1", "i-1", "admin-1", { observacion: "Estamos cotizando." });
    expect(notificar).toHaveBeenCalledWith(
      expect.objectContaining({ titulo: "Nuevo comentario en tu incidencia", mensaje: 'La administración comentó tu incidencia "Filtración": "Estamos cotizando."' })
    );
  });

  it("cambiar solo la prioridad no envía avisos", async () => {
    await actualizarIncidencia("condo-1", "i-1", "admin-1", { prioridad: PrioridadIncidencia.BAJA });
    expect(notificar).not.toHaveBeenCalled();
  });
});
