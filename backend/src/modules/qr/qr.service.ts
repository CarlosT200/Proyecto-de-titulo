import { randomUUID } from "node:crypto";
import QRCode from "qrcode";
import sharp from "sharp";
import { EstadoVisita, ResultadoAcceso, TipoQrToken } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { esCodigoManual, esTokenCorto, normalizarCodigoManual, nuevoCodigoManual, nuevoTokenQr, verifyQrToken } from "../../lib/qrToken";
import { ConflictError, NotFoundError } from "../../lib/errors";
import { env } from "../../config/env";
import { QR_LOGO_SVG } from "../../lib/qrLogo";

const VIGENCIA_QR_RESIDENTE_HORAS = 24;
// Pixeles por modulo del QR (entero, para que los bordes salgan nitidos: con un ancho fijo cada
// modulo medía 3,7 px con bordes borrosos). El codigo es corto (22 caracteres), asi que el QR es
// de ~41 modulos y la imagen de ~390 px.
const PIXELES_POR_MODULO = 8;
// ~18% del ancho del QR (~3% del area): el logo se nota y queda muy por debajo del 25% que
// tolera la correccion de errores "Q".
const LOGO_PROPORCION = 0.18;

// El QR codifica un link real (no solo el token en texto plano) para que
// cualquier camara de celular lo reconozca como algo abrible, en vez de
// mostrar "texto raro" sin accion. La pagina /acceso/:token valida solo si
// quien la abre esta autenticado como conserje; para cualquier otra persona
// (el propio residente viendo su QR, o la visita) muestra un mensaje simple.
function urlAcceso(token: string): string {
  return `${env.appUrl}/acceso/${encodeURIComponent(token)}`;
}

// Correccion de errores "Q" (hasta ~25% del area) porque se le superpone el logo al centro; "H"
// obligaba a un QR mucho mas denso. Margen de 4 modulos: es la zona blanca que exige el estandar
// (con 1 modulo, el lector confundia el borde del QR con el fondo de la pantalla).
async function generarImagenQr(token: string): Promise<string> {
  const qrBuffer = await QRCode.toBuffer(urlAcceso(token), {
    errorCorrectionLevel: "Q",
    margin: 4,
    scale: PIXELES_POR_MODULO,
  });
  const { width: qrAncho = 0 } = await sharp(qrBuffer).metadata();

  const logoLado = Math.round(qrAncho * LOGO_PROPORCION);
  const logoBuffer = await sharp(Buffer.from(QR_LOGO_SVG)).resize(logoLado, logoLado).png().toBuffer();

  const compuesto = await sharp(qrBuffer)
    .composite([{ input: logoBuffer, gravity: "center" }])
    .png()
    .toBuffer();

  return `data:image/png;base64,${compuesto.toString("base64")}`;
}

// Genera un codigo manual que no choque con otro ya guardado (indice unico). En la practica
// siempre acierta al primer intento; el bucle es un resguardo.
async function codigoManualUnico(): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const codigo = nuevoCodigoManual();
    const existe = await prisma.qrToken.findUnique({ where: { codigoManual: codigo }, select: { id: true } });
    if (!existe) return codigo;
  }
  return nuevoCodigoManual();
}

// HU-17: generar QR de residente. El token es un JWT sin datos personales, con expiracion (RNF-08, RNF-09).
export async function generarQrResidente(condominioId: string, usuarioId: string) {
  await prisma.qrToken.updateMany({
    where: { usuarioId, tipo: TipoQrToken.RESIDENTE, revocado: false },
    data: { revocado: true },
  });

  const expiraEn = new Date(Date.now() + VIGENCIA_QR_RESIDENTE_HORAS * 60 * 60 * 1000);
  const id = randomUUID();
  const token = nuevoTokenQr();
  const codigoManual = await codigoManualUnico();
  await prisma.qrToken.create({
    data: { id, tipo: TipoQrToken.RESIDENTE, usuarioId, expiraEn, token, codigoManual },
  });

  return { qrDataUrl: await generarImagenQr(token), expiraEn, codigoManual };
}

