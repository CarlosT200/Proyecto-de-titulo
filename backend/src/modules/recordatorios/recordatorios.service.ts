import { EstadoEncomienda, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ahoraEnChile } from "../../lib/fechas";
import { fechaLarga, hoyEnChile, nombrePeriodo, pesos } from "../../lib/gastosComunes";
import { ENCOMIENDA_ATRASADA_HORAS, ENCOMIENDA_MUY_ATRASADA_HORAS, HORA_MS } from "../../lib/umbrales";
import { crearNotificacionesMasivas } from "../notificaciones/notificaciones.service";
import { idsResidentes } from "../gastos-comunes/gastos-comunes.service";

// Recordatorios automaticos: gasto comun por vencer y vencido, y encomiendas sin retirar.
// Corre cada hora (ver recordatorios.programador.ts) y cada recordatorio sale UNA sola vez: antes de
// avisar se "reserva" su clave en recordatorios_enviados (indice unico), asi que aunque la tarea corra
// dos veces a la vez o se repita, nadie recibe el mismo aviso dos veces.

const DIA_MS = 24 * HORA_MS;
export const DIAS_AVISO_VENCIMIENTO = 3;
// Un cobro que vencio hace mas de un mes no se recuerda de golpe (por ejemplo, al activar esta funcion).
const DIAS_MAXIMOS_VENCIDO = 30;
// No se envian avisos de noche: los que toquen se envian en la primera vuelta despues de las 9:00.
export const HORA_INICIO = 9;
export const HORA_FIN = 21;

async function reservarClave(clave: string): Promise<boolean> {
  try {
    await prisma.recordatorioEnviado.create({ data: { clave } });
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return false;
    throw error;
  }
}

async function avisar(usuarioIds: string[], data: Parameters<typeof crearNotificacionesMasivas>[1]) {
  try {
    await crearNotificacionesMasivas(usuarioIds, data);
    return true;
  } catch (error) {
    console.error("[recordatorios] No se pudo enviar un aviso:", error);
    return false;
  }
}

export interface ResumenRecordatorios {
  enHorario: boolean;
  gastoPorVencer: number;
  gastoVencido: number;
  encomiendas: number;
}

export async function enviarRecordatorios(instante: Date = new Date()): Promise<ResumenRecordatorios> {
  const resumen: ResumenRecordatorios = { enHorario: true, gastoPorVencer: 0, gastoVencido: 0, encomiendas: 0 };
  const hora = Number(ahoraEnChile(instante).hora.slice(0, 2));
  if (hora < HORA_INICIO || hora >= HORA_FIN) return { ...resumen, enHorario: false };

  const hoy = hoyEnChile(instante);
  const seleccionCobro = {
    id: true,
    departamentoId: true,
    montoTotal: true,
    montoPagado: true,
    periodo: { select: { anio: true, mes: true, fechaVencimiento: true } },
  } as const;

  // 1) Gasto comun que vence en los proximos dias (incluido hoy).
  const porVencer = await prisma.cobroGastoComun.findMany({
    where: { pagado: false, periodo: { fechaVencimiento: { gte: hoy, lte: new Date(hoy.getTime() + DIAS_AVISO_VENCIMIENTO * DIA_MS) } } },
    select: seleccionCobro,
  });
  for (const c of porVencer) {
    const saldo = c.montoTotal - c.montoPagado;
    if (saldo <= 0 || !(await reservarClave(`gasto-por-vencer:${c.id}`))) continue;
    const dias = Math.round((c.periodo.fechaVencimiento.getTime() - hoy.getTime()) / DIA_MS);
    const cuando = dias === 0 ? "hoy" : dias === 1 ? "mañana" : `en ${dias} días`;
    const ok = await avisar(await idsResidentes(c.departamentoId), {
      tipo: "GASTO_COMUN",
      titulo: "Gasto común por vencer",
      mensaje: `El gasto común de ${nombrePeriodo(c.periodo.anio, c.periodo.mes)} vence ${cuando} (${fechaLarga(c.periodo.fechaVencimiento)}). Saldo: ${pesos(saldo)}.`,
      entidadTipo: "CobroGastoComun",
      entidadId: c.id,
    });
    if (ok) resumen.gastoPorVencer++;
  }

  // 2) Gasto comun que ya vencio (un solo aviso por mes vencido).
  const vencidos = await prisma.cobroGastoComun.findMany({
    where: { pagado: false, periodo: { fechaVencimiento: { lt: hoy, gte: new Date(hoy.getTime() - DIAS_MAXIMOS_VENCIDO * DIA_MS) } } },
    select: seleccionCobro,
  });
  for (const c of vencidos) {
    const saldo = c.montoTotal - c.montoPagado;
    if (saldo <= 0 || !(await reservarClave(`gasto-vencido:${c.id}`))) continue;
    const ok = await avisar(await idsResidentes(c.departamentoId), {
      tipo: "GASTO_COMUN",
      titulo: "Gasto común vencido",
      mensaje: `El gasto común de ${nombrePeriodo(c.periodo.anio, c.periodo.mes)} venció el ${fechaLarga(c.periodo.fechaVencimiento)}. Saldo pendiente: ${pesos(saldo)}. Si ya pagaste, informa tu pago con el comprobante.`,
      entidadTipo: "CobroGastoComun",
      entidadId: c.id,
    });
    if (ok) resumen.gastoVencido++;
  }

  // 3) Encomiendas sin retirar: un aviso a las 48 h y otro a las 72 h. Si cuando se revisa ya pasaron
  // las 72 h, se envia solo el segundo (no los dos juntos).
  const encomiendas = await prisma.encomienda.findMany({
    where: { estado: EstadoEncomienda.NOTIFICADA, fechaRecepcion: { lte: new Date(instante.getTime() - ENCOMIENDA_ATRASADA_HORAS * HORA_MS) } },
    select: { id: true, usuarioId: true, remitente: true, ubicacion: true, fechaRecepcion: true },
  });
  for (const e of encomiendas) {
    const horas = (instante.getTime() - e.fechaRecepcion.getTime()) / HORA_MS;
    const muyAtrasada = horas >= ENCOMIENDA_MUY_ATRASADA_HORAS;
    if (muyAtrasada) {
      if (!(await reservarClave(`encomienda-72h:${e.id}`))) continue;
      await reservarClave(`encomienda-48h:${e.id}`);
    } else if (!(await reservarClave(`encomienda-48h:${e.id}`))) {
      continue;
    }
    const de = e.remitente ? ` de ${e.remitente}` : "";
    const donde = e.ubicacion ? ` (${e.ubicacion})` : "";
    const ok = await avisar([e.usuarioId], {
      tipo: "ENCOMIENDA",
      titulo: muyAtrasada ? "Encomienda sin retirar hace más de 3 días" : "Encomienda por retirar",
      mensaje: `Tu encomienda${de} lleva más de ${muyAtrasada ? "3" : "2"} días en conserjería${donde}. Pasa a retirarla cuando puedas.`,
      entidadTipo: "Encomienda",
      entidadId: e.id,
    });
    if (ok) resumen.encomiendas++;
  }

  return resumen;
}
