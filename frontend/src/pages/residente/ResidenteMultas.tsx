import { FormEvent, useState } from "react";
import clsx from "clsx";
import { CheckCircle, Warning } from "@phosphor-icons/react";
import { multasApi } from "../../api/endpoints";
import { mensajeError } from "../../api/client";
import { useAsync } from "../../hooks/useAsync";
import { useToast } from "../../context/ToastContext";
import { Alert, Button, Card, EmptyState, Label, Modal, PageHeader, Spinner, Textarea } from "../../components/ui";
import { BadgeEstadoMulta } from "../../components/Multas";
import { RespuestaApelacion } from "../../components/RespuestaApelacion";
import { formatFecha, formatMonto, formatDia } from "../../lib/format";
import type { Multa } from "../../types";

const MIN_APELACION = 10;
const MAX_APELACION = 500;

// El residente explica por que apela. La multa pasa a "Apelada" y la administracion la revisa y le
// avisa su decision (la misma notificacion de cambio de estado de siempre).
function ModalApelar({ multa, onClose, onApelada }: { multa: Multa; onClose: () => void; onApelada: () => void }) {
  const toast = useToast();
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const largo = motivo.trim().length;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await multasApi.apelar(multa.id, motivo.trim());
      toast.success("Apelación enviada. La administración la revisará y te avisará su decisión.");
      onApelada();
      onClose();
    } catch (err) {
      setError(mensajeError(err));
      // si alguien ya la resolvio, se actualiza la lista para mostrar el estado real
      onApelada();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Apelar multa">
      <form onSubmit={enviar} className="space-y-4">
        <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-900/40">
          <p className="break-words font-medium text-slate-900 dark:text-slate-100">{multa.motivo}</p>
          <p className="mt-0.5 text-slate-600 dark:text-slate-300">
            {formatMonto(multa.monto)} · {formatFecha(multa.fecha)}
          </p>
        </div>
        <div>
          <Label htmlFor="campo-apelacion">¿Por qué apelas esta multa?</Label>
          <Textarea
            id="campo-apelacion"
            rows={5}
            required
            minLength={MIN_APELACION}
            maxLength={MAX_APELACION}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Cuéntale a la administración qué pasó y por qué no corresponde la multa."
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {largo < MIN_APELACION ? `Escribe al menos ${MIN_APELACION} letras.` : `${largo} de ${MAX_APELACION} caracteres.`}
          </p>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Al enviarla, la multa queda en estado <strong>Apelada</strong> hasta que la administración decida. No podrás apelarla de nuevo.
        </p>
        {error && <Alert tone="red">{error}</Alert>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={enviando}>
            Cancelar
          </Button>
          <Button type="submit" loading={enviando} disabled={largo < MIN_APELACION}>
            Enviar apelación
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function ResidenteMultas() {
  const { data, cargando, error, recargar } = useAsync(() => multasApi.mias(), []);
  const [apelando, setApelando] = useState<Multa | null>(null);

  const pendientes = (data ?? []).filter((m) => m.estado === "PENDIENTE");
  const apeladas = (data ?? []).filter((m) => m.estado === "APELADA");
  const porPagar = pendientes.reduce((s, m) => s + m.monto, 0);

  return (
    <div className="space-y-6">
      <PageHeader icon={Warning} title="Mis multas" subtitle="Motivo, monto y estado de tus sanciones." />

      {data && data.length > 0 && (
        <Card plana>
          <div className="flex items-center gap-4 px-5 py-4">
            {porPagar > 0 ? (
              <div className="min-w-0">
                <p className="text-sm text-slate-600 dark:text-slate-300">Por pagar</p>
                <p className="font-display text-2xl font-bold tabular-nums tracking-tight text-amber-700 dark:text-amber-300">{formatMonto(porPagar)}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {pendientes.length} {pendientes.length === 1 ? "multa pendiente" : "multas pendientes"}
                  {apeladas.length > 0 ? ` · ${apeladas.length} en apelación` : ""}
                </p>
              </div>
            ) : (
              <>
                <CheckCircle size={32} weight="fill" className="shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 dark:text-white">No tienes multas por pagar</p>
                  {apeladas.length > 0 && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {apeladas.length} {apeladas.length === 1 ? "multa en apelación" : "multas en apelación"}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </Card>
      )}

      <Card plana>
        {cargando && !data ? (
          <Spinner />
        ) : error ? (
          <Alert tone="red">{error}</Alert>
        ) : !data?.length ? (
          <EmptyState icon={Warning} title="No tienes multas registradas" />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {data.map((m) => (
              <li key={m.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 break-words text-sm font-medium text-slate-900 dark:text-slate-100">{m.motivo}</p>
                  <BadgeEstadoMulta estado={m.estado} />
                </div>
                <p className="mt-1 flex items-baseline gap-2">
                  <span
                    className={clsx(
                      "text-base font-semibold tabular-nums",
                      m.estado === "ANULADA" ? "text-slate-500 line-through dark:text-slate-400" : "text-slate-900 dark:text-white"
                    )}
                  >
                    {formatMonto(m.monto)}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{formatFecha(m.fecha)}</span>
                </p>
                {m.observaciones && <p className="mt-1 break-words text-xs text-slate-500 dark:text-slate-400">{m.observaciones}</p>}
                {m.apelacion && (
                  <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
                    <p className="font-semibold">Tu apelación{m.apeladaEn ? ` (${formatDia(m.apeladaEn)})` : ""}</p>
                    <p className="mt-0.5 break-words">{m.apelacion}</p>
                    {m.estado === "APELADA" && <p className="mt-1 text-slate-500 dark:text-slate-400">En revisión por la administración. Te avisaremos su decisión.</p>}
                    <RespuestaApelacion multa={m} className="mt-2 border-t border-slate-200 pt-2 dark:border-slate-700" />
                    {m.estado === "PENDIENTE" && m.respuesta && (
                      <p className="mt-1 text-slate-500 dark:text-slate-400">Una multa se puede apelar una sola vez, así que esta ya no admite otra apelación.</p>
                    )}
                  </div>
                )}
                {m.estado === "PENDIENTE" && !m.apelacion && (
                  <Button size="sm" variant="secondary" className="mt-3" onClick={() => setApelando(m)}>
                    Apelar esta multa
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      {apelando && <ModalApelar multa={apelando} onClose={() => setApelando(null)} onApelada={recargar} />}
    </div>
  );
}