// HU-19: registrar visita.
export async function crearVisita(
  condominioId: string,
  residenteId: string,
  data: {
    nombreVisita: string;
    fecha: string;
    periodoInicio: string;
    periodoFin: string;
    observaciones?: string;
    soloUnUso: boolean;
  }
) {
  return prisma.visita.create({
    data: {
      condominioId,
      residenteId,
      nombreVisita: data.nombreVisita,
      fecha: new Date(data.fecha),
      periodoInicio: new Date(data.periodoInicio),
      periodoFin: new Date(data.periodoFin),
      observaciones: data.observaciones,
      soloUnUso: data.soloUnUso,
    },
  });
}

export async function listarMisVisitas(residenteId: string) {
  return prisma.visita.findMany({
    where: { residenteId },
    include: { qrToken: { select: { expiraEn: true, revocado: true, usosRealizados: true } } },
    orderBy: { createdAt: "desc" },
  });
}

// HU-20: generar QR temporal de visita, con vigencia y posibilidad de uso unico.
export async function generarQrVisita(condominioId: string, residenteId: string, visitaId: string) {
  const visita = await prisma.visita.findFirst({
    where: { id: visitaId, condominioId, residenteId },
    include: { qrToken: true },
  });
  if (!visita) throw new NotFoundError("Visita no encontrada.");
  if (visita.estado !== EstadoVisita.VIGENTE) {
    throw new ConflictError("Esta visita no se encuentra vigente.");
  }
  if (visita.qrToken) {
    throw new ConflictError("Ya existe un código QR generado para esta visita.");
  }

  const id = randomUUID();
  const token = nuevoTokenQr();
  const codigoManual = await codigoManualUnico();
  await prisma.qrToken.create({
    data: {
      id,
      tipo: TipoQrToken.VISITA,
      visitaId: visita.id,
      expiraEn: visita.periodoFin,
      usosMaximos: visita.soloUnUso ? 1 : null,
      token,
      codigoManual,
    },
  });

  return { qrDataUrl: await generarImagenQr(token), expiraEn: visita.periodoFin, codigoManual };
}

// Volver a mostrar el QR ya generado de una visita (por ejemplo, para reenviarlo si se perdio el
// mensaje). No crea un codigo nuevo: el que ya tiene la visita sigue siendo el mismo y sigue valiendo.
export async function verQrVisita(condominioId: string, residenteId: string, visitaId: string) {
  const visita = await prisma.visita.findFirst({
    where: { id: visitaId, condominioId, residenteId },
    include: { qrToken: true },
  });
  if (!visita) throw new NotFoundError("Visita no encontrada.");
  if (!visita.qrToken) throw new NotFoundError("Esta visita aún no tiene un código QR.");
  if (visita.estado !== EstadoVisita.VIGENTE || visita.qrToken.revocado || visita.periodoFin.getTime() < Date.now()) {
    throw new ConflictError("El código de esta visita ya no está vigente.");
  }
  return {
    qrDataUrl: await generarImagenQr(visita.qrToken.token),
    expiraEn: visita.periodoFin,
    codigoManual: visita.qrToken.codigoManual,
  };
}

// Vigencia por defecto de una visita "rapida": pensada para alguien que ya
// viene en camino (delivery, invitado puntual), no para agendar con dias de
// anticipacion -- si necesitan mas control (fecha futura, horario extenso)
// usan el formulario completo de HU-19.
const VIGENCIA_VISITA_RAPIDA_HORAS = 4;

// Atajo para "el QR de mi credencial sirve para invitados": crea la visita y
// su QR en un solo paso, sin pasar por el formulario de fecha/horario. Queda
// igual registrada en "Visitas autorizadas" que una visita creada a mano.
export async function crearVisitaRapida(condominioId: string, residenteId: string, nombreVisita?: string) {
  const ahora = new Date();
  const periodoFin = new Date(ahora.getTime() + VIGENCIA_VISITA_RAPIDA_HORAS * 60 * 60 * 1000);

  const visita = await prisma.visita.create({
    data: {
      condominioId,
      residenteId,
      nombreVisita: nombreVisita && nombreVisita.length > 0 ? nombreVisita : "Invitado",
      fecha: ahora,
      periodoInicio: ahora,
      periodoFin,
      soloUnUso: true,
    },
  });

  const qr = await generarQrVisita(condominioId, residenteId, visita.id);
  return { visitaId: visita.id, nombreVisita: visita.nombreVisita, ...qr };
}

