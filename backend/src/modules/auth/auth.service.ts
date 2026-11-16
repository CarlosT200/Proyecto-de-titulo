import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import { crearSesion, revocarSesionesDeUsuario, type SesionEmitida } from "../../lib/sesiones";
import { UnauthorizedError, ForbiddenError, ConflictError } from "../../lib/errors";

const PERFIL_SELECT = {
  id: true,
  email: true,
  nombre: true,
  apellido: true,
  rol: true,
  condominioId: true,
  departamentoId: true,
  telefono: true,
  fotoUrl: true,
  debeCambiarPassword: true,
  condominio: { select: { id: true, nombre: true } },
  departamento: { select: { id: true, numero: true, torre: { select: { nombre: true } } } },
} as const;

const SALT_ROUNDS = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function normalizarEmail(email: string): string {
  return email.toLowerCase().trim();
}

// Devuelve el perfil y la sesion recien creada (token para la cookie HttpOnly + token CSRF). El
// controlador escribe las cookies; el token NUNCA se incluye en el JSON de respuesta.
export async function login(email: string, password: string, agente?: string): Promise<{ usuario: Perfil; sesion: SesionEmitida }> {
  const usuario = await prisma.usuario.findUnique({ where: { email: normalizarEmail(email) } });

  // HU-01: si las credenciales son incorrectas, se informa con un mensaje generico
  // (no se revela si el correo existe o no).
  if (!usuario) {
    throw new UnauthorizedError("Correo o contraseña incorrectos.");
  }

  const valido = await bcrypt.compare(password, usuario.passwordHash);
  if (!valido) {
    throw new UnauthorizedError("Correo o contraseña incorrectos.");
  }

  if (!usuario.activo) {
    throw new ForbiddenError("Tu cuenta se encuentra deshabilitada. Contacta a la administración.");
  }

  const sesion = await crearSesion({ id: usuario.id, rol: usuario.rol }, agente);

  // Mismo perfil que /auth/me: antes se devolvia una version recortada (sin
  // condominio, departamento/torre ni telefono) y esos datos faltaban en la
  // credencial, el inicio y Perfil justo despues de entrar, hasta recargar.
  return { usuario: await getPerfil(usuario.id), sesion };
}

export type Perfil = Awaited<ReturnType<typeof getPerfil>>;

export async function getPerfil(usuarioId: string) {
  return prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId }, select: PERFIL_SELECT });
}

// El propio usuario edita su nombre/apellido/telefono (sin rol, correo ni condominio).
export async function actualizarPerfil(
  usuarioId: string,
  data: { nombre?: string; apellido?: string; telefono?: string | null }
) {
  return prisma.usuario.update({ where: { id: usuarioId }, data, select: PERFIL_SELECT });
}

export async function actualizarFoto(usuarioId: string, fotoUrl: string) {
  return prisma.usuario.update({ where: { id: usuarioId }, data: { fotoUrl }, select: PERFIL_SELECT });
}

// Cambio de contraseña por la propia persona. Cierra TODAS sus sesiones (incluida la actual, que se
// reemplaza por una nueva): si alguien tenia una sesion robada o abierta en un equipo ajeno, queda
// fuera. El controlador escribe las cookies de la sesion nueva.
export async function cambiarPassword(
  usuarioId: string,
  actual: string,
  nueva: string,
  agente?: string
): Promise<{ usuario: Perfil; sesion: SesionEmitida }> {
  const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });

  const valido = await bcrypt.compare(actual, usuario.passwordHash);
  if (!valido) {
    throw new UnauthorizedError("La contraseña actual no es correcta.");
  }

  if (nueva === actual) {
    throw new ConflictError("La nueva contraseña tiene que ser distinta de la actual.");
  }

  const passwordHash = await hashPassword(nueva);
  // Al elegir una contraseña propia deja de ser obligatorio cambiarla. Se anota la fecha del cambio
  // (defensa adicional en requireAuth) y se revocan las sesiones existentes.
  const usuarioActualizado = await prisma.usuario.update({
    where: { id: usuarioId },
    data: { passwordHash, debeCambiarPassword: false, passwordCambiadaEn: new Date() },
    select: PERFIL_SELECT,
  });
  await revocarSesionesDeUsuario(usuarioId);
  const sesion = await crearSesion({ id: usuario.id, rol: usuario.rol }, agente);
  return { usuario: usuarioActualizado, sesion };
}
