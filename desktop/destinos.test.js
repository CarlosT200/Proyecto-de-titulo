// Pruebas de la validacion de destinos de la app de escritorio.
// Se ejecutan con el runner nativo de Node (sin dependencias): npm test --prefix desktop
// o, desde la raiz, npm run test:desktop.
const test = require("node:test");
const assert = require("node:assert/strict");
const d = require("./destinos");

const PELIGROSOS = [
  "javascript:alert(1)",
  "JAVASCRIPT:alert(document.cookie)",
  "data:text/html,<script>alert(1)</script>",
  "file:///C:/Windows/System32/calc.exe",
  "vbscript:msgbox(1)",
  "ms-settings:privacy",
  "habitasmart://abrir",
  "https://usuario:clave@habitasmart.onrender.com/",
  "https://usuario@habitasmart.onrender.com/",
  "no es una url",
  "",
  "   ",
  "//habitasmart.onrender.com",
  "/residente",
];

test("boton Reintentar: la URL oficial vuelve a la URL oficial (constante de la lista)", () => {
  assert.equal(d.destinoDeReintento("https://habitasmart.onrender.com"), "https://habitasmart.onrender.com/");
  assert.equal(d.destinoDeReintento("https://habitasmart.onrender.com/conserje/qr?x=1"), "https://habitasmart.onrender.com/");
});

test("boton Reintentar: otro sitio https NO es destino (evita redireccion abierta)", () => {
  assert.equal(d.destinoDeReintento("https://sitio-malicioso.example/"), null);
  assert.equal(d.destinoDeReintento("https://habitasmart.onrender.com.sitio-malicioso.example/"), null);
  assert.equal(d.destinoDeReintento("http://habitasmart.onrender.com/"), null);
});

test("boton Reintentar: localhost solo en desarrollo", () => {
  assert.equal(d.destinoDeReintento("http://localhost:4000/"), null);
  assert.equal(d.destinoDeReintento("http://127.0.0.1:4000/"), null);
  assert.equal(d.destinoDeReintento("http://localhost:4000/", { desarrollo: true }), "http://localhost:4000/");
  assert.equal(d.destinoDeReintento("http://127.0.0.1:5173/login", { desarrollo: true }), "http://127.0.0.1:5173/");
  assert.equal(d.destinoDeReintento("http://localhost:9999/", { desarrollo: true }), null);
});

test("boton Reintentar: rechaza javascript:, data:, file:, credenciales y texto invalido", () => {
  for (const valor of [...PELIGROSOS, null, undefined, 42, {}]) {
    assert.equal(d.destinoDeReintento(valor), null, String(valor));
    assert.equal(d.destinoDeReintento(valor, { desarrollo: true }), null, String(valor));
  }
});

test("URL del sitio (HABITASMART_URL): https valido; http solo localhost en desarrollo", () => {
  assert.equal(d.esUrlDeSitioPermitida("https://habitasmart.onrender.com"), true);
  assert.equal(d.esUrlDeSitioPermitida("https://staging-habitasmart.onrender.com"), true);
  assert.equal(d.esUrlDeSitioPermitida("http://localhost:4000"), false);
  assert.equal(d.esUrlDeSitioPermitida("http://localhost:4000", { desarrollo: true }), true);
  assert.equal(d.esUrlDeSitioPermitida("http://192.168.1.10:4000", { desarrollo: true }), false);
  assert.equal(d.esUrlDeSitioPermitida("http://ejemplo.cl", { desarrollo: true }), false);
  for (const valor of PELIGROSOS) assert.equal(d.esUrlDeSitioPermitida(valor, { desarrollo: true }), false, valor);
});

test("shell.openExternal: solo https, http, mailto y tel", () => {
  assert.equal(d.esUrlExternaPermitida("https://www.google.com/maps"), true);
  assert.equal(d.esUrlExternaPermitida("http://sitio-sin-https.cl/aviso"), true);
  assert.equal(d.esUrlExternaPermitida("mailto:administracion@condominio.example"), true);
  assert.equal(d.esUrlExternaPermitida("tel:+56900000000"), true);
  for (const valor of PELIGROSOS) assert.equal(d.esUrlExternaPermitida(valor), false, valor);
  assert.equal(d.esUrlExternaPermitida("smb://servidor/compartido"), false);
  assert.equal(d.esUrlExternaPermitida("ftp://servidor/archivo"), false);
});

test("las listas exportadas no se pueden modificar desde fuera", () => {
  d.ORIGENES_APP.push("https://sitio-malicioso.example");
  assert.equal(d.destinoDeReintento("https://sitio-malicioso.example/"), null);
});
