import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}. Revisa backend/.env (usa .env.example como base).`);
  }
  return value;
}

// Un secreto débil (corto o de ejemplo) en producción permitiría falsificar sesiones (JWT) o
// códigos QR. En producción se exige un mínimo de 32 caracteres; en desarrollo y pruebas se acepta
// cualquier valor para no estorbar el trabajo local.
const esProd = process.env.NODE_ENV === "production";

export function secretoFuerte(valor: string, prod = esProd): boolean {
  return prod ? valor.length >= 32 : true;
}

function requiredSecret(name: string): string {
  const value = required(name);
  if (!secretoFuerte(value)) {
    throw new Error(
      `La variable ${name} es demasiado corta para producción (mínimo 32 caracteres). ` +
        `Genera un valor aleatorio fuerte, por ejemplo: ` +
        `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))".`
    );
  }
  return value;
}

const port = Number(process.env.PORT ?? 4000);

// Un numero positivo desde una variable de entorno, o el valor por defecto si falta o no es valido.
function numeroPositivo(name: string, porDefecto: number): number {
  const valor = Number(process.env[name]);
  return Number.isFinite(valor) && valor > 0 ? valor : porDefecto;
}

// Origenes permitidos para CORS y para la verificacion de "Origin" (CSRF): lista separada por comas.
function listaDeOrigenes(valor: string): string[] {
  return valor
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

export const env = {
  port,
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: required("DATABASE_URL"),
  // Reservada: desde la Fase 2 no firma nada (las sesiones son tokens aleatorios guardados como hash
  // en la base, y las descargas usan la sesion). Se mantiene obligatoria y fuerte para no romper
  // despliegues existentes y para cualquier firma futura.
  jwtSecret: requiredSecret("JWT_SECRET"),
  // Duracion de las sesiones. Personal (administracion y conserjeria): corta, suelen usar equipos
  // compartidos. Residentes: larga, para no pedirles la contraseña todos los dias. Es seguro porque
  // cada pedido revisa la sesion y la cuenta en la base, y cualquier sesion se puede revocar.
  sesionPersonalHoras: numeroPositivo("SESION_PERSONAL_HORAS", 8),
  sesionResidenteDias: numeroPositivo("SESION_RESIDENTE_DIAS", 30),
  qrTokenSecret: requiredSecret("QR_TOKEN_SECRET"),
  corsOrigins: listaDeOrigenes(process.env.CORS_ORIGIN ?? "http://localhost:5173"),
  // Base publica de la app (mismo origen que sirve frontend+API). Se usa para
  // que el QR codifique un link real (https://.../acceso/<token>) en vez de
  // solo el token en texto plano -- asi cualquier camara de celular puede
  // abrirlo, no solo el escaner propio de la app.
  appUrl: process.env.APP_URL ?? `http://localhost:${port}`,
  isProd: esProd,
  // Botones de "entrar con una cuenta de demostracion" en el login. Las cuentas demo comparten una
  // contraseña publica, asi que en produccion quedan ocultas salvo que se active a proposito
  // (MOSTRAR_CUENTAS_DEMO=true, util para una defensa o una demostracion). En desarrollo se ven.
  mostrarCuentasDemo: process.env.MOSTRAR_CUENTAS_DEMO
    ? process.env.MOSTRAR_CUENTAS_DEMO === "true"
    : process.env.NODE_ENV !== "production",
  // Modo demostración del botón SOS, INDEPENDIENTE de las cuentas demo (mostrarCuentasDemo). En true,
  // el SOS avisa a conserjería/administración pero NO abre la llamada a un número de emergencia real.
  // Explícito y separado para no atar una medida de seguridad (no llamar de verdad) al flag de demo.
  sosModoDemo: process.env.SOS_MODO_DEMO === "true",
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
