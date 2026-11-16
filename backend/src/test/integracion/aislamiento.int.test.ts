import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EstadoMulta, TipoEmergenciaSos } from "@prisma/client";
import { cerrarBase, prepararBase, prisma, type DatosPrueba } from "./base";
import { entrar, type ClienteHttp } from "./cliente";

// --- Aislamiento entre condominios ---------------------------------------------------------------
// Un usuario del condominio A (cualquier rol) no puede ver ni tocar datos del condominio B, aunque
// conozca los IDs reales. Las respuestas son 404 (el recurso "no existe" para el) o, en el QR, un
// rechazo: nunca 200 ni un 403 que confirme que el dato existe.

let datos: DatosPrueba;
let adminA: ClienteHttp;
let conserjeA: ClienteHttp;
let residenteA: ClienteHttp;
let residenteB: ClienteHttp;
let conserjeB: ClienteHttp;

// Datos del condominio B que A intentara alcanzar.
let idsB: {
  multa: string;
  incidencia: string;
  encomienda: string;
  reserva: string;
  comunicado: string;
  documento: string;
  alerta: string;
  visita: string;
  notificacion: string;
  cobro: string;
  periodo: string;
};

function manana(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

beforeAll(async () => {
  datos = await prepararBase();
  adminA = await entrar(datos.a.admin);
  conserjeA = await entrar(datos.a.conserje);
  residenteA = await entrar(datos.a.residente);
  residenteB = await entrar(datos.b.residente);
  conserjeB = await entrar(datos.b.conserje);
  const b = datos.b;

  const multa = await prisma.multa.create({
    data: { condominioId: b.id, usuarioId: b.residente.id, registradaPorId: b.admin.id, motivo: "Prueba", fecha: new Date(), monto: 1000, estado: EstadoMulta.PENDIENTE },
  });
  const incidencia = await prisma.incidencia.create({
    data: { condominioId: b.id, usuarioId: b.residente.id, titulo: "Prueba", descripcion: "Prueba", ubicacion: "Prueba", categoria: "OTRO" },
  });
  const encomienda = await prisma.encomienda.create({
    data: { condominioId: b.id, usuarioId: b.residente.id, registradaPorId: b.conserje.id, remitente: "Prueba" },
  });
  const reserva = await prisma.reserva.create({
    data: { espacioComunId: b.quinchoId, usuarioId: b.residente.id, fecha: new Date(`${manana()}T00:00:00.000Z`), horaInicio: "12:00", horaFin: "14:00" },
  });
  const comunicado = await prisma.comunicado.create({
    data: { condominioId: b.id, autorId: b.admin.id, titulo: "Prueba", contenido: "Prueba" },
  });
  const documento = await prisma.documento.create({
    data: { condominioId: b.id, subidoPorId: b.admin.id, titulo: "Reglamento B", archivoUrl: "data:application/pdf;base64,JVBERi0xLjQK" },
  });
  const alerta = await prisma.alertaSos.create({ data: { condominioId: b.id, usuarioId: b.residente.id, tipo: TipoEmergenciaSos.BOMBEROS } });
  const visitaRes = await residenteB.post("/api/qr/visitas/rapida").send({ nombreVisita: "Visita B" });
  const notificacion = await prisma.notificacion.create({
    data: { usuarioId: b.residente.id, tipo: "PRUEBA", titulo: "Solo para B", mensaje: "Privado" },
  });
  const periodoRes = await (await entrar(b.admin)).post("/api/gastos-comunes/periodos").send({
    anio: 2026,
    mes: 1,
    // el vencimiento no puede ser anterior a hoy
    fechaVencimiento: manana(),
    metodoProrrateo: "PARTES_IGUALES",
    porcentajeFondoReserva: 0,
    partidas: [{ concepto: "Aseo", monto: 100000 }],
  });
  expect(periodoRes.status).toBe(201);
  const cobro = await prisma.cobroGastoComun.findFirstOrThrow({ where: { periodoId: periodoRes.body.id } });

  idsB = {
    multa: multa.id,
    incidencia: incidencia.id,
    encomienda: encomienda.id,
    reserva: reserva.id,
    comunicado: comunicado.id,
    documento: documento.id,
    alerta: alerta.id,
    visita: visitaRes.body.visitaId,
    notificacion: notificacion.id,
    cobro: cobro.id,
    periodo: periodoRes.body.id,
  };
});

afterAll(cerrarBase);

describe("usuarios y unidades", () => {
  it("el listado de usuarios solo trae los del propio condominio", async () => {
    const res = await adminA.get("/api/usuarios");
    expect(res.status).toBe(200);
    const condominios = new Set(res.body.map((u: { email: string }) => u.email.split("@")[0].split(".").pop()));
    expect([...condominios]).toEqual(["a"]);
  });

  it("obtener, editar o restablecer la contraseña de un usuario de otro condominio: 404", async () => {
    expect((await adminA.get(`/api/usuarios/${datos.b.residente.id}`)).status).toBe(404);
    expect((await adminA.patch(`/api/usuarios/${datos.b.residente.id}`).send({ nombre: "Hackeado" })).status).toBe(404);
    expect((await adminA.post(`/api/usuarios/${datos.b.residente.id}/restablecer-password`).send({ password: "Otra-Clave-123" })).status).toBe(404);
    const intacto = await prisma.usuario.findUniqueOrThrow({ where: { id: datos.b.residente.id } });
    expect(intacto.nombre).toBe("Residente");
  });

  it("no se puede asociar un usuario a una unidad de otro condominio", async () => {
    const res = await adminA.patch(`/api/usuarios/${datos.a.residente.id}`).send({ departamentoId: datos.b.depto101 });
    expect(res.status).toBe(404);
  });

  it("una multa solo puede cursarse a un residente del propio condominio", async () => {
    const res = await adminA.post("/api/multas").send({ usuarioId: datos.b.residente.id, motivo: "Prueba", fecha: "2026-01-10", monto: 1000 });
    expect(res.status).toBe(404);
  });
});

describe("recursos por ID de otro condominio", () => {
  it("multas: editar, eliminar, apelar o resolver → 404", async () => {
    expect((await adminA.patch(`/api/multas/${idsB.multa}`).send({ estado: "PAGADA" })).status).toBe(404);
    expect((await adminA.delete(`/api/multas/${idsB.multa}`)).status).toBe(404);
    expect((await residenteA.patch(`/api/multas/${idsB.multa}/apelar`).send({ motivo: "No corresponde esta multa." })).status).toBe(404);
    expect((await adminA.patch(`/api/multas/${idsB.multa}/resolver-apelacion`).send({ decision: "ACEPTADA", respuesta: "Se acepta la apelación." })).status).toBe(404);
  });

  it("incidencias: ver o actualizar → 404", async () => {
    expect((await adminA.get(`/api/incidencias/${idsB.incidencia}`)).status).toBe(404);
    expect((await residenteA.get(`/api/incidencias/${idsB.incidencia}`)).status).toBe(404);
    expect((await adminA.patch(`/api/incidencias/${idsB.incidencia}`).send({ estado: "RESUELTA" })).status).toBe(404);
  });

  it("encomiendas: registrar para un residente ajeno, ver, entregar o devolver → 404", async () => {
    expect((await conserjeA.post("/api/encomiendas").field("usuarioId", datos.b.residente.id)).status).toBe(404);
    expect((await conserjeA.get(`/api/encomiendas/${idsB.encomienda}`)).status).toBe(404);
    expect((await residenteA.get(`/api/encomiendas/${idsB.encomienda}`)).status).toBe(404);
    expect((await conserjeA.patch(`/api/encomiendas/${idsB.encomienda}/retirar`).send({})).status).toBe(404);
    expect((await conserjeA.patch(`/api/encomiendas/${idsB.encomienda}/devolver`).send({ motivo: "Prueba" })).status).toBe(404);
    const intacta = await prisma.encomienda.findUniqueOrThrow({ where: { id: idsB.encomienda } });
    expect(intacta.estado).toBe("NOTIFICADA");
  });

  it("reservas: espacio de otro condominio, disponibilidad y cancelar → 404", async () => {
    expect((await residenteA.post("/api/reservas").send({ espacioComunId: datos.b.quinchoId, fecha: manana(), horaInicio: "15:00", horaFin: "16:00" })).status).toBe(404);
    expect((await residenteA.get(`/api/reservas/disponibilidad?espacioComunId=${datos.b.quinchoId}&fecha=${manana()}`)).status).toBe(404);
    expect((await adminA.patch(`/api/reservas/${idsB.reserva}/cancelar`)).status).toBe(404);
    expect((await residenteA.patch(`/api/reservas/${idsB.reserva}/cancelar`)).status).toBe(404);
  });

  it("comunicados y documentos de otro condominio no se listan ni se pueden eliminar ni enlazar", async () => {
    const comunicados = await residenteA.get("/api/comunicados");
    expect(comunicados.body.map((c: { id: string }) => c.id)).not.toContain(idsB.comunicado);
    expect((await adminA.delete(`/api/comunicados/${idsB.comunicado}`)).status).toBe(404);
    const documentos = await residenteA.get("/api/documentos");
    expect(documentos.body.map((d: { id: string }) => d.id)).not.toContain(idsB.documento);
    expect((await adminA.delete(`/api/documentos/${idsB.documento}`)).status).toBe(404);
    expect((await residenteA.post(`/api/documentos/${idsB.documento}/enlace`)).status).toBe(404);
  });

  it("SOS: las alertas de B no aparecen en A y no se pueden atender desde A", async () => {
    const lista = await conserjeA.get("/api/sos");
    expect(lista.body.map((a: { id: string }) => a.id)).not.toContain(idsB.alerta);
    expect((await conserjeA.patch(`/api/sos/${idsB.alerta}/atender`).send({})).status).toBe(404);
    const intacta = await prisma.alertaSos.findUniqueOrThrow({ where: { id: idsB.alerta } });
    expect(intacta.estado).toBe("ACTIVA");
  });

  it("visitas: generar, ver o revocar el QR de una visita ajena → 404", async () => {
    expect((await residenteA.post(`/api/qr/visitas/${idsB.visita}/qr`)).status).toBe(404);
    expect((await residenteA.get(`/api/qr/visitas/${idsB.visita}/qr`)).status).toBe(404);
    expect((await residenteA.patch(`/api/qr/visitas/${idsB.visita}/revocar`)).status).toBe(404);
  });

  it("QR: un conserje de A no puede validar un QR emitido en B (se rechaza y queda registrado)", async () => {
    const qr = await prisma.qrToken.findFirstOrThrow({ where: { visitaId: idsB.visita } });
    const res = await conserjeA.post("/api/qr/validar").send({ token: qr.token });
    expect(res.status).toBe(200);
    expect(res.body.resultado).toBe("RECHAZADO");
    expect(res.body.motivo).toMatch(/no reconocido/);
    // el mismo QR sigue valiendo en su condominio
    const propio = await conserjeB.post("/api/qr/validar").send({ token: qr.token });
    expect(propio.body.resultado).toBe("AUTORIZADO");
  });

  it("notificaciones: las de otra persona no se ven ni se pueden marcar o borrar", async () => {
    const lista = await residenteA.get("/api/notificaciones");
    expect(lista.body.map((n: { id: string }) => n.id)).not.toContain(idsB.notificacion);
    await residenteA.patch(`/api/notificaciones/${idsB.notificacion}/leer`);
    await residenteA.delete(`/api/notificaciones/${idsB.notificacion}`);
    const intacta = await prisma.notificacion.findUnique({ where: { id: idsB.notificacion } });
    expect(intacta).not.toBeNull();
    expect(intacta!.leida).toBe(false);
  });

  it("gastos comunes: cobros, periodos y pagos de otro condominio → 404", async () => {
    expect((await adminA.get(`/api/gastos-comunes/cobros/${idsB.cobro}`)).status).toBe(404);
    expect((await residenteA.get(`/api/gastos-comunes/cobros/${idsB.cobro}`)).status).toBe(404);
    expect((await adminA.get(`/api/gastos-comunes/periodos/${idsB.periodo}`)).status).toBe(404);
    expect((await adminA.delete(`/api/gastos-comunes/periodos/${idsB.periodo}`)).status).toBe(404);
    expect(
      (await adminA.post(`/api/gastos-comunes/cobros/${idsB.cobro}/pagos`).send({ monto: 1000, fechaPago: "2026-01-05", medio: "EFECTIVO" })).status
    ).toBe(404);
    const periodos = await adminA.get("/api/gastos-comunes/periodos");
    expect(periodos.body.map((p: { id: string }) => p.id)).not.toContain(idsB.periodo);
    const intacto = await prisma.cobroGastoComun.findUniqueOrThrow({ where: { id: idsB.cobro } });
    expect(intacto.montoPagado).toBe(0);
  });

  it("auditoría y accesos: solo los del propio condominio", async () => {
    const auditoria = await adminA.get("/api/auditoria");
    expect(auditoria.status).toBe(200);
    for (const r of auditoria.body) expect(r.condominioId).toBe(datos.a.id);
    const accesos = await adminA.get("/api/qr/accesos");
    for (const r of accesos.body) expect(r.condominioId).toBe(datos.a.id);
  });
});
