// Comparte la imagen de un QR (por WhatsApp, correo...) con el menu de compartir del celular. Si el
// navegador no puede compartir archivos (computador, navegadores antiguos), la descarga como imagen.
export async function compartirQr(qrDataUrl: string, nombre: string, texto: string): Promise<"compartido" | "descargado" | "cancelado"> {
  const archivo = `QR-${nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "visita"}.png`;
  try {
    const blob = await (await fetch(qrDataUrl)).blob();
    const file = new File([blob], archivo, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: "Código QR de acceso", text: texto });
      return "compartido";
    }
  } catch (err) {
    // La persona cerro el menu de compartir: no es un error.
    if (err instanceof DOMException && err.name === "AbortError") return "cancelado";
  }
  const enlace = document.createElement("a");
  enlace.href = qrDataUrl;
  enlace.download = archivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  return "descargado";
}
