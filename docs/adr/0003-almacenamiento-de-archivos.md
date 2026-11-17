# ADR 0003 — Archivos en la base de datos (por ahora) y plan hacia almacenamiento de objetos

- **Estado:** aceptada para la defensa y el piloto inicial; revisar antes de crecer

## Contexto

Fotos (perfil, incidencias, encomiendas), documentos y comprobantes se guardan como `data:` base64
dentro de PostgreSQL. Render (plan gratis) no tiene disco persistente, y así un solo respaldo incluye
todo. La desventaja: la base crece ~1,33× el tamaño de cada archivo y las consultas que traen la
columna pesan.

## Decisión (Fase 2)

Mantener el almacenamiento actual y **reforzarlo**:

- Firma del contenido (magic bytes) y lista blanca: JPG, PNG, WEBP, PDF; 8 MB máximo; SVG/HTML
  rechazados. Las fotos se re-codifican a JPEG con `sharp` (elimina contenido extraño y metadatos).
- Descarga solo con sesión y autorización (`GET /:id/archivo`), con `nosniff`, `no-store` y
  `Content-Disposition` saneado. Se eliminaron los enlaces con token en la URL.
- `/uploads` ya no es una carpeta pública; los archivos antiguos en disco se leen con sesión y sin
  path traversal.
- Los listados no traen la columna del archivo (solo una marca «tiene foto»).

## Plan de migración (paso previo a un piloto con varios condominios) — 👤 requiere autorización

1. Crear un bucket **privado** (Supabase Storage o S3 compatible); no requiere costo en el plan gratis
   inicial, pero **no se crea sin autorización**.
2. Columna nueva `archivoClave` (nullable) en cada tabla con archivos; migración aditiva.
3. Al subir: guardar en el bucket con clave interna aleatoria (`<condominio>/<uuid>.<ext>`).
4. Al descargar: el backend verifica la autorización y responde con una **URL firmada de 60 s**
   (o hace de proxy). Nunca URLs públicas.
5. Script de migración por lotes de los base64 existentes, idempotente, con conteos antes/después.
6. Cuando todo esté migrado y verificado, segunda migración que vacía las columnas base64.

**Impacto estimado:** base ~90 % más chica; respaldos más rápidos; un proveedor más que custodiar.
**Rollback:** mientras exista la columna base64, basta volver a leerla (paso 6 solo al final).

## Consecuencias

Aceptable para un condominio (decenas a cientos de MB). Se vigila el tamaño de la base en Supabase.
