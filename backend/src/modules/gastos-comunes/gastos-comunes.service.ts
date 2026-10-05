import { randomUUID } from "crypto";
import { MedioPago, MetodoProrrateo, Prisma, Rol } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError, ConflictError, NotFoundError } from "../../lib/errors";
import { crearNotificacionesMasivas } from "../notificaciones/notificaciones.service";
import {
  TOLERANCIA_ALICUOTAS,
  estadoCobro,
  fechaLarga,
  hoyEnChile,
  nombrePeriodo,
  nombreUnidad,
  pesos,
  recargoFondoReserva,
  repartirMonto,
} from "../../lib/gastosComunes";

const UNIDAD = { select: { id: true, numero: true, torre: { select: { nombre: true } } } } as const;
const RESIDENTES_ACTIVOS = {
  where: { activo: true, rol: Rol.RESIDENTE },
  select: { id: true, nombre: true, apellido: true },
  orderBy: { nombre: "asc" },
} as const;

type Unidad = { numero: string; torre: { nombre: string } | null };

// Torre A 101, Torre A 102, Torre B 201... (los numeros se comparan como numeros: 2 antes que 10)
function compararUnidades(a: Unidad, b: Unidad) {
  return (
    (a.torre?.nombre ?? "").localeCompare(b.torre?.nombre ?? "", "es", { numeric: true }) ||
    a.numero.localeCompare(b.numero, "es", { numeric: true })
  );
}

function aFecha(valor: string) {
  return new Date(`${valor}T00:00:00.000Z`);
}

async function idsResidentes(departamentoId: string) {
  const residentes = await prisma.usuario.findMany({
    where: { departamentoId, activo: true, rol: Rol.RESIDENTE },
    select: { id: true },
  });
  return residentes.map((r) => r.id);
}

// ------------------------------------------------------------------
// Administracion
// ------------------------------------------------------------------

export async function listarPeriodos(condominioId: string, instante: Date = new Date()) {
  const hoy = hoyEnChile(instante);
  const [periodos, totales, pagados] = await Promise.all([
    prisma.periodoGastoComun.findMany({
      where: { condominioId },
      orderBy: [{ anio: "desc" }, { mes: "desc" }],
      select: {
        id: true,
        anio: true,
        mes: true,
        fechaVencimiento: true,
        metodoProrrateo: true,
        porcentajeFondoReserva: true,
        totalGastos: true,
        instruccionesPago: true,
        createdAt: true,
      },
    }),
    prisma.cobroGastoComun.groupBy({
      by: ["periodoId"],
      where: { condominioId },
      _sum: { montoTotal: true, montoPagado: true },
      _count: { _all: true },
    }),
    prisma.cobroGastoComun.groupBy({ by: ["periodoId"], where: { condominioId, pagado: true }, _count: { _all: true } }),
  ]);

  return periodos.map((p) => {
    const t = totales.find((x) => x.periodoId === p.id);
    return {
      ...p,
      totalCobrado: t?._sum.montoTotal ?? 0,
      totalPagado: t?._sum.montoPagado ?? 0,
      unidades: t?._count._all ?? 0,
      unidadesPagadas: pagados.find((x) => x.periodoId === p.id)?._count._all ?? 0,
      vencido: p.fechaVencimiento.getTime() < hoy.getTime(),
    };
  });
}

