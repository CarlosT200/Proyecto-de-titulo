import "./lib/zodEspanol";
import path from "path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { UPLOADS_DIR } from "./middleware/upload";

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

// RNF-03/RNF-05: cabeceras de seguridad y validacion de entradas en el backend.
app.use(helmet());
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(morgan(env.isProd ? "combined" : "dev"));
app.use("/uploads", express.static(UPLOADS_DIR));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Configuracion publica que necesita la pantalla de login antes de que haya sesion.
app.get("/api/config", (_req, res) => res.json({ cuentasDemo: env.mostrarCuentasDemo }));

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
app.use(express.static(frontendDist));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
    return next();
  }
  res.sendFile(path.join(frontendDist, "index.html"), (err) => {
    if (err) next(err);
  });
});

app.use(notFoundHandler);
app.use(errorHandler);
