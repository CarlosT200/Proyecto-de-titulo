// Borra el condominio de DEMOSTRACION (el que crea el seed: "Condominio Los Alerces") y todo lo que
// cuelga de el: cuentas demo, reservas, multas, incidencias, accesos, documentos, notificaciones...
// Sirve para empezar un piloto real en la misma base de datos, sin datos de ejemplo, y despues
// crear el condominio de verdad con "npm run crear-condominio".
//
// Uso (desde la carpeta backend):
//   npm run vaciar-demo                 -> solo muestra cuantos registros se borrarian (no borra nada)
//   npm run vaciar-demo -- --confirmar  -> borra
//
// ES IRREVERSIBLE. Haz antes un respaldo (npm run respaldo). Solo toca el condominio demo; si la base
// ya tiene otros condominios, quedan intactos.

import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["error"] });

const ID_CONDOMINIO_DEMO = "00000000-0000-0000-0000-000000000001";

type Paso = { tabla: string; contar: () => Prisma.PrismaPromise<number>; borrar: () => Prisma.PrismaPromise<Prisma.BatchPayload> };

function pasos(condominioId: string): Paso[] {
  const c = { condominioId };
  const deUsuario = { usuario: { condominioId } };
  // Primero lo que depende de otras tablas (hijos), al final el condominio.
  return [
    { tabla: "Accesos validados", contar: () => prisma.accesoLog.count({ where: c }), borrar: () => prisma.accesoLog.deleteMany({ where: c }) },
    {
      tabla: "Códigos QR",
      contar: () => prisma.qrToken.count({ where: { OR: [deUsuario, { visita: c }] } }),
      borrar: () => prisma.qrToken.deleteMany({ where: { OR: [deUsuario, { visita: c }] } }),
    },
    { tabla: "Visitas", contar: () => prisma.visita.count({ where: c }), borrar: () => prisma.visita.deleteMany({ where: c }) },
    {
      tabla: "Historial de incidencias",
      contar: () => prisma.incidenciaHistorial.count({ where: { incidencia: c } }),
      borrar: () => prisma.incidenciaHistorial.deleteMany({ where: { incidencia: c } }),
    },
    { tabla: "Incidencias", contar: () => prisma.incidencia.count({ where: c }), borrar: () => prisma.incidencia.deleteMany({ where: c }) },
    {
      tabla: "Reservas",
      contar: () => prisma.reserva.count({ where: { espacioComun: c } }),
      borrar: () => prisma.reserva.deleteMany({ where: { espacioComun: c } }),
    },
    { tabla: "Multas", contar: () => prisma.multa.count({ where: c }), borrar: () => prisma.multa.deleteMany({ where: c }) },
    { tabla: "Encomiendas", contar: () => prisma.encomienda.count({ where: c }), borrar: () => prisma.encomienda.deleteMany({ where: c }) },
    { tabla: "Comunicados", contar: () => prisma.comunicado.count({ where: c }), borrar: () => prisma.comunicado.deleteMany({ where: c }) },
    { tabla: "Documentos", contar: () => prisma.documento.count({ where: c }), borrar: () => prisma.documento.deleteMany({ where: c }) },
    { tabla: "Alertas SOS", contar: () => prisma.alertaSos.count({ where: c }), borrar: () => prisma.alertaSos.deleteMany({ where: c }) },
    { tabla: "Registro de actividad", contar: () => prisma.auditoria.count({ where: c }), borrar: () => prisma.auditoria.deleteMany({ where: c }) },
    { tabla: "Notificaciones", contar: () => prisma.notificacion.count({ where: deUsuario }), borrar: () => prisma.notificacion.deleteMany({ where: deUsuario }) },
    {
      tabla: "Suscripciones push",
      contar: () => prisma.pushSubscription.count({ where: deUsuario }),
      borrar: () => prisma.pushSubscription.deleteMany({ where: deUsuario }),
    },
    { tabla: "Cuentas de usuario", contar: () => prisma.usuario.count({ where: c }), borrar: () => prisma.usuario.deleteMany({ where: c }) },
    { tabla: "Espacios comunes", contar: () => prisma.espacioComun.count({ where: c }), borrar: () => prisma.espacioComun.deleteMany({ where: c }) },
    { tabla: "Departamentos", contar: () => prisma.departamento.count({ where: c }), borrar: () => prisma.departamento.deleteMany({ where: c }) },
    { tabla: "Torres", contar: () => prisma.torre.count({ where: c }), borrar: () => prisma.torre.deleteMany({ where: c }) },
    {
      tabla: "Condominio",
      contar: () => prisma.condominio.count({ where: { id: condominioId } }),
      borrar: () => prisma.condominio.deleteMany({ where: { id: condominioId } }),
    },
  ];
}

async function main() {
  const confirmar = process.argv.includes("--confirmar");
  const condominio = await prisma.condominio.findUnique({ where: { id: ID_CONDOMINIO_DEMO } });
  if (!condominio) {
    console.log("No hay condominio de demostración en esta base de datos. No se borra nada.");
    return;
  }

  const lista = pasos(condominio.id);
  console.log(`Condominio de demostración: "${condominio.nombre}"`);
  for (const paso of lista) {
    const n = await paso.contar();
    if (n > 0) console.log(`  ${paso.tabla}: ${n}`);
  }

  if (!confirmar) {
    console.log("\nNo se borró nada. Para borrar de verdad (irreversible, haz un respaldo antes): npm run vaciar-demo -- --confirmar");
    return;
  }

  // Todo o nada: si algo falla a la mitad, no queda la base a medio borrar.
  await prisma.$transaction(lista.map((paso) => paso.borrar()));
  console.log("\nListo: el condominio de demostración y todos sus datos fueron borrados.");
  console.log('Siguiente paso: npm run crear-condominio -- --condominio "..." --nombre "..." --apellido "..." --email "..." --password "..."');
}

main()
  .catch((error) => {
    console.error("No se pudo completar:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
