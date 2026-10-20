-- Codigo corto y legible para la validacion manual del QR.
ALTER TABLE "qr_tokens" ADD COLUMN "codigo_manual" TEXT;

CREATE UNIQUE INDEX "qr_tokens_codigo_manual_key" ON "qr_tokens"("codigo_manual");
