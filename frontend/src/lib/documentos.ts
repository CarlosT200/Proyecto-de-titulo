import { documentosApi } from "../api/endpoints";

// Abre un documento en una pestaña nueva.
//
// La pestaña se abre ANTES de pedir el enlace, dentro del mismo toque: los navegadores (Safari del
// iPhone sobre todo) bloquean las ventanas que se abren despues de esperar una respuesta. Cuando
// llega el enlace de 2 minutos, se carga en esa pestaña. Si el navegador no dejo abrirla, se usa la
// misma pestaña.
export async function abrirDocumento(documentoId: string): Promise<void> {
  const ventana = window.open("", "_blank");
  try {
    const { url } = await documentosApi.crearEnlace(documentoId);
    if (ventana) {
      ventana.location.href = url;
    } else {
      window.location.href = url;
    }
  } catch (error) {
    ventana?.close();
    throw error;
  }
}
