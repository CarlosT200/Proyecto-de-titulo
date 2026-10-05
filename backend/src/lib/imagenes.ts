import sharp from "sharp";
import { AppError } from "./errors";

// Reduce una foto subida (incidencias, encomiendas, perfil) y la devuelve como data URI JPEG, que es
// como se guardan en la base (Render no tiene disco persistente). Si el archivo dice ser una imagen
// pero no lo es (o esta dañado), responde un error claro en vez de un error interno.
export async function fotoComoDataUri(
  buffer: Buffer,
  opciones: { lado: number; ajuste: "inside" | "cover" }
): Promise<string> {
  try {
    const reducida = await sharp(buffer)
      .rotate() // respeta la orientacion de la camara del celular
      .resize(opciones.lado, opciones.lado, { fit: opciones.ajuste, withoutEnlargement: opciones.ajuste === "inside" })
      .jpeg({ quality: 82 })
      .toBuffer();
    return `data:image/jpeg;base64,${reducida.toString("base64")}`;
  } catch {
    throw new AppError("La foto no se pudo leer. Prueba con otra imagen (JPG, PNG o WEBP).", 422);
  }
}
