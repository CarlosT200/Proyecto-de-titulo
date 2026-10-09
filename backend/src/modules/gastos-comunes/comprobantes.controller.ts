import { Request, Response } from "express";
import { aprobarComprobanteSchema, informarPagoSchema, rechazarComprobanteSchema } from "./gastos-comunes.schema";
import * as service from "./comprobantes.service";
import { AppError } from "../../lib/errors";
import { coincideConTipo, firmarEnlaceComprobante, nombreDeArchivo, parsearDataUri, verificarEnlaceComprobante } from "../../lib/archivos";
import { auditar } from "../auditoria/auditoria.service";
import { pesos } from "../../lib/gastosComunes";

export async function informarPagoController(req: Request, res: Response) {
  const data = informarPagoSchema.parse(req.body);
  if (!req.file) throw new AppError("Adjunta el comprobante (foto o PDF de la transferencia).", 422);
  if (!coincideConTipo(req.file.buffer, req.file.mimetype)) {
    throw new AppError("El archivo no corresponde al tipo indicado. Sube una foto (JPG, PNG o WEBP) o un PDF válidos.", 422);
  }
  const archivo = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
  const comprobante = await service.informarPago(req.auth!.condominioId, req.auth!.sub, req.params.id, data, archivo);
  await auditar(
    req,
    "CREAR",
    "GastoComun",
    `Informó un pago de ${pesos(data.monto)} de la unidad ${comprobante.unidad} (gasto común de ${comprobante.periodo}).`,
    comprobante.id
  );
  res.status(201).json(comprobante);
}

export async function listarComprobantesController(req: Request, res: Response) {
  res.json(await service.listarComprobantes(req.auth!.condominioId));
}

export async function aprobarComprobanteController(req: Request, res: Response) {
  const { monto } = aprobarComprobanteSchema.parse(req.body ?? {});
  const r = await service.aprobarComprobante(req.auth!.condominioId, req.params.id, req.auth!.sub, monto);
  await auditar(req, "ACTUALIZAR", "GastoComun", `Aprobó el comprobante de ${pesos(r.monto)} de la unidad ${r.unidad} (gasto común de ${r.periodo}).`, req.params.id);
  res.json(r);
}

export async function rechazarComprobanteController(req: Request, res: Response) {
  const { motivo } = rechazarComprobanteSchema.parse(req.body);
  const r = await service.rechazarComprobante(req.auth!.condominioId, req.params.id, req.auth!.sub, motivo);
  await auditar(
    req,
    "CANCELAR",
    "GastoComun",
    `Rechazó el comprobante de ${pesos(r.monto)} de la unidad ${r.unidad} (gasto común de ${r.periodo}). Motivo: ${motivo}`,
    req.params.id
  );
  res.json(r);
}

// Con la sesion iniciada: un enlace de 2 minutos para abrir el archivo en otra pestaña.
export async function enlaceComprobanteController(req: Request, res: Response) {
  await service.obtenerArchivoComprobante(req.auth!.condominioId, req.params.id, { id: req.auth!.sub, rol: req.auth!.rol });
  const token = firmarEnlaceComprobante(req.params.id, req.auth!.condominioId);
  res.json({ url: `/api/gastos-comunes/comprobantes/archivo/${token}` });
}

// Sin sesion (el enlace ya es la autorizacion): sirve el archivo con su tipo real.
export async function archivoComprobanteController(req: Request, res: Response) {
  let enlace;
  try {
    enlace = verificarEnlaceComprobante(req.params.token);
  } catch {
    throw new AppError("El enlace venció. Vuelve a abrir el comprobante desde la aplicación.", 410);
  }
  const archivo = parsearDataUri(await service.obtenerArchivoComprobante(enlace.condominioId, enlace.comprobanteId));
  if (!archivo || !coincideConTipo(archivo.buffer, archivo.mime)) {
    throw new AppError("El archivo está dañado o no se puede mostrar.", 422);
  }
  // Igual que en documentos: el visor de PDF necesita quitar la politica general; solo se sirven
  // archivos verificados por su contenido y con "nosniff".
  res.removeHeader("Content-Security-Policy");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Content-Type", archivo.mime);
  res.setHeader("Content-Length", archivo.buffer.length);
  res.setHeader("Content-Disposition", `inline; filename="${nombreDeArchivo("comprobante", archivo.mime)}"`);
  res.end(archivo.buffer);
}