export async function obtenerPeriodo(condominioId: string, periodoId: string, instante: Date = new Date()) {
  const hoy = hoyEnChile(instante);
  const periodo = await prisma.periodoGastoComun.findFirst({
    where: { id: periodoId, condominioId },
    include: {
      partidas: { orderBy: { orden: "asc" }, select: { id: true, concepto: true, monto: true } },
      cobros: {
        include: { departamento: { select: { ...UNIDAD.select, residentes: RESIDENTES_ACTIVOS } } },
      },
    },
  });
  if (!periodo) throw new NotFoundError("Cobro de gastos comunes no encontrado.");

  const pagosVigentes = await prisma.pagoGastoComun.count({ where: { cobro: { periodoId }, anuladoEn: null } });

  const { cobros, ...resto } = periodo;
  return {
    ...resto,
    puedeEliminar: pagosVigentes === 0,
    cobros: cobros
      .sort((a, b) => compararUnidades(a.departamento, b.departamento))
      .map((c) => ({
        id: c.id,
        departamento: c.departamento,
        montoGastoComun: c.montoGastoComun,
        montoFondoReserva: c.montoFondoReserva,
        montoTotal: c.montoTotal,
        montoPagado: c.montoPagado,
        saldo: c.montoTotal - c.montoPagado,
        estado: estadoCobro(c.pagado, periodo.fechaVencimiento, hoy),
      })),
  };
}

export interface DatosPeriodo {
  anio: number;
  mes: number;
  fechaVencimiento: string;
  metodoProrrateo: MetodoProrrateo;
  porcentajeFondoReserva: number;
  partidas: { concepto: string; monto: number }[];
  instruccionesPago?: string;
}

// Emite el cobro del mes: guarda el detalle de gastos y crea un cobro por cada unidad del condominio.
export async function crearPeriodo(condominioId: string, creadoPorId: string, data: DatosPeriodo, instante: Date = new Date()) {
  const nombre = nombrePeriodo(data.anio, data.mes);
  const vencimiento = aFecha(data.fechaVencimiento);
  if (vencimiento.getTime() < hoyEnChile(instante).getTime()) {
    throw new AppError("La fecha de vencimiento no puede ser anterior a hoy.", 422);
  }

  const existente = await prisma.periodoGastoComun.findFirst({
    where: { condominioId, anio: data.anio, mes: data.mes },
    select: { id: true },
  });
  if (existente) throw new ConflictError(`Ya se emitió el cobro de ${nombre}.`);

  const departamentos = await prisma.departamento.findMany({
    where: { condominioId },
    select: { id: true, numero: true, alicuota: true, torre: { select: { nombre: true } } },
  });
  if (departamentos.length === 0) {
    throw new AppError("El condominio no tiene unidades registradas. Agrégalas en Condominio antes de emitir un cobro.", 422);
  }

  let pesosReparto: number[];
  if (data.metodoProrrateo === MetodoProrrateo.ALICUOTA) {
    const sinAlicuota = departamentos.filter((d) => d.alicuota === null || Number(d.alicuota) <= 0).length;
    if (sinAlicuota > 0) {
      throw new AppError(
        `${sinAlicuota === 1 ? "Falta la alícuota de 1 unidad" : `Faltan las alícuotas de ${sinAlicuota} unidades`}. Complétalas en "Alícuotas" o reparte en partes iguales.`,
        422
      );
    }
    pesosReparto = departamentos.map((d) => Number(d.alicuota));
    const suma = pesosReparto.reduce((a, b) => a + b, 0);
    if (Math.abs(suma - 100) > TOLERANCIA_ALICUOTAS) {
      throw new AppError(
        `Las alícuotas suman ${suma.toLocaleString("es-CL", { maximumFractionDigits: 4 })} % y deben sumar 100 %. Corrígelas en "Alícuotas".`,
        422
      );
    }
  } else {
    pesosReparto = departamentos.map(() => 1);
  }

  const totalGastos = data.partidas.reduce((s, p) => s + p.monto, 0);
  const gastoPorUnidad = repartirMonto(totalGastos, pesosReparto);
  const cobros = departamentos.map((d, i) => {
    const fondo = recargoFondoReserva(gastoPorUnidad[i], data.porcentajeFondoReserva);
    return {
      id: randomUUID(),
      condominioId,
      departamentoId: d.id,
      montoGastoComun: gastoPorUnidad[i],
      montoFondoReserva: fondo,
      montoTotal: gastoPorUnidad[i] + fondo,
    };
  });

  const periodoId = randomUUID();
  try {
    await prisma.$transaction([
      prisma.periodoGastoComun.create({
        data: {
          id: periodoId,
          condominioId,
          anio: data.anio,
          mes: data.mes,
          fechaVencimiento: vencimiento,
          metodoProrrateo: data.metodoProrrateo,
          porcentajeFondoReserva: data.porcentajeFondoReserva,
          totalGastos,
          instruccionesPago: data.instruccionesPago,
          creadoPorId,
          partidas: { createMany: { data: data.partidas.map((p, orden) => ({ concepto: p.concepto, monto: p.monto, orden })) } },
        },
      }),
      prisma.cobroGastoComun.createMany({ data: cobros.map((c) => ({ ...c, periodoId })) }),
    ]);
  } catch (error) {
    // Dos administradores emitiendo el mismo mes a la vez: el indice unico deja pasar solo a uno.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError(`Ya se emitió el cobro de ${nombre}.`);
    }
    throw error;
  }

  // Aviso a los residentes de cada unidad con el monto que les toca. Un fallo al avisar no deshace
  // el cobro (ya quedo guardado).
  for (const cobro of cobros) {
    try {
      const residentes = await idsResidentes(cobro.departamentoId);
      await crearNotificacionesMasivas(residentes, {
        tipo: "GASTO_COMUN",
        titulo: `Gasto común de ${nombre}`,
        mensaje: `A tu unidad le corresponden ${pesos(cobro.montoTotal)}, con vencimiento el ${fechaLarga(vencimiento)}.`,
        entidadTipo: "CobroGastoComun",
        entidadId: cobro.id,
      });
    } catch (error) {
      console.error("[gastos-comunes] No se pudo avisar a una unidad:", error);
    }
  }

  return {
    id: periodoId,
    nombre,
    unidades: cobros.length,
    totalCobrado: cobros.reduce((s, c) => s + c.montoTotal, 0),
  };
}

