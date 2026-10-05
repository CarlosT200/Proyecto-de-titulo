-- Nuevo estado de encomienda: devuelta al remitente. Solo agrega un valor; no cambia filas existentes.
ALTER TYPE "EstadoEncomienda" ADD VALUE 'DEVUELTA';
