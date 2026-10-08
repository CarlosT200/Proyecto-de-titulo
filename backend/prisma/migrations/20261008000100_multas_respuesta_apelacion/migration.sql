-- Respuesta de la administración a una apelación de multa.
ALTER TABLE "multas" ADD COLUMN "apelacionAceptada" BOOLEAN,
ADD COLUMN "respuesta" TEXT,
ADD COLUMN "respondidaEn" TIMESTAMP(3);
