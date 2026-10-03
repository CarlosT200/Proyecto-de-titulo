-- Corrige los textos que el propio sistema generó antes de que se arreglaran las tildes y
-- los nombres de estado (por ejemplo "cambio de estado a EN_REVISION"). Solo se tocan
-- frases exactas que genera el código; lo que escribieron las personas no se modifica.

-- Motivos de las validaciones de QR
UPDATE "accesos_log"
SET "motivo" = replace(replace(replace(replace(replace(
      "motivo",
      'Codigo', 'Código'),
      'codigo', 'código'),
      'invalido', 'inválido'),
      'La autorizacion', 'La autorización'),
      'esta fuera del periodo', 'está fuera del período')
WHERE "motivo" IS NOT NULL;

-- Notificaciones: títulos
UPDATE "notificaciones"
SET "titulo" = replace("titulo", 'Actualizacion de', 'Actualización de')
WHERE "titulo" LIKE 'Actualizacion de%';

-- Notificaciones: mensajes (estado con nombre legible y tildes)
UPDATE "notificaciones"
SET "mensaje" = replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
      "mensaje",
      'cambio de estado a EN_REVISION', 'cambió de estado a "En revisión"'),
      'cambio de estado a EN_PROCESO', 'cambió de estado a "En proceso"'),
      'cambio de estado a RESUELTA', 'cambió de estado a "Resuelta"'),
      'cambio de estado a REPORTADA', 'cambió de estado a "Reportada"'),
      'cambio de estado a PENDIENTE', 'cambió de estado a Pendiente'),
      'cambio de estado a PAGADA', 'cambió de estado a Pagada'),
      'cambio de estado a APELADA', 'cambió de estado a Apelada'),
      'cambio de estado a ANULADA', 'cambió de estado a Anulada'),
      'Se registro una multa', 'Se registró una multa'),
      'Llego una encomienda', 'Llegó una encomienda'),
      'conserjeria', 'conserjería')
WHERE "mensaje" LIKE '%cambio de estado a%'
   OR "mensaje" LIKE 'Se registro una multa%'
   OR "mensaje" LIKE 'Llego una encomienda%';
