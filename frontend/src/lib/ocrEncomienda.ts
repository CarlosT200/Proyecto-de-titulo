// Lectura automática de la etiqueta de una encomienda (OCR) 100% en el dispositivo, con Tesseract.js.
// No envía la foto a ningún servidor: todo ocurre en el navegador del conserje y es gratuito.
// A partir del texto leído intenta deducir el número de seguimiento, la empresa y el residente.

export type ResultadoEtiqueta = {
  texto: string;
  numeroSeguimiento?: string;
  empresa?: string;
};

const EMPRESAS = [
  "Correos de Chile", "Chilexpress", "Starken", "Blue Express", "Mercado Libre",
  "DHL", "FedEx", "UPS", "TNT", "Servientrega", "Turbus Cargo",
];

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

// Empresa de despacho: la primera de la lista cuyo nombre aparezca en el texto.
export function detectarEmpresa(texto: string): string | undefined {
  const t = normalizar(texto);
  return EMPRESAS.find((e) => t.includes(normalizar(e)));
}

// Número de seguimiento: se buscan secuencias alfanuméricas largas (con al menos un dígito). Se da
// prioridad a las que están en una línea con una palabra clave (seguimiento, tracking, guía, orden…).
export function extraerSeguimiento(texto: string): string | undefined {
  const limpio = normalizar(texto).replace(/[^A-Z0-9\n ]/g, " ");
  const lineas = limpio.split("\n");
  const re = /\b([A-Z]{0,4}\d[A-Z0-9]{6,})\b/g;
  const bueno = (c: string) => c.length >= 8 && c.length <= 30 && /\d/.test(c) && !/^0+$/.test(c);

  const conClave: string[] = [];
  const otros: string[] = [];
  for (const linea of lineas) {
    const tieneClave = /(SEGUIMIENTO|TRACKING|GUIA|ORDEN|ENVIO|N[º°O]\s|OT\b|TRACK)/.test(linea);
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(linea))) {
      const c = m[1];
      if (bueno(c)) (tieneClave ? conClave : otros).push(c);
    }
  }
  const candidatos = [...conClave, ...otros];
  if (candidatos.length === 0) return undefined;
  // Preferimos el más largo (los códigos de seguimiento suelen ser los números más largos).
  candidatos.sort((a, b) => b.length - a.length);
  return candidatos[0];
}

// Empareja el texto leído con el residente cuyo nombre y apellido aparezcan mejor en la etiqueta.
// Exige al menos dos coincidencias cuando hay nombre y apellido, para no sugerir por un solo nombre común.
export function emparejarResidente<T extends { id: string; nombre: string; apellido: string }>(
  texto: string,
  residentes: T[]
): T | undefined {
  const t = normalizar(texto);
  let mejor: T | undefined;
  let mejorPuntaje = 0;
  for (const r of residentes) {
    const tokens = [...normalizar(r.nombre).split(/\s+/), ...normalizar(r.apellido).split(/\s+/)]
      .filter((x) => x.length >= 3);
    if (tokens.length === 0) continue;
    const aciertos = tokens.filter((tok) => t.includes(tok)).length;
    const requerido = tokens.length >= 2 ? 2 : 1;
    if (aciertos < requerido) continue;
    const puntaje = aciertos / tokens.length + aciertos * 0.001;
    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejor = r;
    }
  }
  return mejor;
}

// Lee la etiqueta con OCR. Importa Tesseract de forma diferida para no cargarlo si no se usa.
export async function leerEtiqueta(file: File): Promise<ResultadoEtiqueta> {
  const { default: Tesseract } = await import("tesseract.js");
  const url = URL.createObjectURL(file);
  try {
    const { data } = await Tesseract.recognize(url, "spa");
    const texto = data?.text ?? "";
    return { texto, numeroSeguimiento: extraerSeguimiento(texto), empresa: detectarEmpresa(texto) };
  } finally {
    URL.revokeObjectURL(url);
  }
}
