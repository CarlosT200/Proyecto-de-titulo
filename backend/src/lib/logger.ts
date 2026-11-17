// --- Logs estructurados con redaccion (Fase 2G) --------------------------------------------------
// En produccion cada linea es un JSON (Render las muestra y se pueden filtrar por requestId); en
// desarrollo, una linea legible. Antes de escribir, se ocultan los datos sensibles: contraseñas,
// tokens de sesion, cabeceras Authorization/Cookie, tokens CSRF, codigos QR y archivos en base64.

type Nivel = "debug" | "info" | "warn" | "error";

// "silencio" solo sirve como nivel minimo (las pruebas lo usan para no llenar la salida).
const ORDEN: Record<Nivel | "silencio", number> = { debug: 10, info: 20, warn: 30, error: 40, silencio: 99 };

// Claves cuyo VALOR nunca se escribe (comparacion sin mayusculas ni guiones).
const CLAVES_SENSIBLES = [
  "password",
  "passwordhash",
  "actual",
  "nueva",
  "token",
  "tokenhash",
  "csrftoken",
  "xcsrftoken",
  "authorization",
  "cookie",
  "setcookie",
  "codigomanual",
  "qrdataurl",
  "archivo",
  "archivourl",
  "fotourl",
  "p256dh",
  "auth",
  "secret",
  "jwtsecret",
  "databaseurl",
];

function esClaveSensible(clave: string): boolean {
  const normal = clave.toLowerCase().replace(/[^a-z0-9]/g, "");
  return CLAVES_SENSIBLES.some((s) => normal === s || normal.endsWith(s));
}

// Patrones que se ocultan dentro de cualquier texto (mensajes de error, rutas, etc.).
const PATRONES: [RegExp, string][] = [
  [/(postgres(?:ql)?:\/\/[^:\s/]+:)[^@\s]+@/gi, "$1[oculto]@"], // contraseña dentro de una URL de base de datos
  [/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, "$1[oculto]"],
  [/(habitasmart_(?:sesion|csrf)=)[^;\s]+/gi, "$1[oculto]"],
  [/(\/acceso\/)[^/?\s]+/gi, "$1[oculto]"], // token del QR en la URL publica de validacion
  [/data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]{20,}/gi, "data:[archivo oculto]"],
  [/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, "[jwt oculto]"],
];

export function redactarTexto(texto: string): string {
  return PATRONES.reduce((t, [patron, reemplazo]) => t.replace(patron, reemplazo), texto);
}

export function redactar(valor: unknown, profundidad = 0): unknown {
  if (profundidad > 6) return "[…]";
  if (typeof valor === "string") return redactarTexto(valor);
  if (valor instanceof Error) {
    return {
      nombre: valor.name,
      mensaje: redactarTexto(valor.message),
      // la pila solo fuera de produccion (puede incluir rutas internas)
      ...(process.env.NODE_ENV !== "production" && valor.stack ? { pila: redactarTexto(valor.stack) } : {}),
    };
  }
  if (Array.isArray(valor)) return valor.slice(0, 50).map((v) => redactar(v, profundidad + 1));
  if (valor && typeof valor === "object") {
    const salida: Record<string, unknown> = {};
    for (const [clave, v] of Object.entries(valor)) {
      salida[clave] = esClaveSensible(clave) ? "[oculto]" : redactar(v, profundidad + 1);
    }
    return salida;
  }
  return valor;
}

function nivelMinimo(): Nivel | "silencio" {
  const configurado = process.env.LOG_LEVEL as Nivel | "silencio" | undefined;
  if (configurado && configurado in ORDEN) return configurado;
  return process.env.NODE_ENV === "test" ? "warn" : "info";
}

function escribir(nivel: Nivel, mensaje: string, datos?: Record<string, unknown>): void {
  if (ORDEN[nivel] < ORDEN[nivelMinimo()]) return;
  const limpio = datos ? (redactar(datos) as Record<string, unknown>) : undefined;
  const salida = nivel === "error" || nivel === "warn" ? process.stderr : process.stdout;
  if (process.env.NODE_ENV === "production") {
    salida.write(`${JSON.stringify({ t: new Date().toISOString(), nivel, msg: redactarTexto(mensaje), ...limpio })}\n`);
  } else {
    const extra = limpio && Object.keys(limpio).length ? ` ${JSON.stringify(limpio)}` : "";
    salida.write(`[${nivel}] ${redactarTexto(mensaje)}${extra}\n`);
  }
}

export const logger = {
  debug: (mensaje: string, datos?: Record<string, unknown>) => escribir("debug", mensaje, datos),
  info: (mensaje: string, datos?: Record<string, unknown>) => escribir("info", mensaje, datos),
  warn: (mensaje: string, datos?: Record<string, unknown>) => escribir("warn", mensaje, datos),
  error: (mensaje: string, datos?: Record<string, unknown>) => escribir("error", mensaje, datos),
};
