// Prepara una base de datos NUEVA para usar HabitaSmart con un condominio real: crea el condominio
// y su primera cuenta de administración. No crea cuentas ni datos de demostración.
//
// Uso (desde la carpeta backend), con la base ya migrada (npm run prisma:migrate:deploy):
//   npm run crear-condominio -- --condominio "Condominio Los Robles" --comuna "Ñuñoa" \
//       --direccion "Av. Grecia 1234" --nombre "María" --apellido "Soto" \
//       --email admin@correo.cl --password "una-clave-segura"
//
// Despues la administradora entra a la aplicacion y, desde "Condominio", agrega torres,
// departamentos y espacios comunes; desde "Residentes", crea las cuentas de residentes y conserjes.

import bcrypt from "bcryptjs";
import { PrismaClient, Rol } from "@prisma/client";

const prisma = new PrismaClient({ log: ["error"] });

const PASSWORD_DEMO = "Habita2026!";

function argumentos(): Record<string, string> {
  const resultado: Record<string, string> = {};
  const lista = process.argv.slice(2);
  for (let i = 0; i < lista.length; i += 2) {
    const clave = lista[i];
    if (!clave.startsWith("--") || lista[i + 1] === undefined) {
      throw new Error(`Argumento inválido: ${clave}. Usa el formato --nombre "valor".`);
    }
    resultado[clave.slice(2)] = lista[i + 1];
  }
  return resultado;
}

function obligatorio(args: Record<string, string>, clave: string): string {
  const valor = args[clave]?.trim();
  if (!valor) throw new Error(`Falta --${clave}.`);
  return valor;
}

async function main() {
  const args = argumentos();
  const condominio = obligatorio(args, "condominio");
  const nombre = obligatorio(args, "nombre");
  const apellido = obligatorio(args, "apellido");
  const email = obligatorio(args, "email").toLowerCase();
  const password = obligatorio(args, "password");

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("El correo no es válido.");
  if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
  if (password === PASSWORD_DEMO) throw new Error("No uses la contraseña de las cuentas de demostración.");

  if (await prisma.usuario.findUnique({ where: { email } })) {
    throw new Error(`Ya existe una cuenta con el correo ${email}.`);
  }

  const creado = await prisma.condominio.create({
    data: {
      nombre: condominio,
      direccion: args.direccion?.trim() || null,
      comuna: args.comuna?.trim() || null,
      usuarios: {
        create: {
          email,
          nombre,
          apellido,
          rol: Rol.ADMIN,
          passwordHash: await bcrypt.hash(password, 12),
        },
      },
    },
  });

  console.log(`Listo. Condominio "${creado.nombre}" creado con la cuenta de administración ${email}.`);
  console.log("Siguiente paso: entrar a la aplicación, cambiar la contraseña desde Mi perfil y cargar torres y residentes.");
}

main()
  .catch((error) => {
    console.error("No se pudo crear el condominio:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
