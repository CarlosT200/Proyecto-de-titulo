import { FormEvent, useState } from "react";
import { CheckCircle } from "@phosphor-icons/react";
import { sosApi } from "../api/endpoints";
import { mensajeError } from "../api/client";
import { useToast } from "../context/ToastContext";
import { Alert, Button, Label, Modal, Textarea } from "./ui";
import { haceCuanto } from "../lib/tiempo";
import { TIPO_EMERGENCIA_LABEL } from "../lib/badges";
import type { AlertaSos } from "../types";

export function unidadDeAlerta(a: AlertaSos): string | null {
  if (!a.usuario.departamento) return null;
  return [a.usuario.departamento.torre?.nombre, a.usuario.departamento.numero].filter(Boolean).join(" ");
}

// Modal para registrar que una alerta fue atendida (con una nota opcional de lo que se hizo).
export function ModalAtenderAlerta({ alerta, onClose, onAtendida }: { alerta: AlertaSos; onClose: () => void; onAtendida: () => void }) {
  const toast = useToast();
  const [observacion, setObservacion] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unidad = unidadDeAlerta(alerta);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await sosApi.atender(alerta.id, observacion.trim() || undefined);
      toast.success("Alerta marcada como atendida. El residente recibió un aviso.");
      onAtendida();
      onClose();
    } catch (err) {
      // Por ejemplo, si otra persona la atendió justo antes.
      setError(mensajeError(err));
      onAtendida();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Marcar alerta como atendida">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Alerta de <strong>{TIPO_EMERGENCIA_LABEL[alerta.tipo]}</strong> de {alerta.usuario.nombre} {alerta.usuario.apellido}
          {unidad ? ` (${unidad})` : ""}, {haceCuanto(alerta.createdAt)}.
        </p>
        <div>
          <Label htmlFor="campo-sos-observacion">¿Qué se hizo? (opcional)</Label>
          <Textarea
            id="campo-sos-observacion"
            rows={3}
            maxLength={500}
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            placeholder="Ej: Se abrió el portón y se acompañó a la unidad hasta el departamento."
          />
        </div>
        {error && <Alert tone="amber">{error}</Alert>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={enviando}>
            <CheckCircle size={16} weight="bold" aria-hidden /> Marcar como atendida
          </Button>
        </div>
      </form>
    </Modal>
  );
}
