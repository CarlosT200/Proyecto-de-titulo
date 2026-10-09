import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}. Revisa backend/.env (usa .env.example como base).`);
  }
  return value;
}

const port = Number(process.env.PORT ?? 4000);

export const env = {
  port,
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  // Personal (administracion y conserjeria): sesion corta, suelen usar equipos compartidos.
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
  // Residentes: sesion larga para no pedirles la contraseña todos los dias. Es seguro porque cada
  // pedido revisa la cuenta en la base (se corta al deshabilitarla) y cambiar o restablecer la
  // contraseña cierra las sesiones anteriores (ver middleware/auth.ts).
  jwtExpiresInResidente: process.env.JWT_EXPIRES_IN_RESIDENTE ?? "30d",
  qrTokenSecret: required("QR_TOKEN_SECRET"),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  // Base publica de la app (mismo origen que sirve frontend+API). Se usa para
  // que el QR codifique un link real (https://.../acceso/<token>) en vez de
  // solo el token en texto plano -- asi cualquier camara de celular puede
  // abrirlo, no solo el escaner propio de la app.
  appUrl: process.env.APP_URL ?? `http://localhost:${port}`,
  isProd: process.env.NODE_ENV === "production",
  // Botones de "entrar con una cuenta de demostracion" en el login. Las cuentas demo comparten una
  // contraseña publica, asi que en produccion quedan ocultas salvo que se active a proposito
  // (MOSTRAR_CUENTAS_DEMO=true, util para una defensa o una demostracion). En desarrollo se ven.
  mostrarCuentasDemo: process.env.MOSTRAR_CUENTAS_DEMO
    ? process.env.MOSTRAR_CUENTAS_DEMO === "true"
    : process.env.NODE_ENV !== "production",
  // Web Push: si faltan, el modulo push queda deshabilitado en silencio (ver
  // push.service.ts) en vez de tumbar el servidor -- es una funcionalidad
  // adicional (notificaciones aunque la app este cerrada), no el nucleo de
  // la app, asi que no deberia impedir levantar el backend si alguien
  // todavia no genero sus propias claves VAPID.
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
  vapidSubject: process.env.VAPID_SUBJECT ?? "mailto:soporte@habitasmart.cl",
  // Clave para que una tarea externa (GitHub Actions) pida enviar los recordatorios cada hora aunque
  // el servidor este dormido. Opcional: sin ella, los recordatorios corren solo mientras esta encendido.
  tareasToken: process.env.TAREAS_TOKEN,
};
