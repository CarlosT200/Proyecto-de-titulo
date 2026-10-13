// Comparte la imagen de un QR (por WhatsApp, correo...) con el menu nativo de compartir. Si el
// navegador no puede compartir archivos, la descarga (computador) o la abre para guardarla (iOS).
export type ResultadoCompartir = "compartido" | "descargado" | "abierto" | "cancelado";

// Convierte un data URL en Blob de forma SINCRONA. Es clave: en iOS Safari, navigator.share() debe
// invocarse dentro del mismo gesto del usuario; si antes se hace un await (p. ej. fetch), se pierde
// la "activacion" y la comparticion falla. Por eso no usamos fetch aqui.
function dataUrlABlob(dataUrl: string): Blob {
  const [cabecera, datos] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(cabecera)?.[1] ?? "image/png";
  const binario = atob(datos);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function esIOS(): boolean {
  return /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export async function compartirQr(qrDataUrl: string, nombre: string, texto: string): Promise<ResultadoCompartir> {
  const archivo = `QR-${nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "visita"}.png`;
  let file: File | null = null;
  try {
    file = new File([dataUrlABlob(qrDataUrl)], archivo, { type: "image/png" });
  } catch {
    file = null;
  }

  // 1) Compartir el archivo con el menu nativo (iOS y Android). La llamada a share() es el primer
  //    await, de modo que conserva el gesto del usuario.
  if (file && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({ files: [file], title: "Código QR de acceso", text: texto });
      return "compartido";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelado";
      // Cualquier otro error: continua al respaldo de descarga/apertura.
    }
  }

  // 2) Respaldo. Usamos un blob URL (mas confiable que el data URL para descargar).
  const url = URL.createObjectURL(file ?? dataUrlABlob(qrDataUrl));
  const limpiar = () => setTimeout(() => URL.revokeObjectURL(url), 15000);

  // iOS Safari ignora el atributo download: abrimos la imagen para que el usuario la guarde o
  // comparta con un toque largo.
  if (esIOS()) {
    window.open(url, "_blank");
    limpiar();
    return "abierto";
  }

  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = archivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  limpiar();
  return "descargado";
}
