-- CreateEnum
CREATE TYPE "EstadoComprobante" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');

-- CreateTable
CREATE TABLE "comprobantes_pago" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "cobroId" TEXT NOT NULL,
    "informadoPorId" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "fechaPago" DATE NOT NULL,
    "medio" "MedioPago" NOT NULL,
    "referencia" TEXT,
    "archivo" TEXT NOT NULL,
    "estado" "EstadoComprobante" NOT NULL DEFAULT 'PENDIENTE',
    "motivoRechazo" TEXT,
    "revisadoPorId" TEXT,
    "revisadoEn" TIMESTAMP(3),
    "pagoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comprobantes_pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recordatorios_enviados" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recordatorios_enviados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "comprobantes_pago_pagoId_key" ON "comprobantes_pago"("pagoId");

-- CreateIndex
CREATE INDEX "comprobantes_pago_condominioId_estado_idx" ON "comprobantes_pago"("condominioId", "estado");

-- CreateIndex
CREATE INDEX "comprobantes_pago_cobroId_idx" ON "comprobantes_pago"("cobroId");

-- CreateIndex
CREATE UNIQUE INDEX "recordatorios_enviados_clave_key" ON "recordatorios_enviados"("clave");

-- AddForeignKey
ALTER TABLE "comprobantes_pago" ADD CONSTRAINT "comprobantes_pago_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "condominios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobantes_pago" ADD CONSTRAINT "comprobantes_pago_cobroId_fkey" FOREIGN KEY ("cobroId") REFERENCES "cobros_gasto_comun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobantes_pago" ADD CONSTRAINT "comprobantes_pago_informadoPorId_fkey" FOREIGN KEY ("informadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobantes_pago" ADD CONSTRAINT "comprobantes_pago_revisadoPorId_fkey" FOREIGN KEY ("revisadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobantes_pago" ADD CONSTRAINT "comprobantes_pago_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "pagos_gasto_comun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

