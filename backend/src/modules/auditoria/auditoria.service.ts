import type { Request } from "express";
import { prisma } from "../../lib/prisma";

// RNF-06: el sistema registra las acciones administrativas relevantes para mantener trazabilidad.
export type AccionAuditoria = "CREAR" | "ACTUALIZAR" | "ELIMINAR" | "CANCELAR";

export const ENTIDADES_AUDITADAS = [
  "Comunicado",
  "Documento",
  "Multa",
  "Incidencia",
  "Reserva",
  "Usuario",
  "Condominio",
  "Encomienda",
  "AlertaSos",
  "GastoComun",
] as const;

interface RegistroAuditoria {
  condominioId: string;
  usuarioId: string | null;
  accion: AccionAuditoria;
  entidad: string;
  entidadId?: string | null;
  descripcion: string;
}

export async function registrarAuditoria(registro: RegistroAuditoria): Promise<void> {
  try {
    await prisma.auditoria.create({
      data: {
        condominioId: registro.condominioId,
        usuarioId: registro.usuarioId,
        accion: registro.accion,
        entidad: registro.entidad,
        entidadId: registro.entidadId ?? null,
        descripcion: registro.descripcion,
      },
    });
  } catch (error) {
    // Un fallo al dejar el rastro no debe deshacer ni ocultar la accion que ya se hizo, pero
    // tampoco puede pasar en silencio: queda en el log del servidor.
    console.error("No se pudo registrar la auditoría:", registro.accion, registro.entidad, error);
  }
}

// Atajo para los controladores: toma condominio y usuario de la sesion.
export function auditar(
  req: Request,
  accion: AccionAuditoria,
  entidad: string,
  descripcion: string,
  entidadId?: string | null
): Promise<void> {
  return registrarAuditoria({
    condominioId: req.auth!.condominioId,
    usuarioId: req.auth!.sub,
    accion,
    entidad,
    entidadId,
    descripcion,
  });
}

export async function listarAuditoria(condominioId: string, filtros: { entidad?: string; limite?: number }) {
  return prisma.auditoria.findMany({
    where: { condominioId, ...(filtros.entidad ? { entidad: filtros.entidad } : {}) },
    include: { usuario: { select: { id: true, nombre: true, apellido: true, rol: true } } },
    orderBy: { createdAt: "desc" },
    take: Math.min(filtros.limite ?? 200, 500),
  });
}