// HU-20: revocar autorizacion de visita.
export async function revocarVisita(condominioId: string, residenteId: string, visitaId: string) {
  const visita = await prisma.visita.findFirst({ where: { id: visitaId, condominioId, residenteId } });
  if (!visita) throw new NotFoundError("Visita no encontrada.");

  await prisma.$transaction([
    prisma.visita.update({ where: { id: visitaId }, data: { estado: EstadoVisita.REVOCADA } }),
    prisma.qrToken.updateMany({ where: { visitaId }, data: { revocado: true } }),
  ]);

  return { revocado: true };
}

interface ResultadoValidacion {
  resultado: ResultadoAcceso;
  motivo: string;
  detalle?: Record<string, unknown>;
}

const INCLUDE_VALIDACION = {
  usuario: {
    select: {
      id: true,
      condominioId: true,
      activo: true,
      nombre: true,
      apellido: true,
      departamento: { include: { torre: true } },
    },
  },
  visita: {
    include: {
      residente: {
        select: {
          id: true,
          nombre: true,
          apellido: true,
          departamento: { include: { torre: true } },
        },
      },
    },
  },
} as const;

// HU-18 / HU-21: validar QR de residente o de visita mediante escaneo en conserjeria.
export async function validarQr(
  condominioId: string,
  validadoPorId: string,
  tokenCrudo: string
): Promise<ResultadoValidacion> {
  let registro;
  try {
    const entrada = tokenCrudo.trim();
    const codigo = normalizarCodigoManual(entrada);
    // Prioridad: token corto del QR (formato actual) -> codigo manual que teclea el conserje ->
    // JWT (formato anterior, de los QR ya emitidos). Cualquier otro texto lanza y se rechaza.
    if (esTokenCorto(entrada)) {
      registro = await prisma.qrToken.findUnique({ where: { token: entrada }, include: INCLUDE_VALIDACION });
    } else if (esCodigoManual(codigo)) {
      registro = await prisma.qrToken.findUnique({ where: { codigoManual: codigo }, include: INCLUDE_VALIDACION });
    } else {
      registro = await prisma.qrToken.findUnique({ where: { id: verifyQrToken(entrada).jti }, include: INCLUDE_VALIDACION });
    }
  } catch {
    return registrarResultado(condominioId, validadoPorId, null, ResultadoAcceso.RECHAZADO, "Código QR inválido o expirado.");
  }

  if (!registro) {
    return registrarResultado(condominioId, validadoPorId, null, ResultadoAcceso.RECHAZADO, "Código QR no reconocido.");
  }

  // Un conserje solo valida QR de su propio condominio: el token firmado es valido en cualquier
  // lugar, asi que hay que comprobar a quien pertenece.
  const condominioDelQr = registro.usuario?.condominioId ?? registro.visita?.condominioId;
  if (condominioDelQr !== condominioId) {
    return registrarResultado(condominioId, validadoPorId, null, ResultadoAcceso.RECHAZADO, "Código QR no reconocido.");
  }

  if (registro.revocado) {
    return registrarResultado(condominioId, validadoPorId, registro.id, ResultadoAcceso.RECHAZADO, "El código QR fue revocado.");
  }

  if (registro.expiraEn.getTime() < Date.now()) {
    return registrarResultado(condominioId, validadoPorId, registro.id, ResultadoAcceso.RECHAZADO, "El código QR se encuentra vencido.");
  }

  if (registro.usosMaximos !== null && registro.usosRealizados >= registro.usosMaximos) {
    return registrarResultado(condominioId, validadoPorId, registro.id, ResultadoAcceso.RECHAZADO, "El código QR ya fue utilizado.");
  }

  if (registro.tipo === TipoQrToken.RESIDENTE) {
    if (!registro.usuario) {
      return registrarResultado(condominioId, validadoPorId, registro.id, ResultadoAcceso.RECHAZADO, "Residente asociado no encontrado.");
    }
    if (!registro.usuario.activo) {
      return registrarResultado(condominioId, validadoPorId, registro.id, ResultadoAcceso.RECHAZADO, "La cuenta del residente está deshabilitada.");
    }
    if (!(await consumirUso(registro.id, registro.usosMaximos))) {
      return registrarResultado(condominioId, validadoPorId, registro.id, ResultadoAcceso.RECHAZADO, "El código QR ya fue utilizado.");
    }
    return registrarResultado(
      condominioId,
      validadoPorId,
      registro.id,
      ResultadoAcceso.AUTORIZADO,
      "Acceso de residente autorizado.",
      { residente: registro.usuario }
    );
  }

  // Validacion de visita.
  const visita = registro.visita;
  if (!visita || visita.estado === EstadoVisita.REVOCADA) {
    return registrarResultado(condominioId, validadoPorId, registro.id, ResultadoAcceso.RECHAZADO, "La autorización de visita fue revocada.");
  }
  const ahora = Date.now();
  if (ahora < visita.periodoInicio.getTime() || ahora > visita.periodoFin.getTime()) {
    return registrarResultado(condominioId, validadoPorId, registro.id, ResultadoAcceso.RECHAZADO, "La visita está fuera del período autorizado.");
  }

  if (!(await consumirUso(registro.id, registro.usosMaximos))) {
    return registrarResultado(condominioId, validadoPorId, registro.id, ResultadoAcceso.RECHAZADO, "El código QR ya fue utilizado.");
  }
  if (visita.soloUnUso) {
    await prisma.visita.update({ where: { id: visita.id }, data: { estado: EstadoVisita.USADA } });
  }

  return registrarResultado(
    condominioId,
    validadoPorId,
    registro.id,
    ResultadoAcceso.AUTORIZADO,
    "Acceso de visita autorizado.",
    { visita: { nombreVisita: visita.nombreVisita, residente: visita.residente } }
  );
}

