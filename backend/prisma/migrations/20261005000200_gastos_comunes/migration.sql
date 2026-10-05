-- Gastos comunes: cobro mensual por unidad, detalle de gastos, pagos y alícuotas de prorrateo.

-- CreateEnum
CREATE TYPE "MetodoProrrateo" AS ENUM ('PARTES_IGUALES', 'ALICUOTA');

-- CreateEnum
CREATE TYPE "MedioPago" AS ENUM ('TRANSFERENCIA', 'EFECTIVO', 'TARJETA', 'CHEQUE', 'OTRO');

-- AlterTable
ALTER TABLE "departamentos" ADD COLUMN     "alicuota" DECIMAL(7,4);

-- CreateTable
CREATE TABLE "periodos_gasto_comun" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "fechaVencimiento" DATE NOT NULL,
    "metodoProrrateo" "MetodoProrrateo" NOT NULL,
    "porcentajeFondoReserva" INTEGER NOT NULL,
    "totalGastos" INTEGER NOT NULL,
    "instruccionesPago" TEXT,
    "creadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "periodos_gasto_comun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partidas_gasto_comun" (
    "id" TEXT NOT NULL,
    "periodoId" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL,

    CONSTRAINT "partidas_gasto_comun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cobros_gasto_comun" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "periodoId" TEXT NOT NULL,
    "departamentoId" TEXT NOT NULL,
    "montoGastoComun" INTEGER NOT NULL,
    "montoFondoReserva" INTEGER NOT NULL,
    "montoTotal" INTEGER NOT NULL,
    "montoPagado" INTEGER NOT NULL DEFAULT 0,
    "pagado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cobros_gasto_comun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos_gasto_comun" (
    "id" TEXT NOT NULL,
    "cobroId" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "fechaPago" DATE NOT NULL,
    "medio" "MedioPago" NOT NULL,
    "referencia" TEXT,
    "registradoPorId" TEXT NOT NULL,
    "anuladoEn" TIMESTAMP(3),
    "motivoAnulacion" TEXT,
    "anuladoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_gasto_comun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "periodos_gasto_comun_condominioId_anio_mes_key" ON "periodos_gasto_comun"("condominioId", "anio", "mes");

-- CreateIndex
CREATE INDEX "partidas_gasto_comun_periodoId_idx" ON "partidas_gasto_comun"("periodoId");

-- CreateIndex
CREATE INDEX "cobros_gasto_comun_condominioId_pagado_idx" ON "cobros_gasto_comun"("condominioId", "pagado");

-- CreateIndex
CREATE INDEX "cobros_gasto_comun_departamentoId_idx" ON "cobros_gasto_comun"("departamentoId");

-- CreateIndex
CREATE UNIQUE INDEX "cobros_gasto_comun_periodoId_departamentoId_key" ON "cobros_gasto_comun"("periodoId", "departamentoId");

-- CreateIndex
CREATE INDEX "pagos_gasto_comun_cobroId_idx" ON "pagos_gasto_comun"("cobroId");

-- AddForeignKey
ALTER TABLE "periodos_gasto_comun" ADD CONSTRAINT "periodos_gasto_comun_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "condominios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodos_gasto_comun" ADD CONSTRAINT "periodos_gasto_comun_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partidas_gasto_comun" ADD CONSTRAINT "partidas_gasto_comun_periodoId_fkey" FOREIGN KEY ("periodoId") REFERENCES "periodos_gasto_comun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobros_gasto_comun" ADD CONSTRAINT "cobros_gasto_comun_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "condominios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobros_gasto_comun" ADD CONSTRAINT "cobros_gasto_comun_periodoId_fkey" FOREIGN KEY ("periodoId") REFERENCES "periodos_gasto_comun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobros_gasto_comun" ADD CONSTRAINT "cobros_gasto_comun_departamentoId_fkey" FOREIGN KEY ("departamentoId") REFERENCES "departamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_gasto_comun" ADD CONSTRAINT "pagos_gasto_comun_cobroId_fkey" FOREIGN KEY ("cobroId") REFERENCES "cobros_gasto_comun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_gasto_comun" ADD CONSTRAINT "pagos_gasto_comun_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_gasto_comun" ADD CONSTRAINT "pagos_gasto_comun_anuladoPorId_fkey" FOREIGN KEY ("anuladoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Red de seguridad: nunca se puede pagar de más ni quedar con pagos negativos.
ALTER TABLE "cobros_gasto_comun" ADD CONSTRAINT "cobros_gasto_comun_montos_check" CHECK ("montoPagado" >= 0 AND "montoPagado" <= "montoTotal");
ALTER TABLE "periodos_gasto_comun" ADD CONSTRAINT "periodos_gasto_comun_mes_check" CHECK ("mes" BETWEEN 1 AND 12);
