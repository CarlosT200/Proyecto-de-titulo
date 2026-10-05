import {
  EstadoEncomienda,
  EstadoIncidencia,
  EstadoMulta,
  EstadoVisita,
  MedioPago,
  MetodoProrrateo,
  PrioridadIncidencia,
  PrismaClient,
  ResultadoAcceso,
  Rol,
  TipoComunicado,
  TipoQrToken,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { recargoFondoReserva, repartirMonto } from "../src/lib/gastosComunes";

const prisma = new PrismaClient();

async function main() {
  const passwordDemo = await bcrypt.hash("Habita2026!", 12);

  const condominio = await prisma.condominio.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      nombre: "Condominio Los Alerces",
      direccion: "Av. Siempre Viva 742",
      comuna: "Providencia",
    },
  });

  // findFirst + create (en vez de create a secas) para que el seed se pueda correr dos veces
  // sin chocar con el unique de departamentos.
  const torre = await obtenerTorre(condominio.id, "Torre A");
  const departamento = await obtenerDepartamento(condominio.id, torre.id, "101");

  const admin = await prisma.usuario.upsert({
    where: { email: "admin@habitasmart.cl" },
    update: {},
    create: {
      condominioId: condominio.id,
      email: "admin@habitasmart.cl",
      passwordHash: passwordDemo,
      nombre: "Ana",
      apellido: "Administradora",
      rol: Rol.ADMIN,
    },
  });

  const residente = await prisma.usuario.upsert({
    where: { email: "residente@habitasmart.cl" },
    update: {},
    create: {
      condominioId: condominio.id,
      email: "residente@habitasmart.cl",
      passwordHash: passwordDemo,
      nombre: "Roberto",
      apellido: "Residente",
      rol: Rol.RESIDENTE,
      departamentoId: departamento.id,
    },
  });

  const conserje = await prisma.usuario.upsert({
    where: { email: "conserje@habitasmart.cl" },
    update: {},
    create: {
      condominioId: condominio.id,
      email: "conserje@habitasmart.cl",
      passwordHash: passwordDemo,
      nombre: "Carlos",
      apellido: "Conserje",
      rol: Rol.CONSERJE,
    },
  });

  const yaTieneEspacios = (await prisma.espacioComun.count({ where: { condominioId: condominio.id } })) > 0;
  if (!yaTieneEspacios) {
    await prisma.espacioComun.createMany({
      data: [
      {
        condominioId: condominio.id,
        nombre: "Quincho",
        descripcion: "Espacio con parrilla para eventos familiares.",
        capacidad: 20,
        horarioInicio: "10:00",
        horarioFin: "23:00",
      },
      {
        condominioId: condominio.id,
        nombre: "Sala de eventos",
        descripcion: "Salon multiuso con capacidad para reuniones.",
        capacidad: 30,
        horarioInicio: "09:00",
        horarioFin: "22:00",
      },
      ],
    });
  }

  // Datos de ejemplo para que el dashboard y las listas no se vean vacios en una demostracion.
  // Solo se crean la primera vez (si el condominio demo aun no tiene comunicados).
  const yaTieneDatosDemo = (await prisma.comunicado.count({ where: { condominioId: condominio.id } })) > 0;
  if (!yaTieneDatosDemo) {
    await crearDatosDemo({
      condominioId: condominio.id,
      torreId: torre.id,
      adminId: admin.id,
      residenteId: residente.id,
      conserjeId: conserje.id,
      passwordHash: passwordDemo,
    });
  }

  // Gastos comunes de ejemplo (dos meses), aparte, para que tambien se agreguen a una base que ya
  // tenia los demas datos de demostracion.
  const yaTieneGastosComunes = (await prisma.periodoGastoComun.count({ where: { condominioId: condominio.id } })) > 0;
  if (!yaTieneGastosComunes) {
    await crearGastosComunesDemo(condominio.id, admin.id);
  }

  console.log("Seed completado. Usuarios de prueba (password: Habita2026!):");
  console.log(" - admin@habitasmart.cl (ADMIN)");
  console.log(" - residente@habitasmart.cl (RESIDENTE)");
  console.log(" - conserje@habitasmart.cl (CONSERJE)");
}

