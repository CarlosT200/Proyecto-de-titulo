import rateLimit from "express-rate-limit";

// --- Limite para el fallback de la SPA (CodeQL js/missing-rate-limiting) -------------------------
// La ruta "*" que entrega index.html lee un archivo del disco en cada pedido. Sin limite, alguien
// podria pedirla en bucle. El limite es GENEROSO a proposito:
// - La app es una SPA: index.html se pide solo al abrirla o recargarla; la navegacion interna no
//   vuelve al servidor. Una persona normal hace unas pocas cargas por minuto.
// - Un condominio (o una red movil con CGNAT) puede compartir una sola IP publica entre muchas
//   personas, y una demostracion abre la app en varios dispositivos a la vez.
// 600 cargas por minuto por IP no bloquea ninguno de esos casos y si corta un bucle automatizado.
//
// Solo se aplica al fallback: /health, /ready, /api/config y el resto de /api se declaran antes
// (o se saltan aqui), y los assets estaticos los resuelve express.static antes de llegar al
// fallback. No reemplaza los limites especificos de login, cambio de contrasena, QR ni SOS.
export const LIMITE_SPA_POR_MINUTO = 600;
export const VENTANA_SPA_MS = 60 * 1000;

export function crearLimiteSpa(limite: number = LIMITE_SPA_POR_MINUTO) {
  return rateLimit({
    windowMs: VENTANA_SPA_MS,
    limit: limite,
    standardHeaders: "draft-7", // cabecera estandar RateLimit / RateLimit-Policy
    legacyHeaders: false, // sin las antiguas X-RateLimit-*
    // las rutas /api que llegan aqui no existen (404 del notFoundHandler): no cuentan para la SPA
    skip: (req) => req.path.startsWith("/api"),
    statusCode: 429,
    message: "Demasiadas solicitudes seguidas. Espera un momento y vuelve a cargar la página.",
  });
}

export const limiteSpa = crearLimiteSpa();
