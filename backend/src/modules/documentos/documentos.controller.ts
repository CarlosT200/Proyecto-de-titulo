import { Request, Response } from "express";
import { crearDocumentoSchema } from "./documentos.schema";
import * as service from "./documentos.service";
import { AppError } from "../../lib/errors";
import { coincideConTipo, firmarEnlaceDocumento, nombreDeArchivo, parsearDataUri, verificarEnlaceDocumento } from "../../lib/archivos";
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

// Con la sesion iniciada: entrega un enlace que vale 2 minutos para abrir el archivo.
export async function crearEnlaceController(req: Request, res: Response) {
  await service.obtenerArchivo(req.auth!.condominioId, req.params.id); // comprueba que existe y es de su condominio
  const token = firmarEnlaceDocumento(req.params.id, req.auth!.condominioId);
  res.json({ url: `/api/documentos/archivo/${token}` });
}

// Sin sesion (el enlace ya es la autorizacion): sirve el archivo con su tipo real.
export async function descargarArchivoController(req: Request, res: Response) {
  let enlace;
  try {
    enlace = verificarEnlaceDocumento(req.params.token);
  } catch {
    throw new AppError("El enlace venció. Vuelve a abrir el documento desde la aplicación.", 410);
  }

  const documento = await service.obtenerArchivo(enlace.condominioId, enlace.documentoId);

  // Documentos antiguos guardados en disco: se redirige a su ruta.
  if (documento.archivoUrl.startsWith("/uploads/")) {
    res.redirect(documento.archivoUrl);
    return;
  }

  const archivo = parsearDataUri(documento.archivoUrl);
  if (!archivo || !coincideConTipo(archivo.buffer, archivo.mime)) {
    throw new AppError("El archivo está dañado o no se puede mostrar.", 422);
  }

  // El visor de PDF del navegador no funciona con la politica de seguridad general (object-src 'none'),
  // asi que en esta respuesta se quita. Es seguro: solo se sirven PDF e imagenes verificados por su
  // contenido, con "nosniff" para que el navegador no los reinterprete como pagina.
  res.removeHeader("Content-Security-Policy");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Content-Type", archivo.mime);
  res.setHeader("Content-Length", archivo.buffer.length);
  res.setHeader("Content-Disposition", `inline; filename="${nombreDeArchivo(documento.titulo, archivo.mime)}"`);
  res.end(archivo.buffer);
}
