import { prisma } from "../../lib/prisma";
import { ConflictError, NotFoundError } from "../../lib/errors";

// HU-03: gestionar estructura del condominio (torres, departamentos, espacios comunes).

export async function obtenerCondominio(condominioId: string) {
  const condominio = await prisma.condominio.findUnique({
    where: { id: condominioId },
    include: {
      torres: { orderBy: { nombre: "asc" } },
      espaciosComunes: { orderBy: { nombre: "asc" } },
    },
  });
  if (!condominio) throw new NotFoundError("Condominio no encontrado.");
  return condominio;
}

export async function actualizarCondominio(
  condominioId: string,
  data: { nombre?: string; direccion?: string | null; comuna?: string | null }
) {
  return prisma.condominio.update({ where: { id: condominioId }, data });
}

export async function crearTorre(condominioId: string, nombre: string) {
  return prisma.torre.create({ data: { condominioId, nombre } });
}

export async function listarTorres(condominioId: string) {
  return prisma.torre.findMany({ where: { condominioId }, orderBy: { nombre: "asc" } });
}

export async function crearDepartamento(
  condominioId: string,
  data: { numero: string; torreId?: string | null }
) {
  const torreId = data.torreId ?? null;
  // La torre tiene que ser de este condominio, y la misma unidad no se registra dos veces.
  if (torreId) {
    const torre = await prisma.torre.findFirst({ where: { id: torreId, condominioId }, select: { id: true } });
    if (!torre) throw new NotFoundError("La torre elegida no existe en este condominio.");
  }
  const numero = data.numero.trim();
  const repetida = await prisma.departamento.findFirst({
    where: { condominioId, torreId, numero: { equals: numero, mode: "insensitive" } },
    select: { id: true },
  });
  if (repetida) throw new ConflictError(`La unidad ${numero} ya existe${torreId ? " en esa torre" : ""}.`);
  return prisma.departamento.create({
    data: { condominioId, numero, torreId },
  });
}

export async function listarDepartamentos(condominioId: string) {
  return prisma.departamento.findMany({
    where: { condominioId },
    include: { torre: true, residentes: { select: { id: true, nombre: true, apellido: true } } },
    orderBy: [{ torre: { nombre: "asc" } }, { numero: "asc" }],
  });
}

export async function crearEspacioComun(
  condominioId: string,
  data: {
    nombre: string;
    descripcion?: string;
    capacidad?: number;
    horarioInicio: string;
    horarioFin: string;
  }
) {
  return prisma.espacioComun.create({ data: { condominioId, ...data } });
}

export async function listarEspaciosComunes(condominioId: string, soloActivos = false) {
  return prisma.espacioComun.findMany({
    where: { condominioId, ...(soloActivos ? { activo: true } : {}) },
    orderBy: { nombre: "asc" },
  });
}

export async function actualizarEspacioComun(
  condominioId: string,
  espacioId: string,
  data: Partial<{
    nombre: string;
    descripcion: string;
    capacidad: number;
    horarioInicio: string;
    horarioFin: string;
    activo: boolean;
  }>
) {
  const espacio = await prisma.espacioComun.findFirst({ where: { id: espacioId, condominioId } });
  if (!espacio) throw new NotFoundError("Espacio común no encontrado.");
  return prisma.espacioComun.update({ where: { id: espacioId }, data });
}
