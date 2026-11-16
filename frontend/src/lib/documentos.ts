// Abre un archivo protegido (documento del condominio o comprobante de pago) en una pestaña nueva.
//
// La sesion viaja en la cookie HttpOnly, que el navegador envia sola en la navegacion: la URL no
// lleva ningun token (antes era un enlace firmado de 2 minutos que quedaba en el historial). Si el
// navegador bloquea la pestaña nueva, se abre en la actual.
// Sin "noopener" a proposito: con esa opcion window.open devuelve siempre null y no se podria
// detectar el bloqueo. El destino es del mismo origen (la propia API), asi que no hay riesgo.
function abrirArchivo(url: string): void {
  const ventana = window.open(url, "_blank");
  if (!ventana) window.location.href = url;
}

export function urlDocumento(documentoId: string): string {
  return `/api/documentos/${encodeURIComponent(documentoId)}/archivo`;
}

export function urlComprobante(comprobanteId: string): string {
  return `/api/gastos-comunes/comprobantes/${encodeURIComponent(comprobanteId)}/archivo`;
}

export async function abrirDocumento(documentoId: string): Promise<void> {
  abrirArchivo(urlDocumento(documentoId));
}

export async function abrirComprobante(comprobanteId: string): Promise<void> {
  abrirArchivo(urlComprobante(comprobanteId));
}
