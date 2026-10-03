import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../../lib/errors";

// HU-22: publicar documentos.
export async function crearDocumento(
  condominioId: string,
  subidoPorId: string,
  data: { titulo: string; categoria?: string; archivoUrl: string }
) {
  const documento = await prisma.documento.create({ data: { condominioId, subidoPorId, ...data } });
  // la respuesta tampoco devuelve el archivo (la pantalla solo necesita saber que se guardo)
  const { archivoUrl: _archivo, ...sinArchivo } = documento;
  return sinArchivo;
}

// HU-23: consultar documentos.
// La lista NO incluye el archivo: se guarda como base64 dentro de la fila (hasta ~10 MB cada uno) y
// antes cada visita a "Documentos" descargaba todos los archivos completos. El archivo se pide por
// separado, solo cuando alguien lo abre (ver obtenerArchivo).
export async function listarDocumentos(condominioId: string) {
  return prisma.documento.findMany({
    where: { condominioId },
    select: { id: true, titulo: true, categoria: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function obtenerArchivo(condominioId: string, documentoId: string) {
  const documento = await prisma.documento.findFirst({
    where: { id: documentoId, condominioId },
    select: { titulo: true, archivoUrl: true },
  });
  if (!documento) throw new NotFoundError("Documento no encontrado.");
  return documento;
}

export async function eliminarDocumento(condominioId: string, documentoId: string) {
  const documento = await prisma.documento.findFirst({
    where: { id: documentoId, condominioId },
    select: { titulo: true },
  });
  if (!documento) throw new NotFoundError("Documento no encontrado.");
  await prisma.documento.deleteMany({ where: { id: documentoId, condominioId } });
  return documento;
}
