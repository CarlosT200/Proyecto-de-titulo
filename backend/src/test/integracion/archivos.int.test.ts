import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cerrarBase, prepararBase, prisma, type DatosPrueba } from "./base";
import { anonimo, entrar, type ClienteHttp } from "./cliente";

// Archivos: subida con verificacion de contenido, limite de tamano, descarga solo con sesion y
// solo para quien corresponde, con cabeceras seguras.

const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);
const HTML = Buffer.from("<html><body><script>alert(document.cookie)</script></body></html>");
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

let datos: DatosPrueba;
let adminA: ClienteHttp;
let residenteA: ClienteHttp;
let vecinaA: ClienteHttp;
let adminB: ClienteHttp;

function manana(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

beforeAll(async () => {
  datos = await prepararBase();
  adminA = await entrar(datos.a.admin);
  residenteA = await entrar(datos.a.residente);
  vecinaA = await entrar(datos.a.residente2);
  adminB = await entrar(datos.b.admin);
});

afterAll(cerrarBase);

describe("documentos del condominio", () => {
  let documentoId: string;

  it("acepta un PDF válido y no devuelve el archivo en la respuesta", async () => {
    const res = await adminA
      .post("/api/documentos")
      .field("titulo", "Reglamento interno")
      .attach("archivo", PDF, { filename: "reglamento.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(201);
    expect(res.body).not.toHaveProperty("archivoUrl");
    documentoId = res.body.id;
  });

  it("rechaza un HTML disfrazado de PDF (tipo falso) con 422", async () => {
    const res = await adminA
      .post("/api/documentos")
      .field("titulo", "Falso")
      .attach("archivo", HTML, { filename: "reglamento.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(422);
  });

  it("rechaza SVG y HTML aunque se declaren como tales", async () => {
    const svg = await adminA.post("/api/documentos").field("titulo", "SVG").attach("archivo", SVG, { filename: "a.svg", contentType: "image/svg+xml" });
    const html = await adminA.post("/api/documentos").field("titulo", "HTML").attach("archivo", HTML, { filename: "a.html", contentType: "text/html" });
    expect(svg.status).toBe(422);
    expect(html.status).toBe(422);
  });

  it("rechaza un archivo de más de 8 MB con 413", async () => {
    const grande = Buffer.concat([PDF, Buffer.alloc(8 * 1024 * 1024 + 10, 0x20)]);
    const res = await adminA.post("/api/documentos").field("titulo", "Grande").attach("archivo", grande, { filename: "g.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(413);
  });

  it("se descarga con la sesión, con nosniff, sin caché y Content-Disposition seguro", async () => {
    const res = await residenteA.get(`/api/documentos/${documentoId}/archivo`).buffer(true);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["cache-control"]).toBe("private, no-store");
    expect(res.headers["content-disposition"]).toBe('inline; filename="Reglamento interno.pdf"');
    expect(Buffer.from(res.body).subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("sin sesión responde 401; desde otro condominio, 404", async () => {
    expect((await anonimo().get(`/api/documentos/${documentoId}/archivo`)).status).toBe(401);
    expect((await adminB.get(`/api/documentos/${documentoId}/archivo`)).status).toBe(404);
  });

  it("los antiguos enlaces con token en la URL ya no existen", async () => {
    expect((await residenteA.post(`/api/documentos/${documentoId}/enlace`)).status).toBe(404);
    expect((await anonimo().get("/api/documentos/archivo/cualquier-token")).status).toBe(401);
  });

  it("/uploads ya no es una carpeta pública", async () => {
    const res = await anonimo().get("/uploads/cualquier-archivo.pdf");
    expect(res.headers["content-type"] ?? "").not.toMatch(/pdf/);
  });
});

describe("comprobantes de pago", () => {
  let comprobanteId: string;

  beforeAll(async () => {
    const periodo = await adminA.post("/api/gastos-comunes/periodos").send({
      anio: 2026,
      mes: 2,
      fechaVencimiento: manana(),
      metodoProrrateo: "PARTES_IGUALES",
      porcentajeFondoReserva: 0,
      partidas: [{ concepto: "Aseo", monto: 100000 }],
    });
    expect(periodo.status).toBe(201);
    const cobro = await prisma.cobroGastoComun.findFirstOrThrow({ where: { periodoId: periodo.body.id, departamentoId: datos.a.depto101 } });

    const res = await residenteA
      .post(`/api/gastos-comunes/cobros/${cobro.id}/comprobantes`)
      .field("monto", "1000")
      .field("fechaPago", new Date().toISOString().slice(0, 10))
      .field("medio", "TRANSFERENCIA")
      .attach("archivo", PNG_1PX, { filename: "transferencia.png", contentType: "image/png" });
    expect(res.status).toBe(201);
    comprobanteId = res.body.id;
  });

  it("lo ve la administración y el residente de la unidad", async () => {
    const admin = await adminA.get(`/api/gastos-comunes/comprobantes/${comprobanteId}/archivo`);
    const propio = await residenteA.get(`/api/gastos-comunes/comprobantes/${comprobanteId}/archivo`);
    expect(admin.status).toBe(200);
    expect(propio.status).toBe(200);
    expect(propio.headers["content-type"]).toBe("image/png");
    expect(propio.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("no lo ve una vecina de otra unidad del mismo condominio ni otro condominio (404)", async () => {
    expect((await vecinaA.get(`/api/gastos-comunes/comprobantes/${comprobanteId}/archivo`)).status).toBe(404);
    expect((await adminB.get(`/api/gastos-comunes/comprobantes/${comprobanteId}/archivo`)).status).toBe(404);
  });
});

describe("límites de entrada", () => {
  it("un cuerpo JSON de más de 2 MB se rechaza con 413", async () => {
    const res = await adminA.post("/api/comunicados").set("Content-Type", "application/json").send(JSON.stringify({ titulo: "x", contenido: "y".repeat(2 * 1024 * 1024 + 10) }));
    expect(res.status).toBe(413);
  });

  it("un JSON mal formado responde 400 sin detalles internos", async () => {
    const res = await adminA.post("/api/comunicados").set("Content-Type", "application/json").send("{titulo:");
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toMatch(/at |stack|SyntaxError/);
  });

  it("textos demasiado largos se rechazan con 422 y mensaje en español", async () => {
    const res = await adminA.post("/api/comunicados").send({ titulo: "t".repeat(121), contenido: "ok" });
    expect(res.status).toBe(422);
    expect(res.body.detalles[0].mensaje).toMatch(/hasta 120 caracteres/);
  });

  it("IDs que no son UUID en el cuerpo se rechazan con 422", async () => {
    const res = await adminA.post("/api/multas").send({ usuarioId: "1 OR 1=1", motivo: "x", fecha: "2026-01-10", monto: 1000 });
    expect(res.status).toBe(422);
  });

  it("fechas imposibles y montos negativos o gigantes se rechazan", async () => {
    const fecha = await adminA.post("/api/multas").send({ usuarioId: datos.a.residente.id, motivo: "x", fecha: "2026-02-31", monto: 1000 });
    const negativo = await adminA.post("/api/multas").send({ usuarioId: datos.a.residente.id, motivo: "x", fecha: "2026-01-10", monto: -5 });
    const gigante = await adminA.post("/api/multas").send({ usuarioId: datos.a.residente.id, motivo: "x", fecha: "2026-01-10", monto: 1e12 });
    expect([fecha.status, negativo.status, gigante.status]).toEqual([422, 422, 422]);
  });

  it("estados fuera de la lista permitida se rechazan", async () => {
    const res = await adminA.get("/api/incidencias?estado=BORRADA");
    expect(res.status).toBe(422);
  });

  it("un teléfono con caracteres extraños se rechaza", async () => {
    const res = await residenteA.patch("/api/auth/me").send({ telefono: "<script>" });
    expect(res.status).toBe(422);
  });

  it("una visita de más de 30 días se rechaza", async () => {
    const inicio = new Date();
    const fin = new Date(inicio.getTime() + 40 * 24 * 3600 * 1000);
    const res = await residenteA.post("/api/qr/visitas").send({
      nombreVisita: "Larga",
      fecha: inicio.toISOString().slice(0, 10),
      periodoInicio: inicio.toISOString(),
      periodoFin: fin.toISOString(),
    });
    expect(res.status).toBe(422);
  });

  it("el SOS solo acepta los tres tipos de emergencia", async () => {
    const res = await residenteA.post("/api/sos").send({ tipo: "POLICIA_FALSA" });
    expect(res.status).toBe(422);
  });
});
