import { Request, Response } from "express";
import { crearDocumentoSchema } from "./documentos.schema";
import * as service from "./documentos.service";
import { AppError } from "../../lib/errors";
import { coincideConTipo, enviarArchivoVerificado, leerArchivoHeredado, nombreDeArchivo, parsearDataUri } from "../../lib/archivos";
import { UPLOADS_DIR } from "../../middleware/upload";
import { auditar } from "../auditoria/auditoria.service";

export async function crearDocumentoController(req: Request, res: Response) {
  const data = crearDocumentoSchema.parse(req.body);
  if (!req.file) {
    throw new AppError("Debes adjuntar un archivo.", 422);
  }
  if (!coincideConTipo(req.file.buffer, req.file.mimetype)) {
    throw new AppError("El archivo no corresponde al tipo indicado. Sube un PDF o una imagen (JPG, PNG o WEBP) válidos.", 422);
  }
  const archivoUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
  const documento = await service.crearDocumento(req.auth!.condominioId, req.auth!.sub, {
    ...data,
    archivoUrl,
  });
  await auditar(req, "CREAR", "Documento", `Publicó el documento "${documento.titulo}".`, documento.id);
  res.status(201).json(documento);
}

export async function listarDocumentosController(req: Request, res: Response) {
  res.json(await service.listarDocumentos(req.auth!.condominioId));
}

export async function eliminarDocumentoController(req: Request, res: Response) {
  const eliminado = await service.eliminarDocumento(req.auth!.condominioId, req.params.id);
  await auditar(req, "ELIMINAR", "Documento", `Eliminó el documento "${eliminado.titulo}".`, req.params.id);
  res.status(204).send();
}

// Con la sesion iniciada (cookie): sirve el archivo con su tipo real. Cualquier persona del
// condominio puede ver sus documentos (reglamentos, actas); los de otro condominio no existen para ella.
export async function descargarArchivoController(req: Request, res: Response) {
  const documento = await service.obtenerArchivo(req.auth!.condominioId, req.params.id);

  const archivo = parsearDataUri(documento.archivoUrl) ?? (await leerArchivoHeredado(UPLOADS_DIR, documento.archivoUrl));
  if (!archivo) {
    throw new AppError("El archivo está dañado o no se puede mostrar.", 422);
  }
  enviarArchivoVerificado(res, archivo, nombreDeArchivo(documento.titulo, archivo.mime));
}
