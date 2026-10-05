import { EstadoEncomienda, Prisma, Rol } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ConflictError, ForbiddenError, NotFoundError } from "../../lib/errors";
import { horaEnChile } from "../../lib/fechas";
import { crearNotificacion } from "../notificaciones/notificaciones.service";

// Campos de una encomienda SIN la foto: la foto se guarda en base64 (decenas de KB) y solo viaja
// cuando alguien abre el detalle (obtenerEncomienda).
const CAMPOS = {
  id: true,
  condominioId: true,
  usuarioId: true,
  registradaPorId: true,
  remitente: true,
  numeroSeguimiento: true,
  ubicacion: true,
  observaciones: true,
  estado: true,
  fechaRecepcion: true,
  fechaRetiro: true,
  retiradaPor: true,
  fechaDevolucion: true,
  motivoDevolucion: true,
  cerradaPorId: true,
} satisfies Prisma.EncomiendaSelect;

const PERSONA = { select: { id: true, nombre: true, apellido: true } } as const;
const RESIDENTE = {
  select: { id: true, nombre: true, apellido: true, departamento: { select: { numero: true, torre: { select: { nombre: true } } } } },
} as const;

const CAMPOS_CON_PERSONAS = {
  ...CAMPOS,
  usuario: RESIDENTE,
  registradaPor: PERSONA,
  cerradaPor: PERSONA,
} satisfies Prisma.EncomiendaSelect;

// Marca cuales tienen foto sin traer las fotos (una consulta liviana extra).
async function conMarcaDeFoto<T extends { id: string }>(encomiendas: T[]): Promise<(T & { tieneFoto: boolean })[]> {
  if (encomiendas.length === 0) return [];
  const conFoto = await prisma.encomienda.findMany({
    where: { id: { in: encomiendas.map((e) => e.id) }, fotoUrl: { not: null } },
    select: { id: true },
  });
  const ids = new Set(conFoto.map((e) => e.id));
  return encomiendas.map((e) => ({ ...e, tieneFoto: ids.has(e.id) }));
}

function deRemitente(remitente: string | null | undefined): string {
  return remitente ? ` de ${remitente}` : "";
}

function conPuntoFinal(texto: string): string {
  return /[.!?…]$/.test(texto) ? texto : `${texto}.`;
}

// HU-12: registrar encomienda. HU-13: notificar al residente automaticamente.
export async function crearEncomienda(
  condominioId: string,
  registradaPorId: string,
  data: {
    usuarioId: string;
    remitente?: string;
    numeroSeguimiento?: string;
    ubicacion?: string;
    observaciones?: string;
    fotoUrl?: string;
  }
) {
  const residente = await prisma.usuario.findFirst({
    where: { id: data.usuarioId, condominioId, rol: Rol.RESIDENTE, activo: true },
    select: { id: true, nombre: true, apellido: true },
  });
  if (!residente) throw new NotFoundError("Residente no encontrado en este condominio.");

  const encomienda = await prisma.encomienda.create({
    data: {
      condominioId,
      registradaPorId,
      usuarioId: data.usuarioId,
      remitente: data.remitente,
      numeroSeguimiento: data.numeroSeguimiento,
      ubicacion: data.ubicacion,
      observaciones: data.observaciones,
      fotoUrl: data.fotoUrl,
      estado: EstadoEncomienda.NOTIFICADA,
    },
    select: CAMPOS_CON_PERSONAS,
  });

  const lugar = data.ubicacion ? ` (${data.ubicacion})` : "";
  await crearNotificacion({
    usuarioId: data.usuarioId,
    tipo: "ENCOMIENDA",
    titulo: "Nueva encomienda",
    mensaje: `Llegó una encomienda${deRemitente(data.remitente)} a las ${horaEnChile(encomienda.fechaRecepcion)}. Retírala en conserjería${lugar}.`,
    entidadTipo: "Encomienda",
    entidadId: encomienda.id,
  });

  return { ...encomienda, tieneFoto: Boolean(data.fotoUrl) };
}

export async function listarMisEncomiendas(usuarioId: string) {
  const encomiendas = await prisma.encomienda.findMany({
    where: { usuarioId },
    select: { ...CAMPOS, cerradaPor: PERSONA },
    orderBy: { fechaRecepcion: "desc" },
  });
  return conMarcaDeFoto(encomiendas);
}

export async function listarEncomiendasCondominio(condominioId: string, filtros: { estado?: EstadoEncomienda }) {
  const encomiendas = await prisma.encomienda.findMany({
    where: { condominioId, estado: filtros.estado },
    select: CAMPOS_CON_PERSONAS,
    orderBy: { fechaRecepcion: "desc" },
  });
  return conMarcaDeFoto(encomiendas);
}

