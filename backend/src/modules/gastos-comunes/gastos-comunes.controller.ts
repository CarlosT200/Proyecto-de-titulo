import { Request, Response } from "express";
import { anularPagoSchema, crearPeriodoSchema, guardarAlicuotasSchema, registrarPagoSchema } from "./gastos-comunes.schema";
import * as service from "./gastos-comunes.service";
import { auditar } from "../auditoria/auditoria.service";
import { pesos } from "../../lib/gastosComunes";

export async function listarPeriodosController(req: Request, res: Response) {
  res.json(await service.listarPeriodos(req.auth!.condominioId));
}

export async function obtenerPeriodoController(req: Request, res: Response) {
  res.json(await service.obtenerPeriodo(req.auth!.condominioId, req.params.id));
}

export async function crearPeriodoController(req: Request, res: Response) {
  const data = crearPeriodoSchema.parse(req.body);
  const periodo = await service.crearPeriodo(req.auth!.condominioId, req.auth!.sub, data);
  await auditar(
    req,
    "CREAR",
    "GastoComun",
    `Emitió el cobro de gastos comunes de ${periodo.nombre} para ${periodo.unidades} ${periodo.unidades === 1 ? "unidad" : "unidades"} (total ${pesos(periodo.totalCobrado)}).`,
    periodo.id
  );
  res.status(201).json(periodo);
}

export async function eliminarPeriodoController(req: Request, res: Response) {
  const { nombre } = await service.eliminarPeriodo(req.auth!.condominioId, req.params.id);
  await auditar(req, "ELIMINAR", "GastoComun", `Eliminó el cobro de gastos comunes de ${nombre}.`, req.params.id);
  res.status(204).send();
}

export async function morosidadController(req: Request, res: Response) {
  res.json(await service.listarMorosidad(req.auth!.condominioId));
}

export async function registrarPagoController(req: Request, res: Response) {
  const data = registrarPagoSchema.parse(req.body);
  const resultado = await service.registrarPago(req.auth!.condominioId, req.params.id, req.auth!.sub, data);
  await auditar(
    req,
    "CREAR",
    "GastoComun",
    `Registró un pago de ${pesos(data.monto)} de la unidad ${resultado.unidad} (gasto común de ${resultado.periodo}).`,
    req.params.id
  );
  res.status(201).json(resultado);
}

export async function anularPagoController(req: Request, res: Response) {
  const { motivo } = anularPagoSchema.parse(req.body);
  const anulado = await service.anularPago(req.auth!.condominioId, req.params.id, req.auth!.sub, motivo);
  await auditar(
    req,
    "CANCELAR",
    "GastoComun",
    `Anuló un pago de ${pesos(anulado.monto)} de la unidad ${anulado.unidad} (gasto común de ${anulado.periodo}). Motivo: ${motivo}`,
    req.params.id
  );
  res.json(anulado);
}

export async function listarAlicuotasController(req: Request, res: Response) {
  res.json(await service.listarAlicuotas(req.auth!.condominioId));
}

export async function guardarAlicuotasController(req: Request, res: Response) {
  const { alicuotas } = guardarAlicuotasSchema.parse(req.body);
  const resultado = await service.guardarAlicuotas(req.auth!.condominioId, alicuotas);
  await auditar(
    req,
    "ACTUALIZAR",
    "GastoComun",
    `Actualizó las alícuotas de prorrateo (${alicuotas.length} ${alicuotas.length === 1 ? "unidad" : "unidades"}).`
  );
  res.json(resultado);
}

export async function miCuentaController(req: Request, res: Response) {
  res.json(await service.obtenerMiCuenta(req.auth!.sub));
}

export async function obtenerCobroController(req: Request, res: Response) {
  res.json(await service.obtenerCobro(req.auth!.condominioId, req.params.id, { id: req.auth!.sub, rol: req.auth!.rol }));
}
