-- Apelación de multas: el residente explica por qué apela y se guarda cuándo lo hizo.
ALTER TABLE "multas" ADD COLUMN "apelacion" TEXT,
ADD COLUMN "apeladaEn" TIMESTAMP(3);
