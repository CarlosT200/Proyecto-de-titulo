import type { Server } from "node:http";
import { app } from "./app";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { eliminarSesionesCaducadas } from "./lib/sesiones";
import { programarRecordatorios } from "./modules/recordatorios/recordatorios.programador";

const server: Server = app.listen(env.port, () => {
  logger.info("HabitaSmart API escuchando", { puerto: env.port, entorno: env.nodeEnv });
  programarRecordatorios();
  programarLimpiezaDeSesiones();
});

// Tiempos de espera: una solicitud no puede quedar colgada para siempre ocupando el servidor. El
// keep-alive va por sobre el del proxy de Render (60 s) para que este no reuse conexiones cerradas.
server.requestTimeout = 60_000;
server.headersTimeout = 65_000;
server.keepAliveTimeout = 61_000;

// Limpieza diaria de sesiones vencidas o revocadas hace mas de 30 dias.
function programarLimpiezaDeSesiones() {
  const limpiar = () =>
    eliminarSesionesCaducadas()
      .then((n) => n > 0 && logger.info("sesiones caducadas eliminadas", { cantidad: n }))
      .catch((error) => logger.warn("no se pudieron limpiar las sesiones caducadas", { error }));
  setTimeout(limpiar, 5 * 60 * 1000).unref();
  setInterval(limpiar, 24 * 3600 * 1000).unref();
}

// --- Cierre ordenado ------------------------------------------------------------------------------
// Render envia SIGTERM antes de reemplazar la instancia (deploy, reinicio). Se deja de aceptar
// conexiones nuevas, se esperan las solicitudes en curso (hasta 10 s) y se cierra la conexion a la
// base. Asi un pago o una alerta SOS que estaba guardandose no queda a medias.
const ESPERA_CIERRE_MS = 10_000;
let cerrando = false;

function cerrar(senal: string, codigo = 0) {
  if (cerrando) return;
  cerrando = true;
  logger.info("cerrando el servidor", { senal });
  const forzar = setTimeout(() => {
    logger.warn("cierre forzado: quedaron solicitudes sin terminar");
    process.exit(codigo || 1);
  }, ESPERA_CIERRE_MS);
  forzar.unref();
  server.close(() => {
    prisma
      .$disconnect()
      .catch(() => {})
      .finally(() => {
        logger.info("servidor cerrado");
        process.exit(codigo);
      });
  });
}

process.on("SIGTERM", () => cerrar("SIGTERM"));
process.on("SIGINT", () => cerrar("SIGINT"));

// Una promesa rechazada sin manejar es un error del codigo: se registra (redactado) y se sigue
// atendiendo. Una excepcion no capturada deja el proceso en un estado desconocido: se registra y
// se cierra de forma ordenada para que Render levante una instancia limpia.
process.on("unhandledRejection", (motivo) => {
  logger.error("promesa rechazada sin manejar", { error: motivo });
});
process.on("uncaughtException", (error) => {
  logger.error("excepción no capturada", { error });
  cerrar("uncaughtException", 1);
});