async function obtenerTorre(condominioId: string, nombre: string) {
  return (
    (await prisma.torre.findFirst({ where: { condominioId, nombre } })) ??
    (await prisma.torre.create({ data: { condominioId, nombre } }))
  );
}

async function obtenerDepartamento(condominioId: string, torreId: string, numero: string) {
  return (
    (await prisma.departamento.findFirst({ where: { condominioId, torreId, numero } })) ??
    (await prisma.departamento.create({ data: { condominioId, torreId, numero } }))
  );
}

// Fecha relativa a hoy (dias negativos = pasado), a una hora dada.
function dia(desplazamiento: number, hora = 12, minuto = 0) {
  const d = new Date();
  d.setDate(d.getDate() + desplazamiento);
  d.setHours(hora, minuto, 0, 0);
  return d;
}

// Para columnas @db.Date: medianoche UTC del dia, asi no se corre un dia por la zona horaria.
function fecha(desplazamiento: number) {
  const d = dia(desplazamiento);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

interface IdsDemo {
  condominioId: string;
  torreId: string;
  adminId: string;
  residenteId: string;
  conserjeId: string;
  passwordHash: string;
}

async function crearDatosDemo({ condominioId, torreId, adminId, residenteId, conserjeId, passwordHash }: IdsDemo) {
  // Mas residentes, para que las tablas tengan varias filas.
  const torreB = await obtenerTorre(condominioId, "Torre B");
  const depto102 = await obtenerDepartamento(condominioId, torreId, "102");
  const depto201 = await obtenerDepartamento(condominioId, torreB.id, "201");

  const valentina = await prisma.usuario.upsert({
    where: { email: "valentina@habitasmart.cl" },
    update: {},
    create: {
      condominioId,
      email: "valentina@habitasmart.cl",
      passwordHash,
      nombre: "Valentina",
      apellido: "Rojas",
      telefono: "+56 9 8765 4321",
      rol: Rol.RESIDENTE,
      departamentoId: depto102.id,
    },
  });
  const matias = await prisma.usuario.upsert({
    where: { email: "matias@habitasmart.cl" },
    update: {},
    create: {
      condominioId,
      email: "matias@habitasmart.cl",
      passwordHash,
      nombre: "Matías",
      apellido: "Fuentes",
      rol: Rol.RESIDENTE,
      departamentoId: depto201.id,
    },
  });

  const espacios = await prisma.espacioComun.findMany({ where: { condominioId }, orderBy: { nombre: "asc" } });
  const quincho = espacios.find((e) => e.nombre === "Quincho") ?? espacios[0];
  const sala = espacios.find((e) => e.nombre === "Sala de eventos") ?? espacios[0];

  await prisma.comunicado.create({
    data: {
      condominioId,
      autorId: adminId,
      tipo: TipoComunicado.CORTE_AGUA,
      titulo: "Corte de agua programado",
      contenido: "El jueves entre 10:00 y 14:00 se cortará el agua en la Torre A por mantención de bombas.",
      createdAt: dia(-1, 9),
    },
  });
  await prisma.comunicado.create({
    data: {
      condominioId,
      autorId: adminId,
      tipo: TipoComunicado.REUNION,
      titulo: "Asamblea de copropietarios",
      contenido: "Los invitamos a la asamblea anual el sábado a las 11:00 en la sala de eventos.",
      createdAt: dia(-3, 18),
    },
  });
  await prisma.comunicado.create({
    data: {
      condominioId,
      autorId: adminId,
      tipo: TipoComunicado.MANTENCION,
      titulo: "Mantención de ascensores",
      contenido: "Durante la próxima semana se hará la mantención preventiva de los ascensores de ambas torres.",
      createdAt: dia(-6, 12),
    },
  });

  await prisma.reserva.createMany({
    data: [
      { espacioComunId: quincho.id, usuarioId: residenteId, fecha: fecha(2), horaInicio: "13:00", horaFin: "17:00" },
      { espacioComunId: sala.id, usuarioId: valentina.id, fecha: fecha(4), horaInicio: "18:00", horaFin: "21:00" },
      { espacioComunId: quincho.id, usuarioId: matias.id, fecha: fecha(7), horaInicio: "12:00", horaFin: "16:00" },
      { espacioComunId: sala.id, usuarioId: residenteId, fecha: fecha(-5), horaInicio: "19:00", horaFin: "22:00" },
    ],
  });

  await prisma.multa.createMany({
    data: [
      {
        condominioId,
        usuarioId: residenteId,
        registradaPorId: adminId,
        motivo: "Ruidos molestos después de las 23:00",
        fecha: fecha(-4),
        monto: 25000,
        estado: EstadoMulta.PENDIENTE,
      },
      {
        condominioId,
        usuarioId: matias.id,
        registradaPorId: adminId,
        motivo: "Estacionar en lugar de visitas",
        fecha: fecha(-12),
        monto: 15000,
        estado: EstadoMulta.PAGADA,
      },
      {
        condominioId,
        usuarioId: valentina.id,
        registradaPorId: adminId,
        motivo: "Mascota sin correa en áreas comunes",
        fecha: fecha(-8),
        monto: 10000,
        estado: EstadoMulta.APELADA,
        observaciones: "La residente indica que la mascota no es suya.",
      },
    ],
  });

  const incidencias = [
    {
      usuarioId: residenteId,
      titulo: "Filtración en el baño",
      descripcion: "Gotea agua desde el techo del baño, parece venir del departamento de arriba.",
      ubicacion: "Torre A, depto 101",
      categoria: "AGUA",
      prioridad: PrioridadIncidencia.ALTA,
      estado: EstadoIncidencia.EN_PROCESO,
      creada: -3,
    },
    {
      usuarioId: valentina.id,
      titulo: "Luz del pasillo quemada",
      descripcion: "La luz del pasillo del piso 1 no enciende desde ayer.",
      ubicacion: "Torre A, piso 1",
      categoria: "ELECTRICIDAD",
      prioridad: PrioridadIncidencia.MEDIA,
      estado: EstadoIncidencia.REPORTADA,
      creada: -1,
    },
    {
      usuarioId: matias.id,
      titulo: "Ascensor hace ruido",
      descripcion: "El ascensor de la Torre B hace un ruido fuerte al llegar al piso 2.",
      ubicacion: "Torre B, ascensor",
      categoria: "ASCENSOR",
      prioridad: PrioridadIncidencia.MEDIA,
      estado: EstadoIncidencia.EN_REVISION,
      creada: -2,
    },
    {
      usuarioId: residenteId,
      titulo: "Basura acumulada en la sala de reciclaje",
      descripcion: "Los contenedores están llenos y hay mal olor.",
      ubicacion: "Subterráneo",
      categoria: "LIMPIEZA",
      prioridad: PrioridadIncidencia.BAJA,
      estado: EstadoIncidencia.RESUELTA,
      creada: -9,
    },
  ];
  const orden = [EstadoIncidencia.REPORTADA, EstadoIncidencia.EN_REVISION, EstadoIncidencia.EN_PROCESO, EstadoIncidencia.RESUELTA];
  for (const { creada, ...datos } of incidencias) {
    const incidencia = await prisma.incidencia.create({
      data: {
        condominioId,
        ...datos,
        responsableId: datos.estado === EstadoIncidencia.REPORTADA ? null : adminId,
        createdAt: dia(creada, 10),
      },
    });
    // Historial coherente con el estado actual: reportada -> ... -> estado actual.
    const hasta = orden.indexOf(datos.estado);
    for (let i = 0; i <= hasta; i++) {
      await prisma.incidenciaHistorial.create({
        data: {
          incidenciaId: incidencia.id,
          estadoAnterior: i === 0 ? null : orden[i - 1],
          estadoNuevo: orden[i],
          usuarioId: i === 0 ? datos.usuarioId : adminId,
          createdAt: dia(creada + i, 10 + i),
        },
      });
    }
  }

  await prisma.encomienda.createMany({
    data: [
      { condominioId, usuarioId: residenteId, registradaPorId: conserjeId, remitente: "Chilexpress", numeroSeguimiento: "CX-48213", ubicacion: "Estante A", fechaRecepcion: dia(0, 9, 30) },
      { condominioId, usuarioId: residenteId, registradaPorId: conserjeId, remitente: "Mercado Libre", ubicacion: "Estante B", fechaRecepcion: dia(-1, 16) },
      { condominioId, usuarioId: valentina.id, registradaPorId: conserjeId, remitente: "Starken", ubicacion: "Bodega", observaciones: "Caja grande.", fechaRecepcion: dia(-3, 11) },
      {
        condominioId,
        usuarioId: matias.id,
        registradaPorId: conserjeId,
        remitente: "Correos de Chile",
        estado: EstadoEncomienda.RETIRADA,
        fechaRecepcion: dia(-4, 10),
        fechaRetiro: dia(-3, 19),
        retiradaPor: "Matías Fuentes",
        cerradaPorId: conserjeId,
      },
    ],
  });

  // Visitas ya pasadas con su QR y el registro de validacion en conserjeria.
  const visitas = [
    { nombre: "Camila Soto", residente: residenteId, desplazamiento: -1, resultado: ResultadoAcceso.AUTORIZADO, motivo: "Visita autorizada" },
    { nombre: "Jorge Muñoz", residente: valentina.id, desplazamiento: -2, resultado: ResultadoAcceso.AUTORIZADO, motivo: "Visita autorizada" },
    { nombre: "Pedro Lagos", residente: matias.id, desplazamiento: -2, resultado: ResultadoAcceso.RECHAZADO, motivo: "Código QR expirado" },
  ];
  for (const v of visitas) {
    const visita = await prisma.visita.create({
      data: {
        condominioId,
        residenteId: v.residente,
        nombreVisita: v.nombre,
        fecha: fecha(v.desplazamiento),
        periodoInicio: dia(v.desplazamiento, 15),
        periodoFin: dia(v.desplazamiento, 20),
        soloUnUso: true,
        estado: v.resultado === ResultadoAcceso.AUTORIZADO ? EstadoVisita.USADA : EstadoVisita.EXPIRADA,
      },
    });
    const token = await prisma.qrToken.create({
      data: {
        tipo: TipoQrToken.VISITA,
        token: `demo-${visita.id}`,
        visitaId: visita.id,
        expiraEn: dia(v.desplazamiento, 20),
        usosMaximos: 1,
        usosRealizados: v.resultado === ResultadoAcceso.AUTORIZADO ? 1 : 0,
      },
    });
    await prisma.accesoLog.create({
      data: {
        condominioId,
        qrTokenId: token.id,
        validadoPorId: conserjeId,
        resultado: v.resultado,
        motivo: v.motivo,
        createdAt: dia(v.desplazamiento, v.resultado === ResultadoAcceso.AUTORIZADO ? 16 : 21),
      },
    });
  }

  await prisma.auditoria.createMany({
    data: [
      { condominioId, usuarioId: adminId, accion: "CREAR", entidad: "Comunicado", descripcion: "Publicó el comunicado \"Corte de agua programado\".", createdAt: dia(-1, 9) },
      { condominioId, usuarioId: adminId, accion: "CREAR", entidad: "Multa", descripcion: "Registró una multa a Roberto Residente por $25.000.", createdAt: dia(-4, 13) },
      { condominioId, usuarioId: adminId, accion: "ACTUALIZAR", entidad: "Incidencia", descripcion: "Cambió la incidencia \"Filtración en el baño\" a En proceso.", createdAt: dia(-1, 12) },
    ],
  });
}

// Dos meses: el anterior al pasado ya vencio (una unidad quedo debiendo) y el pasado vence en unos dias.
async function crearGastosComunesDemo(condominioId: string, adminId: string) {
  const departamentos = await prisma.departamento.findMany({
    where: { condominioId },
    select: { id: true, numero: true, torre: { select: { nombre: true } } },
  });
  if (departamentos.length === 0) return;

  const hoy = new Date();
  const meses = [
    {
      atras: 2,
      vence: fecha(-20),
      partidas: [
        { concepto: "Remuneraciones de conserjería y aseo", monto: 1_850_000 },
        { concepto: "Agua y electricidad de áreas comunes", monto: 420_000 },
        { concepto: "Mantención de ascensores", monto: 260_000 },
        { concepto: "Jardinería", monto: 180_000 },
        { concepto: "Seguro del edificio", monto: 140_000 },
      ],
    },
    {
      atras: 1,
      vence: fecha(5),
      partidas: [
        { concepto: "Remuneraciones de conserjería y aseo", monto: 1_850_000 },
        { concepto: "Agua y electricidad de áreas comunes", monto: 465_000 },
        { concepto: "Mantención de ascensores", monto: 260_000 },
        { concepto: "Reparación de la bomba de agua", monto: 310_000 },
        { concepto: "Seguro del edificio", monto: 140_000 },
      ],
    },
  ];

  for (const m of meses) {
    const referencia = new Date(hoy.getFullYear(), hoy.getMonth() - m.atras, 1);
    const totalGastos = m.partidas.reduce((s, x) => s + x.monto, 0);
    const gasto = repartirMonto(totalGastos, departamentos.map(() => 1));
    const periodo = await prisma.periodoGastoComun.create({
      data: {
        condominioId,
        anio: referencia.getFullYear(),
        mes: referencia.getMonth() + 1,
        fechaVencimiento: m.vence,
        metodoProrrateo: MetodoProrrateo.PARTES_IGUALES,
        porcentajeFondoReserva: 5,
        totalGastos,
        instruccionesPago:
          "Transferencia a la cuenta corriente de la comunidad, indicando tu número de departamento en el comentario. También puedes pagar en efectivo en la administración, de lunes a viernes de 9:00 a 18:00.",
        creadoPorId: adminId,
        partidas: { createMany: { data: m.partidas.map((x, orden) => ({ ...x, orden })) } },
      },
    });

    for (const [i, d] of departamentos.entries()) {
      const fondo = recargoFondoReserva(gasto[i], 5);
      const total = gasto[i] + fondo;
      // Mes antiguo: todos pagaron menos el 201. Mes reciente: solo el 102 pagó.
      const pagado = m.atras === 2 ? d.numero !== "201" : d.numero === "102";
      const cobro = await prisma.cobroGastoComun.create({
        data: {
          condominioId,
          periodoId: periodo.id,
          departamentoId: d.id,
          montoGastoComun: gasto[i],
          montoFondoReserva: fondo,
          montoTotal: total,
          montoPagado: pagado ? total : 0,
          pagado,
        },
      });
      if (pagado) {
        await prisma.pagoGastoComun.create({
          data: {
            cobroId: cobro.id,
            monto: total,
            fechaPago: m.atras === 2 ? fecha(-24) : fecha(-1),
            medio: d.numero === "102" ? MedioPago.EFECTIVO : MedioPago.TRANSFERENCIA,
            referencia: d.numero === "102" ? null : `TR-${d.numero}-${referencia.getMonth() + 1}`,
            registradoPorId: adminId,
          },
        });
      }
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
