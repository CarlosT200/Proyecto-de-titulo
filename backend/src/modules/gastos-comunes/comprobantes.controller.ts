import { Request, Response } from "express";
import { aprobarComprobanteSchema, informarPagoSchema, rechazarComprobanteSchema } from "./gastos-comunes.schema";
import * as service from "./comprobantes.service";
import { AppError } from "../../lib/errors";
import { coincideConTipo, enviarArchivoVerificado, nombreDeArchivo, parsearDataUri } from "../../lib/archivos";
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

// Con la sesion iniciada (cookie): el archivo, solo para la administracion del condominio o un
// residente de la unidad que informo el pago.
export async function archivoComprobanteController(req: Request, res: Response) {
  const contenido = await service.obtenerArchivoComprobante(req.auth!.condominioId, req.params.id, { id: req.auth!.sub, rol: req.auth!.rol });
  const archivo = parsearDataUri(contenido);
  if (!archivo) {
    throw new AppError("El archivo está dañado o no se puede mostrar.", 422);
  }
  enviarArchivoVerificado(res, archivo, nombreDeArchivo("comprobante", archivo.mime));
}
