-- Encomiendas: datos de recepcion, quien la retiro o devolvio. Solo columnas nuevas y opcionales.
ALTER TABLE "encomiendas" ADD COLUMN "numeroSeguimiento" TEXT,
ADD COLUMN "ubicacion" TEXT,
ADD COLUMN "fotoUrl" TEXT,
ADD COLUMN "observaciones" TEXT,
ADD COLUMN "retiradaPor" TEXT,
ADD COLUMN "fechaDevolucion" TIMESTAMP(3),
ADD COLUMN "motivoDevolucion" TEXT,
ADD COLUMN "cerradaPorId" TEXT;

ALTER TABLE "encomiendas" ADD CONSTRAINT "encomiendas_cerradaPorId_fkey" FOREIGN KEY ("cerradaPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "encomiendas_condominioId_estado_fechaRecepcion_idx" ON "encomiendas"("condominioId", "estado", "fechaRecepcion");

-- Alertas SOS: ahora tienen estado (activa / atendida) y quien la atendio.
CREATE TYPE "EstadoAlertaSos" AS ENUM ('ACTIVA', 'ATENDIDA');

ALTER TABLE "alertas_sos" ADD COLUMN "estado" "EstadoAlertaSos" NOT NULL DEFAULT 'ACTIVA',
ADD COLUMN "atendidaPorId" TEXT,
ADD COLUMN "atendidaEn" TIMESTAMP(3),
ADD COLUMN "observacion" TEXT;

ALTER TABLE "alertas_sos" ADD CONSTRAINT "alertas_sos_atendidaPorId_fkey" FOREIGN KEY ("atendidaPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "alertas_sos_condominioId_estado_idx" ON "alertas_sos"("condominioId", "estado");

-- Las alertas que ya existian se crearon antes de que se pudieran marcar como atendidas: quedan
-- como atendidas (si no, aparecerian todas como emergencias en curso).
UPDATE "alertas_sos"
SET "estado" = 'ATENDIDA',
    "atendidaEn" = "createdAt",
    "observacion" = 'Registrada antes de que existiera el seguimiento de alertas.';
