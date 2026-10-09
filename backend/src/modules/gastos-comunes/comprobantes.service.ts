import { EstadoComprobante, MedioPago, Rol } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError, ConflictError, NotFoundError } from "../../lib/errors";
import { crearNotificacionesMasivas } from "../notificaciones/notificaciones.service";
import { hoyEnChile, nombrePeriodo, nombreUnidad, pesos } from "../../lib/gastosComunes";
import { UNIDAD, aFecha, idsResidentes, sumarPago } from "./gastos-comunes.service";

// El residente informa un pago con su comprobante (HU de cobranza): la administracion lo revisa y,
// al aprobarlo, se registra el pago con la misma regla que un pago manual (nunca mas que el saldo).

const SIN_ARCHIVO = {
  id: true,
  monto: true,
  fechaPago: true,
  medio: true,
  referencia: true,
  estado: true,
  motivoRechazo: true,
  revisadoEn: true,
  createdAt: true,
} as const;

async function idsAdministradores(condominioId: string) {
  const admins = await prisma.usuario.findMany({ where: { condominioId, rol: Rol.ADMIN, activo: true }, select: { id: true } });
  return admins.map((a) => a.id);
}

export async function informarPago(
  condominioId: string,
  usuarioId: string,
  cobroId: string,
  data: { monto: number; fechaPago: string; medio: MedioPago; referencia?: string },
  archivo: string,
  instante: Date = new Date()
) {
  const cobro = await prisma.cobroGastoComun.findFirst({
    where: { id: cobroId, condominioId },
    select: { id: true, departamentoId: true, montoTotal: true, montoPagado: true, departamento: UNIDAD, periodo: { select: { anio: true, mes: true } } },
  });
  // Solo se informa un pago de la unidad propia (y no se revela si el cobro existe en otra).
  const propio = cobro
    ? await prisma.usuario.findFirst({ where: { id: usuarioId, departamentoId: cobro.departamentoId }, select: { id: true } })
    : null;
  if (!cobro || !propio) throw new NotFoundError("Cobro de gastos comunes no encontrado.");

  if (aFecha(data.fechaPago).getTime() > hoyEnChile(instante).getTime()) {
    throw new AppError("La fecha de pago no puede ser posterior a hoy.", 422);
  }
  const saldo = cobro.montoTotal - cobro.montoPagado;
  if (saldo <= 0) throw new ConflictError("Este mes ya está pagado.");
  if (data.monto > saldo) throw new AppError(`El monto supera el saldo pendiente (${pesos(saldo)}).`, 422);

  const pendiente = await prisma.comprobantePago.findFirst({
    where: { cobroId, estado: EstadoComprobante.PENDIENTE },
    select: { id: true },
  });
  if (pendiente) {
    throw new ConflictError("Ya enviaste un comprobante para este mes. Espera a que la administración lo revise.");
  }

  const comprobante = await prisma.comprobantePago.create({
    data: {
      condominioId,
      cobroId,
      informadoPorId: usuarioId,
      monto: data.monto,
      fechaPago: aFecha(data.fechaPago),
      medio: data.medio,
      referencia: data.referencia,
      archivo,
    },
    select: SIN_ARCHIVO,
  });

  const unidad = nombreUnidad(cobro.departamento);
  const nombre = nombrePeriodo(cobro.periodo.anio, cobro.periodo.mes);
  try {
    await crearNotificacionesMasivas(await idsAdministradores(condominioId), {
      tipo: "GASTO_COMUN",
      titulo: "Comprobante de pago por revisar",
      mensaje: `${unidad} informó un pago de ${pesos(data.monto)} del gasto común de ${nombre}.`,
      entidadTipo: "ComprobantePago",
      entidadId: comprobante.id,
    });
  } catch (error) {
    console.error("[comprobantes] No se pudo avisar a la administración:", error);
  }

  return { ...comprobante, unidad, periodo: nombre };
}

// Para la administracion: primero los que esperan revision (del mas antiguo al mas nuevo); despues
// los ultimos revisados.
export async function listarComprobantes(condominioId: string) {
  const incluir = {
    ...SIN_ARCHIVO,
    informadoPor: { select: { nombre: true, apellido: true } },
    revisadoPor: { select: { nombre: true, apellido: true } },
    pago: { select: { monto: true } },
    cobro: {
      select: {
        id: true,
        montoTotal: true,
        montoPagado: true,
        departamento: UNIDAD,
        periodo: { select: { anio: true, mes: true } },
      },
    },
  } as const;
  const [pendientes, revisados] = await Promise.all([
    prisma.comprobantePago.findMany({ where: { condominioId, estado: EstadoComprobante.PENDIENTE }, select: incluir, orderBy: { createdAt: "asc" } }),
    prisma.comprobantePago.findMany({
      where: { condominioId, estado: { not: EstadoComprobante.PENDIENTE } },
      select: incluir,
      orderBy: { revisadoEn: "desc" },
      take: 50,
    }),
  ]);
  return [...pendientes, ...revisados].map(({ cobro, ...c }) => ({
    ...c,
    cobro: { id: cobro.id, departamento: cobro.departamento, periodo: cobro.periodo, saldo: cobro.montoTotal - cobro.montoPagado },
  }));
}