// Solo mientras no haya pagos vigentes (si un pago se registro por error, primero se anula).
export async function eliminarPeriodo(condominioId: string, periodoId: string) {
  const periodo = await prisma.periodoGastoComun.findFirst({
    where: { id: periodoId, condominioId },
    select: { anio: true, mes: true, cobros: { select: { id: true, departamentoId: true } } },
  });
  if (!periodo) throw new NotFoundError("Cobro de gastos comunes no encontrado.");
  const nombre = nombrePeriodo(periodo.anio, periodo.mes);

  // La condicion va en el mismo DELETE: si alguien registra un pago justo ahora, no se borra.
  const { count } = await prisma.periodoGastoComun.deleteMany({
    where: { id: periodoId, condominioId, cobros: { none: { pagos: { some: { anuladoEn: null } } } } },
  });
  if (count === 0) {
    throw new ConflictError(`No se puede eliminar el cobro de ${nombre} porque tiene pagos registrados. Anula esos pagos primero.`);
  }

  // Los avisos del cobro eliminado ya no llevan a ninguna parte: se reemplazan por uno que lo explica.
  const cobroIds = periodo.cobros.map((c) => c.id);
  await prisma.notificacion.deleteMany({ where: { entidadTipo: "CobroGastoComun", entidadId: { in: cobroIds } } });
  const residentes = await prisma.usuario.findMany({
    where: { departamentoId: { in: periodo.cobros.map((c) => c.departamentoId) }, activo: true, rol: Rol.RESIDENTE },
    select: { id: true },
  });
  await crearNotificacionesMasivas(
    residentes.map((r) => r.id),
    {
      tipo: "GASTO_COMUN",
      titulo: `Cobro de ${nombre} eliminado`,
      mensaje: `La administración eliminó el cobro de gastos comunes de ${nombre}. Si corresponde, se emitirá uno nuevo.`,
    }
  );

  return { nombre };
}

