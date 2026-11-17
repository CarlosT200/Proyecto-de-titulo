import bcrypt from "bcryptjs";
import { Rol } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";

// --- Base de datos de pruebas ------------------------------------------------------------------
// Guardia doble: la configuracion de Vitest ya exige un nombre terminado en "_test", y aqui se
// vuelve a comprobar sobre la URL que realmente usa Prisma antes de vaciar nada.
export function comprobarBaseDePruebas(): void {
  if (!/\/[A-Za-z0-9_-]*_test(\?.*)?$/.test(env.databaseUrl)) {
    throw new Error("Las pruebas de integración solo corren contra una base cuyo nombre termine en _test.");
  }
}

// Vacia todas las tablas del esquema (menos el historial de migraciones). TRUNCATE ... CASCADE
// respeta las claves foraneas sin tener que ordenar las tablas a mano.
export async function limpiarBase(): Promise<void> {
  comprobarBaseDePruebas();
  const tablas = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (tablas.length === 0) return;
  const lista = tablas.map((t) => `"${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${lista} RESTART IDENTITY CASCADE`);
}

// --- Datos deterministas ------------------------------------------------------------------------
// Dos condominios completos e independientes, con las tres personas de cada rol. Todo ficticio.
export const PASSWORD_PRUEBA = "Prueba-1234!";

export interface UsuarioPrueba {
  id: string;
  email: string;
  rol: Rol;
  departamentoId: string | null;
}

export interface CondominioPrueba {
  id: string;
  nombre: string;
  torreId: string;
  depto101: string;
  depto102: string;
  quinchoId: string;
  admin: UsuarioPrueba;
  conserje: UsuarioPrueba;
  residente: UsuarioPrueba; // depto 101
  residente2: UsuarioPrueba; // depto 102
  inactivo: UsuarioPrueba; // residente deshabilitado
}

export interface DatosPrueba {
  a: CondominioPrueba;
  b: CondominioPrueba;
}

async function crearCondominio(letra: "a" | "b", passwordHash: string): Promise<CondominioPrueba> {
  const condominio = await prisma.condominio.create({
    data: { nombre: `Condominio Prueba ${letra.toUpperCase()}`, direccion: "Calle Ficticia 123", comuna: "Comuna de Prueba" },
  });
  const torre = await prisma.torre.create({ data: { condominioId: condominio.id, nombre: "Torre 1" } });
  const depto101 = await prisma.departamento.create({ data: { condominioId: condominio.id, torreId: torre.id, numero: "101" } });
  const depto102 = await prisma.departamento.create({ data: { condominioId: condominio.id, torreId: torre.id, numero: "102" } });
  const quincho = await prisma.espacioComun.create({
    data: { condominioId: condominio.id, nombre: "Quincho", capacidad: 20, horarioInicio: "10:00", horarioFin: "23:00" },
  });

  async function usuario(rol: Rol, nombre: string, departamentoId: string | null, activo = true): Promise<UsuarioPrueba> {
    const email = `${nombre.toLowerCase()}.${letra}@prueba.test`;
    const u = await prisma.usuario.create({
      data: { condominioId: condominio.id, email, passwordHash, nombre, apellido: `Apellido${letra.toUpperCase()}`, rol, departamentoId, activo },
      select: { id: true, email: true, rol: true, departamentoId: true },
    });
    return u;
  }

  return {
    id: condominio.id,
    nombre: condominio.nombre,
    torreId: torre.id,
    depto101: depto101.id,
    depto102: depto102.id,
    quinchoId: quincho.id,
    admin: await usuario(Rol.ADMIN, "Admin", null),
    conserje: await usuario(Rol.CONSERJE, "Conserje", null),
    residente: await usuario(Rol.RESIDENTE, "Residente", depto101.id),
    residente2: await usuario(Rol.RESIDENTE, "Vecina", depto102.id),
    inactivo: await usuario(Rol.RESIDENTE, "Inactivo", null, false),
  };
}

// Vacia la base y crea los datos de prueba. Se llama en el beforeAll de cada archivo.
export async function prepararBase(): Promise<DatosPrueba> {
  await limpiarBase();
  // costo 4: suficiente para las pruebas y mucho mas rapido que el 12 de produccion
  const passwordHash = await bcrypt.hash(PASSWORD_PRUEBA, 4);
  const a = await crearCondominio("a", passwordHash);
  const b = await crearCondominio("b", passwordHash);
  return { a, b };
}

export async function cerrarBase(): Promise<void> {
  await prisma.$disconnect();
}

export { prisma };
