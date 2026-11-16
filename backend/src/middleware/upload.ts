import fs from "fs";
import path from "path";
import { randomUUID } from "node:crypto";
import multer from "multer";
import { AppError } from "../lib/errors";

export const UPLOADS_DIR = path.join(__dirname, "..", "..", "uploads");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const TIPOS_PERMITIDOS = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    // Nombre interno aleatorio: nunca se usa el nombre que manda el navegador (path traversal).
    cb(null, `${randomUUID()}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!TIPOS_PERMITIDOS.has(file.mimetype)) {
      cb(new AppError("Tipo de archivo no permitido. Usa JPG, PNG, WEBP o PDF.", 422));
      return;
    }
    cb(null, true);
  },
});

export function archivoUrl(filename: string): string {
  return `/uploads/${filename}`;
}

const TIPOS_IMAGEN = new Set(["image/jpeg", "image/png", "image/webp"]);

// A diferencia de `upload` (disco), esta variante guarda el archivo en
// memoria (req.file.buffer) en vez de escribirlo a UPLOADS_DIR. Se usa para
// la foto de perfil: Render (plan gratis) no tiene disco persistente, asi
// que cualquier archivo en UPLOADS_DIR se pierde en el siguiente deploy o
// reinicio. La foto de perfil en cambio se guarda como base64 directo en la
// fila del usuario (ver auth.controller.ts) -- la base de datos Postgres si
// persiste entre deploys, a diferencia del filesystem del contenedor.
export const uploadImagenMemoria = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!TIPOS_IMAGEN.has(file.mimetype)) {
      cb(new AppError("Tipo de archivo no permitido. Usa JPG, PNG o WEBP.", 422));
      return;
    }
    cb(null, true);
  },
});

// Misma idea que uploadImagenMemoria pero acepta tambien PDF (documentos del
// condominio: actas, reglamentos). Usada por incidencias (foto de evidencia)
// y documentos.
export const uploadArchivoMemoria = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!TIPOS_PERMITIDOS.has(file.mimetype)) {
      cb(new AppError("Tipo de archivo no permitido. Usa JPG, PNG, WEBP o PDF.", 422));
      return;
    }
    cb(null, true);
  },
});
