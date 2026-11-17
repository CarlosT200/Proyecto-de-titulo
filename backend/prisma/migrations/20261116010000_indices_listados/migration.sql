-- Fase 2 (2G): indices para los filtros reales de los listados ("mis reservas", "mis multas",
-- "mis incidencias", "mis encomiendas", "mis visitas", QR vigente del residente, documentos).
-- Solo CREA indices: no cambia ni borra datos y no agrega restricciones (no hay datos incompatibles
-- posibles). Compatible con la version anterior de la aplicacion durante el despliegue.
-- En tablas chicas (un condominio) se crean en milisegundos; con tablas grandes conviene ejecutar
-- en horario de bajo uso (CREATE INDEX bloquea escrituras en esa tabla mientras dura).
-- Rollback: DROP INDEX de cada indice listado abajo (no afecta datos).

-- CreateIndex
CREATE INDEX "documentos_condominioId_createdAt_idx" ON "documentos"("condominioId", "createdAt");

-- CreateIndex
CREATE INDEX "encomiendas_usuarioId_fechaRecepcion_idx" ON "encomiendas"("usuarioId", "fechaRecepcion");

-- CreateIndex
CREATE INDEX "incidencias_usuarioId_createdAt_idx" ON "incidencias"("usuarioId", "createdAt");

-- CreateIndex
CREATE INDEX "multas_usuarioId_fecha_idx" ON "multas"("usuarioId", "fecha");

-- CreateIndex
CREATE INDEX "qr_tokens_usuarioId_tipo_revocado_idx" ON "qr_tokens"("usuarioId", "tipo", "revocado");

-- CreateIndex
CREATE INDEX "reservas_usuarioId_fecha_idx" ON "reservas"("usuarioId", "fecha");

-- CreateIndex
CREATE INDEX "visitas_residenteId_createdAt_idx" ON "visitas"("residenteId", "createdAt");