// Unidades con cobros vencidos sin pagar, de la que mas debe a la que menos.
export async function listarMorosidad(condominioId: string, instante: Date = new Date()) {
  const hoy = hoyEnChile(instante);
  const cobros = await prisma.cobroGastoComun.findMany({
    where: { condominioId, pagado: false, periodo: { fechaVencimiento: { lt: hoy } } },
    select: {
      id: true,
      montoTotal: true,
      montoPagado: true,
      periodo: { select: { id: true, anio: true, mes: true, fechaVencimiento: true } },
      departamento: { select: { ...UNIDAD.select, residentes: RESIDENTES_ACTIVOS } },
    },
    orderBy: [{ periodo: { anio: "asc" } }, { periodo: { mes: "asc" } }],
  });

  const porUnidad = new Map<
    string,
    {
      departamento: (typeof cobros)[number]["departamento"];
      deuda: number;
      cobros: { id: string; periodo: (typeof cobros)[number]["periodo"]; saldo: number }[];
    }
  >();
  for (const c of cobros) {
    const saldo = c.montoTotal - c.montoPagado;
    const fila = porUnidad.get(c.departamento.id) ?? { departamento: c.departamento, deuda: 0, cobros: [] };
    fila.deuda += saldo;
    fila.cobros.push({ id: c.id, periodo: c.periodo, saldo });
    porUnidad.set(c.departamento.id, fila);
  }
  return [...porUnidad.values()].sort((a, b) => b.deuda - a.deuda || compararUnidades(a.departamento, b.departamento));
}

export async function registrarPago(
  condominioId: string,
  cobroId: string,
  registradoPorId: string,
  data: { monto: number; fechaPago: string; medio: MedioPago; referencia?: string },
  instante: Date = new Date()
) {
  const cobro = await prisma.cobroGastoComun.findFirst({
    where: { id: cobroId, condominioId },
    select: { id: true, departamentoId: true, departamento: UNIDAD, periodo: { select: { anio: true, mes: true } } },
  });
  if (!cobro) throw new NotFoundError("Cobro de gastos comunes no encontrado.");

  const fechaPago = aFecha(data.fechaPago);
  if (fechaPago.getTime() > hoyEnChile(instante).getTime()) {
    throw new AppError("La fecha de pago no puede ser posterior a hoy.", 422);
  }

  // Suma el pago solo si no supera el saldo, en la misma sentencia: dos registros simultaneos del
  // mismo pago no pueden dejar el cobro pagado de mas.
  const resultado = await prisma.$transaction(async (tx) => {
    const filas = await tx.$executeRaw`
      UPDATE "cobros_gasto_comun"
      SET "montoPagado" = "montoPagado" + ${data.monto},
          "pagado" = ("montoPagado" + ${data.monto} >= "montoTotal"),
          "updatedAt" = NOW()
      WHERE "id" = ${cobroId} AND "montoPagado" + ${data.monto} <= "montoTotal"`;
    if (filas === 0) return null;
    await tx.pagoGastoComun.create({
      data: { cobroId, monto: data.monto, fechaPago, medio: data.medio, referencia: data.referencia, registradoPorId },
    });
    return tx.cobroGastoComun.findUnique({ where: { id: cobroId }, select: { montoTotal: true, montoPagado: true, pagado: true } });
  });

  if (!resultado) {
    const actual = await prisma.cobroGastoComun.findUnique({ where: { id: cobroId }, select: { montoTotal: true, montoPagado: true } });
    const saldo = actual ? actual.montoTotal - actual.montoPagado : 0;
    throw new ConflictError(
      saldo <= 0 ? "Este cobro ya está pagado." : `El monto supera el saldo pendiente de esta unidad (${pesos(saldo)}).`
    );
  }

  const nombre = nombrePeriodo(cobro.periodo.anio, cobro.periodo.mes);
  const saldo = resultado.montoTotal - resultado.montoPagado;
  await crearNotificacionesMasivas(await idsResidentes(cobro.departamentoId), {
    tipo: "GASTO_COMUN",
    titulo: "Pago registrado",
    mensaje: resultado.pagado
      ? `Se registró un pago de ${pesos(data.monto)}. El gasto común de ${nombre} quedó pagado.`
      : `Se registró un pago de ${pesos(data.monto)} del gasto común de ${nombre}. Saldo pendiente: ${pesos(saldo)}.`,
    entidadTipo: "CobroGastoComun",
    entidadId: cobroId,
  });

  return { unidad: nombreUnidad(cobro.departamento), periodo: nombre, saldo, pagado: resultado.pagado };
}