export async function aprobarComprobante(condominioId: string, comprobanteId: string, adminId: string, montoAprobado?: number) {
  const comprobante = await prisma.comprobantePago.findFirst({
    where: { id: comprobanteId, condominioId },
    select: {
      id: true,
      monto: true,
      fechaPago: true,
      medio: true,
      referencia: true,
      estado: true,
      cobroId: true,
      cobro: { select: { departamentoId: true, departamento: UNIDAD, periodo: { select: { anio: true, mes: true } } } },
    },
  });
  if (!comprobante) throw new NotFoundError("Comprobante no encontrado.");
  const monto = montoAprobado ?? comprobante.monto;
  if (monto > comprobante.monto) throw new AppError("No puedes aprobar más de lo que informó el residente.", 422);

  // Todo o nada: el comprobante solo pasa a aprobado si el pago cabe en el saldo (si alguien registro
  // otro pago mientras tanto, no se aprueba y se avisa).
  const resultado = await prisma.$transaction(async (tx) => {
    const { count } = await tx.comprobantePago.updateMany({
      where: { id: comprobanteId, estado: EstadoComprobante.PENDIENTE },
      data: { estado: EstadoComprobante.APROBADO, revisadoPorId: adminId, revisadoEn: new Date() },
    });
    if (count === 0) throw new ConflictError("Este comprobante ya fue revisado.");
    const pago = await sumarPago(
      tx,
      comprobante.cobroId,
      { monto, fechaPago: comprobante.fechaPago, medio: comprobante.medio, referencia: comprobante.referencia ?? "Comprobante del residente" },
      adminId
    );
    if (!pago) {
      const actual = await tx.cobroGastoComun.findUnique({ where: { id: comprobante.cobroId }, select: { montoTotal: true, montoPagado: true } });
      const saldo = actual ? actual.montoTotal - actual.montoPagado : 0;
      throw new ConflictError(
        saldo <= 0
          ? "Este mes ya quedó pagado: rechaza el comprobante indicando el motivo."
          : `El monto supera el saldo pendiente (${pesos(saldo)}). Apruébalo por un monto menor o recházalo.`
      );
    }
    await tx.comprobantePago.update({ where: { id: comprobanteId }, data: { pagoId: pago.id } });
    return tx.cobroGastoComun.findUnique({ where: { id: comprobante.cobroId }, select: { montoTotal: true, montoPagado: true, pagado: true } });
  });

  const nombre = nombrePeriodo(comprobante.cobro.periodo.anio, comprobante.cobro.periodo.mes);
  const saldo = resultado ? resultado.montoTotal - resultado.montoPagado : 0;
  await crearNotificacionesMasivas(await idsResidentes(comprobante.cobro.departamentoId), {
    tipo: "GASTO_COMUN",
    titulo: "Pago aprobado",
    mensaje: resultado?.pagado
      ? `La administración aprobó tu pago de ${pesos(monto)}. El gasto común de ${nombre} quedó pagado.`
      : `La administración aprobó tu pago de ${pesos(monto)} del gasto común de ${nombre}. Saldo pendiente: ${pesos(saldo)}.`,
    entidadTipo: "CobroGastoComun",
    entidadId: comprobante.cobroId,
  });

  return { monto, unidad: nombreUnidad(comprobante.cobro.departamento), periodo: nombre, saldo, pagado: Boolean(resultado?.pagado) };
}

export async function rechazarComprobante(condominioId: string, comprobanteId: string, adminId: string, motivo: string) {
  const comprobante = await prisma.comprobantePago.findFirst({
    where: { id: comprobanteId, condominioId },
    select: { monto: true, cobroId: true, cobro: { select: { departamentoId: true, departamento: UNIDAD, periodo: { select: { anio: true, mes: true } } } } },
  });
  if (!comprobante) throw new NotFoundError("Comprobante no encontrado.");

  const { count } = await prisma.comprobantePago.updateMany({
    where: { id: comprobanteId, estado: EstadoComprobante.PENDIENTE },
    data: { estado: EstadoComprobante.RECHAZADO, motivoRechazo: motivo, revisadoPorId: adminId, revisadoEn: new Date() },
  });
  if (count === 0) throw new ConflictError("Este comprobante ya fue revisado.");

  const nombre = nombrePeriodo(comprobante.cobro.periodo.anio, comprobante.cobro.periodo.mes);
  await crearNotificacionesMasivas(await idsResidentes(comprobante.cobro.departamentoId), {
    tipo: "GASTO_COMUN",
    titulo: "Comprobante rechazado",
    mensaje: `La administración rechazó tu comprobante de ${pesos(comprobante.monto)} (gasto común de ${nombre}). Motivo: ${motivo}`,
    entidadTipo: "CobroGastoComun",
    entidadId: comprobante.cobroId,
  });

  return { monto: comprobante.monto, unidad: nombreUnidad(comprobante.cobro.departamento), periodo: nombre };
}

// El archivo, para quien puede verlo: la administracion del condominio o un residente de la unidad.
export async function obtenerArchivoComprobante(condominioId: string, comprobanteId: string, usuario?: { id: string; rol: Rol }) {
  const comprobante = await prisma.comprobantePago.findFirst({
    where: { id: comprobanteId, condominioId },
    select: { archivo: true, cobro: { select: { departamentoId: true } } },
  });
  if (!comprobante) throw new NotFoundError("Comprobante no encontrado.");
  if (usuario && usuario.rol !== Rol.ADMIN) {
    const propio = await prisma.usuario.findFirst({ where: { id: usuario.id, departamentoId: comprobante.cobro.departamentoId }, select: { id: true } });
    if (!propio) throw new NotFoundError("Comprobante no encontrado.");
  }
  return comprobante.archivo;
}

export async function contarComprobantesPendientes(condominioId: string) {
  return prisma.comprobantePago.count({ where: { condominioId, estado: EstadoComprobante.PENDIENTE } });
}