// Detalle completo (con foto). Un residente solo puede ver las suyas.
export async function obtenerEncomienda(
  condominioId: string,
  encomiendaId: string,
  solicitante: { id: string; rol: Rol }
) {
  const encomienda = await prisma.encomienda.findFirst({
    where: { id: encomiendaId, condominioId },
    select: { ...CAMPOS_CON_PERSONAS, fotoUrl: true },
  });
  if (!encomienda) throw new NotFoundError("Encomienda no encontrada.");
  if (solicitante.rol === Rol.RESIDENTE && encomienda.usuarioId !== solicitante.id) {
    throw new ForbiddenError("Solo puedes ver tus propias encomiendas.");
  }
  return { ...encomienda, tieneFoto: Boolean(encomienda.fotoUrl) };
}

// Si una encomienda ya no esta pendiente, explica por que no se puede entregar ni devolver.
async function errorSiNoEstaPendiente(condominioId: string, encomiendaId: string): Promise<never> {
  const actual = await prisma.encomienda.findFirst({
    where: { id: encomiendaId, condominioId },
    select: { estado: true, retiradaPor: true },
  });
  if (!actual) throw new NotFoundError("Encomienda no encontrada.");
  if (actual.estado === EstadoEncomienda.RETIRADA) {
    throw new ConflictError(`Esta encomienda ya fue entregada${actual.retiradaPor ? ` a ${actual.retiradaPor}` : ""}.`);
  }
  throw new ConflictError("Esta encomienda ya fue devuelta al remitente.");
}

// HU-14: entregar al residente (o a quien el residente envie a retirarla).
// El cambio de estado es atomico: dos clics o dos conserjes a la vez no pueden registrar dos retiros.
export async function entregarEncomienda(
  condominioId: string,
  encomiendaId: string,
  cerradaPorId: string,
  retiradaPor?: string
) {
  const encomienda = await prisma.encomienda.findFirst({
    where: { id: encomiendaId, condominioId },
    select: { id: true, usuarioId: true, remitente: true, usuario: { select: { nombre: true, apellido: true } } },
  });
  if (!encomienda) throw new NotFoundError("Encomienda no encontrada.");

  const quien = retiradaPor ?? `${encomienda.usuario.nombre} ${encomienda.usuario.apellido}`;
  const ahora = new Date();
  const { count } = await prisma.encomienda.updateMany({
    where: { id: encomiendaId, condominioId, estado: EstadoEncomienda.NOTIFICADA },
    data: { estado: EstadoEncomienda.RETIRADA, fechaRetiro: ahora, retiradaPor: quien, cerradaPorId },
  });
  if (count === 0) return errorSiNoEstaPendiente(condominioId, encomiendaId);

  await crearNotificacion({
    usuarioId: encomienda.usuarioId,
    tipo: "ENCOMIENDA",
    titulo: "Encomienda entregada",
    mensaje: `Tu encomienda${deRemitente(encomienda.remitente)} fue entregada a ${quien} a las ${horaEnChile(ahora)}.`,
    entidadTipo: "Encomienda",
    entidadId: encomienda.id,
  });

  return obtenerEncomiendaSinFoto(condominioId, encomiendaId);
}

// Devolver al remitente o a la empresa de despacho (por ejemplo, tras varios dias sin retirar).
export async function devolverEncomienda(condominioId: string, encomiendaId: string, cerradaPorId: string, motivo: string) {
  const encomienda = await prisma.encomienda.findFirst({
    where: { id: encomiendaId, condominioId },
    select: { id: true, usuarioId: true, remitente: true },
  });
  if (!encomienda) throw new NotFoundError("Encomienda no encontrada.");

  const { count } = await prisma.encomienda.updateMany({
    where: { id: encomiendaId, condominioId, estado: EstadoEncomienda.NOTIFICADA },
    data: { estado: EstadoEncomienda.DEVUELTA, fechaDevolucion: new Date(), motivoDevolucion: motivo, cerradaPorId },
  });
  if (count === 0) return errorSiNoEstaPendiente(condominioId, encomiendaId);

  await crearNotificacion({
    usuarioId: encomienda.usuarioId,
    tipo: "ENCOMIENDA",
    titulo: "Encomienda devuelta",
    mensaje: `Tu encomienda${deRemitente(encomienda.remitente)} fue devuelta al remitente. Motivo: ${conPuntoFinal(motivo)}`,
    entidadTipo: "Encomienda",
    entidadId: encomienda.id,
  });

  return obtenerEncomiendaSinFoto(condominioId, encomiendaId);
}

async function obtenerEncomiendaSinFoto(condominioId: string, encomiendaId: string) {
  const encomienda = await prisma.encomienda.findFirst({
    where: { id: encomiendaId, condominioId },
    select: CAMPOS_CON_PERSONAS,
  });
  if (!encomienda) throw new NotFoundError("Encomienda no encontrada.");
  const [conMarca] = await conMarcaDeFoto([encomienda]);
  return conMarca;
}