// Reclama un uso del QR en una sola operacion atomica. Antes se leia "usosRealizados", se comparaba
// en memoria y despues se incrementaba: con varios escaneos simultaneos (o un QR compartido) todos
// leian 0 y todos pasaban, asi que un QR de "un solo uso" entraba varias veces. Con updateMany la
// base de datos aplica la condicion y el incremento juntos; solo un escaneo obtiene count = 1.
// "revocado: false" tambien cierra la carrera contra una revocacion que llega al mismo tiempo.
async function consumirUso(qrTokenId: string, usosMaximos: number | null): Promise<boolean> {
  const { count } = await prisma.qrToken.updateMany({
    where: {
      id: qrTokenId,
      revocado: false,
      ...(usosMaximos !== null ? { usosRealizados: { lt: usosMaximos } } : {}),
    },
    data: { usosRealizados: { increment: 1 } },
  });
  return count === 1;
}

async function registrarResultado(
  condominioId: string,
  validadoPorId: string,
  qrTokenId: string | null,
  resultado: ResultadoAcceso,
  motivo: string,
  detalle?: Record<string, unknown>
): Promise<ResultadoValidacion> {
  await prisma.accesoLog.create({
    data: { condominioId, validadoPorId, qrTokenId, resultado, motivo },
  });
  return { resultado, motivo, detalle };
}

const PERSONA_SELECT = {
  id: true,
  nombre: true,
  apellido: true,
  departamento: { include: { torre: true } },
} as const;

// Igual forma que el "detalle" de validarQr (residente | visita), para que
// el frontend pueda reusar el mismo componente de render en el resultado en
// vivo del escaneo y en el historial. Sin esto, el historial solo mostraba
// el texto fijo "Acceso de residente/visita autorizado" sin decir quien ni
// a que unidad -- no quedaba trazabilidad util para el conserje/admin.
export async function listarAccesos(condominioId: string, cantidad = 100) {
  const logs = await prisma.accesoLog.findMany({
    where: { condominioId },
    include: {
      validadoPor: { select: { id: true, nombre: true, apellido: true } },
      // select (no include) en qrToken: evita exponer el JWT (`token`) en la respuesta.
      qrToken: {
        select: {
          tipo: true,
          usuario: { select: PERSONA_SELECT },
          visita: { select: { nombreVisita: true, residente: { select: PERSONA_SELECT } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: cantidad,
  });

  return logs.map(({ qrToken, ...log }) => {
    let detalle: Record<string, unknown> | undefined;
    if (qrToken?.tipo === TipoQrToken.RESIDENTE && qrToken.usuario) {
      detalle = { residente: qrToken.usuario };
    } else if (qrToken?.tipo === TipoQrToken.VISITA && qrToken.visita) {
      detalle = { visita: { nombreVisita: qrToken.visita.nombreVisita, residente: qrToken.visita.residente } };
    }
    return { ...log, detalle };
  });
}