// Un pago registrado por error no se borra: se anula con un motivo y el saldo vuelve a quedar pendiente.
export async function anularPago(condominioId: string, pagoId: string, anuladoPorId: string, motivo: string) {
  const pago = await prisma.pagoGastoComun.findFirst({
    where: { id: pagoId, cobro: { condominioId } },
    select: {
      id: true,
      monto: true,
      cobroId: true,
      cobro: { select: { departamentoId: true, departamento: UNIDAD, periodo: { select: { anio: true, mes: true } } } },
    },
  });
  if (!pago) throw new NotFoundError("Pago no encontrado.");

  const anulado = await prisma.$transaction(async (tx) => {
    const { count } = await tx.pagoGastoComun.updateMany({
      where: { id: pagoId, anuladoEn: null },
      data: { anuladoEn: new Date(), motivoAnulacion: motivo, anuladoPorId },
    });
    if (count === 0) return false;
    await tx.$executeRaw`
      UPDATE "cobros_gasto_comun"
      SET "montoPagado" = "montoPagado" - ${pago.monto},
          "pagado" = ("montoPagado" - ${pago.monto} >= "montoTotal"),
          "updatedAt" = NOW()
      WHERE "id" = ${pago.cobroId}`;
    return true;
  });
  if (!anulado) throw new ConflictError("Este pago ya estaba anulado.");

  const nombre = nombrePeriodo(pago.cobro.periodo.anio, pago.cobro.periodo.mes);
  await crearNotificacionesMasivas(await idsResidentes(pago.cobro.departamentoId), {
    tipo: "GASTO_COMUN",
    titulo: "Pago anulado",
    mensaje: `Se anuló un pago de ${pesos(pago.monto)} del gasto común de ${nombre}. Motivo: ${motivo}`,
    entidadTipo: "CobroGastoComun",
    entidadId: pago.cobroId,
  });

  return { monto: pago.monto, unidad: nombreUnidad(pago.cobro.departamento), periodo: nombre };
}

export async function listarAlicuotas(condominioId: string) {
  const departamentos = await prisma.departamento.findMany({
    where: { condominioId },
    select: { id: true, numero: true, alicuota: true, torre: { select: { nombre: true } } },
  });
  const unidades = departamentos
    .sort(compararUnidades)
    .map((d) => ({ id: d.id, numero: d.numero, torre: d.torre, alicuota: d.alicuota === null ? null : Number(d.alicuota) }));
  const suma = unidades.reduce((s, u) => s + (u.alicuota ?? 0), 0);
  return { unidades, suma: Math.round(suma * 10000) / 10000 };
}

export async function guardarAlicuotas(
  condominioId: string,
  alicuotas: { departamentoId: string; alicuota: number | null }[]
) {
  const ids = new Set(alicuotas.map((a) => a.departamentoId));
  if (ids.size !== alicuotas.length) throw new AppError("Hay unidades repetidas en el envío.", 422);

  const propias = await prisma.departamento.count({ where: { condominioId, id: { in: [...ids] } } });
  if (propias !== ids.size) throw new NotFoundError("Una de las unidades no pertenece a este condominio.");

  await prisma.$transaction(
    alicuotas.map((a) =>
      prisma.departamento.update({
        where: { id: a.departamentoId },
        data: { alicuota: a.alicuota === null ? null : Math.round(a.alicuota * 10000) / 10000 },
      })
    )
  );
  return listarAlicuotas(condominioId);
}

// ------------------------------------------------------------------
// Residente y detalle compartido
// ------------------------------------------------------------------

