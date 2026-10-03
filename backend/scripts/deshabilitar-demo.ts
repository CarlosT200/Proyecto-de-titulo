// Deshabilita las tres cuentas de demostración (admin@, residente@ y conserje@habitasmart.cl).
// Todas comparten una contraseña publica (esta en el codigo y en el login de demostracion), asi que
// en una base con datos reales tienen que quedar fuera de servicio.
//
// Uso (desde la carpeta backend):
//   npm run deshabilitar-demo
//
// Es reversible: se pueden volver a habilitar desde "Residentes" en la aplicacion. Como el acceso
// se valida contra la base de datos en cada pedido, el efecto es inmediato aunque alguien tenga la
// sesion abierta.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["error"] });

const CORREOS_DEMO = ["admin@habitasmart.cl", "residente@habitasmart.cl", "conserje@habitasmart.cl"];

async function main() {
  const { count } = await prisma.usuario.updateMany({
    where: { email: { in: CORREOS_DEMO } },
    data: { activo: false },
  });
  console.log(count === 0 ? "No hay cuentas de demostración en esta base de datos." : `Cuentas de demostración deshabilitadas: ${count}.`);
}

main()
  .catch((error) => {
    console.error("No se pudo completar:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
