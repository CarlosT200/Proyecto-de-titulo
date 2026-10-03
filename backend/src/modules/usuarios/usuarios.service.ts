import { Rol } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { hashPassword } from "../auth/auth.service";
import { ConflictError, NotFoundError } from "../../lib/errors";

const SELECT_PUBLICO = {
  id: true,
  nombre: true,
  apellido: true,
  email: true,
  rol: true,
  telefono: true,
  activo: true,
  departamentoId: true,
  departamento: { select: { id: true, numero: true, torre: { select: { nombre: true } } } },
  createdAt: true,
} as const;

// El conserje solo necesita saber quien es cada residente y en que unidad vive (para registrar
// encomiendas): no ve correos ni telefonos (RNF-07, minimizacion de datos personales).
const SELECT_CONSERJE = {
  id: true,
  nombre: true,
  apellido: true,
  rol: true,
  activo: true,
  departamentoId: true,
  departamento: { select: { id: true, numero: true, torre: { select: { nombre: true } } } },
} as const;

// HU-02: registrar y administrar residentes, asociandolos a su unidad.
export async function crearUsuario(
  condominioId: string,
  data: {
    nombre: string;
    apellido: string;
    email: string;
    password: string;
    rol: Rol;
    telefono?: string;
    departamentoId?: string | null;
  }
) {
  const existente = await prisma.usuario.findUnique({ where: { email: data.email.toLowerCase().trim() } });
  if (existente) {
    throw new ConflictError("Ya existe un usuario registrado con ese correo.");
  }

  const passwordHash = await hashPassword(data.password);

  return prisma.usuario.create({
    data: {
      condominioId,
      nombre: data.nombre,
      apellido: data.apellido,
      email: data.email.toLowerCase().trim(),
      passwordHash,
      rol: data.rol,
      telefono: data.telefono,
      departamentoId: data.departamentoId ?? null,
      // la contraseña la eligio la administracion: la persona tiene que cambiarla al entrar
      debeCambiarPassword: true,
    },
    select: SELECT_PUBLICO,
  });
}

export async function listarUsuarios(
  condominioId: string,
  filtros: { rol?: Rol; activo?: boolean },
  solicitante: Rol = Rol.ADMIN
) {
  return prisma.usuario.findMany({
    where: { condominioId, rol: filtros.rol, activo: filtros.activo },
    select: solicitante === Rol.ADMIN ? SELECT_PUBLICO : SELECT_CONSERJE,
    orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
  });
}

export async function obtenerUsuario(condominioId: string, usuarioId: string, solicitante: Rol = Rol.ADMIN) {
  const usuario = await prisma.usuario.findFirst({
    where: { id: usuarioId, condominioId },
    select: solicitante === Rol.ADMIN ? SELECT_PUBLICO : SELECT_CONSERJE,
  });
  if (!usuario) throw new NotFoundError("Usuario no encontrado.");
  return usuario;
}

// Deshabilitar en vez de eliminar preserva el historial asociado (reservas, multas, incidencias).
export async function actualizarUsuario(
  condominioId: string,
  usuarioId: string,
  data: {
    nombre?: string;
    apellido?: string;
    telefono?: string | null;
    departamentoId?: string | null;
    activo?: boolean;
  }
) {
  await obtenerUsuario(condominioId, usuarioId);
  return prisma.usuario.update({
    where: { id: usuarioId },
    data,
    select: SELECT_PUBLICO,
  });
}

// Para quien olvido su contraseña: la administracion define una nueva temporal y la persona tiene
// que cambiarla al entrar. No se puede ver ni recuperar la anterior (solo se guarda su hash).
export async function restablecerPassword(condominioId: string, usuarioId: string, password: string) {
  await obtenerUsuario(condominioId, usuarioId);
  const passwordHash = await hashPassword(password);
  return prisma.usuario.update({
    where: { id: usuarioId },
    data: { passwordHash, debeCambiarPassword: true },
    select: SELECT_PUBLICO,
  });
}