export async function obtenerMiCuenta(usuarioId: string, instante: Date = new Date()) {
  const hoy = hoyEnChile(instante);
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { departamento: UNIDAD },
  });
  if (!usuario?.departamento) {
    return { unidad: null, saldoPendiente: 0, deudaVencida: 0, cobrosVencidos: 0, proximoVencimiento: null, instruccionesPago: null, cobros: [] };
  }

  const registros = await prisma.cobroGastoComun.findMany({
    where: { departamentoId: usuario.departamento.id },
    select: {
      id: true,
      montoTotal: true,
      montoPagado: true,
      pagado: true,
      periodo: { select: { anio: true, mes: true, fechaVencimiento: true, instruccionesPago: true } },
    },
    orderBy: [{ periodo: { anio: "desc" } }, { periodo: { mes: "desc" } }],
  });

  const cobros = registros.map(({ periodo, pagado, ...c }) => ({
    ...c,
    periodo: { anio: periodo.anio, mes: periodo.mes, fechaVencimiento: periodo.fechaVencimiento },
    saldo: c.montoTotal - c.montoPagado,
    estado: estadoCobro(pagado, periodo.fechaVencimiento, hoy),
  }));
  const vencidos = cobros.filter((c) => c.estado === "VENCIDO");
  const pendientes = cobros.filter((c) => c.estado === "PENDIENTE");
  const proximo = pendientes.reduce<Date | null>(
    (min, c) => (min === null || c.periodo.fechaVencimiento < min ? c.periodo.fechaVencimiento : min),
    null
  );

  return {
    unidad: usuario.departamento,
    saldoPendiente: cobros.reduce((s, c) => s + c.saldo, 0),
    deudaVencida: vencidos.reduce((s, c) => s + c.saldo, 0),
    cobrosVencidos: vencidos.length,
    proximoVencimiento: proximo,
    instruccionesPago: registros[0]?.periodo.instruccionesPago ?? null,
    cobros,
  };
}

// Detalle de un cobro: la administracion ve cualquiera de su condominio; un residente, solo los de su unidad.
export async function obtenerCobro(
  condominioId: string,
  cobroId: string,
  usuario: { id: string; rol: Rol },
  instante: Date = new Date()
) {
  const hoy = hoyEnChile(instante);
  const esAdmin = usuario.rol === Rol.ADMIN;
  const cobro = await prisma.cobroGastoComun.findFirst({
    where: { id: cobroId, condominioId },
    include: {
      departamento: { select: { ...UNIDAD.select, ...(esAdmin ? { residentes: RESIDENTES_ACTIVOS } : {}) } },
      periodo: {
        select: {
          id: true,
          anio: true,
          mes: true,
          fechaVencimiento: true,
          metodoProrrateo: true,
          porcentajeFondoReserva: true,
          totalGastos: true,
          instruccionesPago: true,
          partidas: { orderBy: { orden: "asc" }, select: { id: true, concepto: true, monto: true } },
        },
      },
      pagos: {
        orderBy: [{ fechaPago: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          monto: true,
          fechaPago: true,
          medio: true,
          referencia: true,
          anuladoEn: true,
          motivoAnulacion: true,
          createdAt: true,
          ...(esAdmin
            ? {
                registradoPor: { select: { nombre: true, apellido: true } },
                anuladoPor: { select: { nombre: true, apellido: true } },
              }
            : {}),
        },
      },
    },
  });
  if (!cobro) throw new NotFoundError("Cobro de gastos comunes no encontrado.");

  if (!esAdmin) {
    const propio = await prisma.usuario.findFirst({
      where: { id: usuario.id, departamentoId: cobro.departamentoId },
      select: { id: true },
    });
    if (!propio) throw new NotFoundError("Cobro de gastos comunes no encontrado.");
  }

  const { pagado, ...resto } = cobro;
  return {
    ...resto,
    saldo: cobro.montoTotal - cobro.montoPagado,
    estado: estadoCobro(pagado, cobro.periodo.fechaVencimiento, hoy),
  };
}
