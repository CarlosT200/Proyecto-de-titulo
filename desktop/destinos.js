// Validacion de destinos de la app de escritorio (CodeQL js/xss y
// js/client-side-unvalidated-url-redirection en offline.html).
//
// Se usa en dos lugares:
// - main.js (proceso principal, CommonJS): que URL carga la ventana y que se
//   puede abrir en el navegador del sistema con shell.openExternal.
// - offline.html (pagina local, con <script src="destinos.js">): a donde vuelve
//   el boton "Reintentar".
// Por eso el archivo funciona como modulo CommonJS y como script de navegador.
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  else raiz.DestinosHabitaSmart = fabrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var URL_OFICIAL = "https://habitasmart.onrender.com";

  // Origenes a los que puede volver el boton "Reintentar". El destino final se
  // toma SIEMPRE de esta lista (una constante), nunca del parametro recibido.
  var ORIGENES_APP = [URL_OFICIAL];
  // Solo en desarrollo (app sin empaquetar): el servidor local.
  var ORIGENES_DESARROLLO = ["http://localhost:4000", "http://127.0.0.1:4000", "http://localhost:5173", "http://127.0.0.1:5173"];

  // Protocolos que se pueden entregar al sistema operativo con shell.openExternal.
  // http: se permite porque un comunicado puede enlazar un sitio externo sin https;
  // mailto: y tel: porque la app muestra correos y telefonos de contacto.
  var PROTOCOLOS_EXTERNOS = ["https:", "http:", "mailto:", "tel:"];

  function parsear(valor) {
    if (typeof valor !== "string" || valor.trim() === "" || valor.length > 2048) return null;
    try {
      return new URL(valor);
    } catch (e) {
      return null;
    }
  }

  function tieneCredenciales(u) {
    return u.username !== "" || u.password !== "";
  }

  function esLocal(u) {
    return u.hostname === "localhost" || u.hostname === "127.0.0.1";
  }

  // URL del sitio que puede cargar la ventana (HABITASMART_URL): https sin
  // credenciales, o http://localhost / 127.0.0.1 solo en desarrollo.
  function esUrlDeSitioPermitida(valor, opciones) {
    var desarrollo = Boolean(opciones && opciones.desarrollo);
    var u = parsear(valor);
    if (!u || tieneCredenciales(u)) return false;
    if (u.protocol === "https:") return true;
    return u.protocol === "http:" && desarrollo && esLocal(u);
  }

  // Destino del boton "Reintentar" de offline.html. Devuelve un origen de la
  // lista conocida (con "/" al final) o null si el valor no es aceptable.
  function destinoDeReintento(valor, opciones) {
    var desarrollo = Boolean(opciones && opciones.desarrollo);
    var u = parsear(valor);
    if (!u || tieneCredenciales(u)) return null;
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    var lista = desarrollo ? ORIGENES_APP.concat(ORIGENES_DESARROLLO) : ORIGENES_APP;
    for (var i = 0; i < lista.length; i++) {
      if (lista[i] === u.origin) return lista[i] + "/";
    }
    return null;
  }

  // ¿Se puede abrir este enlace en el navegador / cliente de correo / telefono del sistema?
  function esUrlExternaPermitida(valor) {
    var u = parsear(valor);
    if (!u || PROTOCOLOS_EXTERNOS.indexOf(u.protocol) === -1) return false;
    if ((u.protocol === "https:" || u.protocol === "http:") && tieneCredenciales(u)) return false;
    return true;
  }

  return {
    URL_OFICIAL: URL_OFICIAL,
    ORIGENES_APP: ORIGENES_APP.slice(),
    ORIGENES_DESARROLLO: ORIGENES_DESARROLLO.slice(),
    PROTOCOLOS_EXTERNOS: PROTOCOLOS_EXTERNOS.slice(),
    esUrlDeSitioPermitida: esUrlDeSitioPermitida,
    destinoDeReintento: destinoDeReintento,
    esUrlExternaPermitida: esUrlExternaPermitida,
  };
});
