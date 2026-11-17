import "./lib/zodEspanol";
import path from "path";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";
import { logger } from "./lib/logger";
import { protegerCsrf } from "./middleware/csrf";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { asignarRequestId, registrarSolicitud } from "./middleware/solicitud";
import { limiteSpa } from "./middleware/limiteSpa";

import authRoutes from "./modules/auth/auth.routes";
import usuariosRoutes from "./modules/usuarios/usuarios.routes";
import condominioRoutes from "./modules/condominio/condominio.routes";
import reservasRoutes from "./modules/reservas/reservas.routes";
import multasRoutes from "./modules/multas/multas.routes";
import incidenciasRoutes from "./modules/incidencias/incidencias.routes";
import encomiendasRoutes from "./modules/encomiendas/encomiendas.routes";
import comunicadosRoutes from "./modules/comunicados/comunicados.routes";
import qrRoutes from "./modules/qr/qr.routes";
import documentosRoutes from "./modules/documentos/documentos.routes";
import dashboardRoutes from "./modules/dashboard/dashboard.routes";
import notificacionesRoutes from "./modules/notificaciones/notificaciones.routes";
import sosRoutes from "./modules/sos/sos.routes";
import pushRoutes from "./modules/push/push.routes";
import auditoriaRoutes from "./modules/auditoria/auditoria.routes";
import gastosComunesRoutes from "./modules/gastos-comunes/gastos-comunes.routes";
import tareasRoutes from "./modules/recordatorios/tareas.routes";

export const app = express();

// En Render la aplicacion esta detras de un proxy (un solo salto). Sin esto, req.ip es la direccion
// del proxy para TODAS las personas y los limites por IP (login, cambio de contraseña) se compartian
// entre todo el condominio: con pocos intentos, nadie mas podia entrar. Se confia en exactamente un
// salto (no en "true") para que nadie pueda falsear su IP con su propia cabecera X-Forwarded-For.
if (env.isProd) app.set("trust proxy", 1);

// Identificador por solicitud (cabecera X-Request-Id) y una linea de log estructurada y redactada
// por cada pedido a la API (reemplaza a morgan, que escribia la URL completa con tokens de QR).
app.use(asignarRequestId);
app.use(registrarSolicitud);

// RNF-03/RNF-05: cabeceras de seguridad y validacion de entradas en el backend.
app.use(helmet());
// Solo los origenes configurados (nunca "*": las peticiones llevan la cookie de sesion).
app.use(cors({ origin: env.corsOrigins, credentials: true, exposedHeaders: ["X-Request-Id"] }));
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
// /uploads ya NO se sirve como carpeta publica: los documentos antiguos guardados en disco se leen
// con la sesion verificada (ver lib/archivos.ts, leerArchivoHeredado).

// Proteccion CSRF para TODAS las rutas (ver middleware/csrf.ts): origen permitido y token ligado a la
// sesion en los metodos que modifican datos. Los GET (incluidos /health, /ready y los archivos del
// frontend) pasan sin cambios; registrarla globalmente cubre tambien cualquier ruta futura.
app.use(protegerCsrf);

// /health: el proceso esta vivo (Render lo usa para saber si reiniciar). No toca la base.
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// /ready: el proceso puede atender (la base responde). Sin detalles internos en la respuesta.
const ESPERA_READY_MS = 3000;
app.get("/ready", async (req, res) => {
  let temporizador: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, rechazar) => {
        temporizador = setTimeout(() => rechazar(new Error("la base no respondió a tiempo")), ESPERA_READY_MS);
      }),
    ]);
    res.json({ status: "ok" });
  } catch (error) {
    logger.warn("ready: base de datos no disponible", { requestId: req.requestId, error });
    res.status(503).json({ status: "no-disponible" });
  } finally {
    clearTimeout(temporizador);
  }
});

// Configuracion publica que necesita la pantalla de login antes de que haya sesion.
app.get("/api/config", (_req, res) =>
  res.json({ cuentasDemo: env.mostrarCuentasDemo, sosModoDemo: env.sosModoDemo })
);

app.use("/api/auth", authRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/condominio", condominioRoutes);
app.use("/api/reservas", reservasRoutes);
app.use("/api/multas", multasRoutes);
app.use("/api/incidencias", incidenciasRoutes);
app.use("/api/encomiendas", encomiendasRoutes);
app.use("/api/comunicados", comunicadosRoutes);
app.use("/api/qr", qrRoutes);
app.use("/api/documentos", documentosRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/notificaciones", notificacionesRoutes);
app.use("/api/sos", sosRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/auditoria", auditoriaRoutes);
app.use("/api/gastos-comunes", gastosComunesRoutes);
app.use("/api/tareas", tareasRoutes);

// Sirve el frontend ya compilado desde el mismo proceso/puerto: un solo servidor que
// levantar, sin depender de que el servidor de desarrollo de Vite siga vivo por separado.
const frontendDist = path.join(__dirname, "..", "..", "frontend", "dist");

// Cache: los archivos de /assets llevan un hash en el nombre (cambian de nombre en cada version),
// asi que se pueden guardar un año sin riesgo. index.html y el service worker, en cambio, siempre se
// revalidan: si no, alguien podria quedarse con una version vieja de la app despues de un deploy.
export function cabecerasDeCache(rutaArchivo: string): string {
  const normal = rutaArchivo.replace(/\\/g, "/");
  if (normal.includes("/assets/")) return "public, max-age=31536000, immutable";
  if (normal.endsWith("/index.html") || normal.endsWith("/sw.js")) return "no-cache";
  return "public, max-age=3600";
}

app.use(
  express.static(frontendDist, {
    index: false,
    setHeaders: (res, rutaArchivo) => res.setHeader("Cache-Control", cabecerasDeCache(rutaArchivo)),
  })
);

// Fallback de la SPA, con su propio limite generoso (ver middleware/limiteSpa.ts).
app.get("*", limiteSpa, (req, res, next) => {
  if (req.path.startsWith("/api")) {
    return next();
  }
  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(path.join(frontendDist, "index.html"), (err) => {
    if (err) next(err);
  });
});

app.use(notFoundHandler);
app.use(errorHandler);
