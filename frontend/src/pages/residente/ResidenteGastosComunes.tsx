import { useSearchParams } from "react-router-dom";
import clsx from "clsx";
import { CalendarBlank, CheckCircle, Copy, Wallet, WarningCircle } from "@phosphor-icons/react";
import { gastosComunesApi } from "../../api/endpoints";
import { useAsync } from "../../hooks/useAsync";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, PageHeader, Spinner } from "../../components/ui";
import { Cifra } from "../../components/Cifra";
import { EstadoCobroBadge, ModalCobro } from "../../components/GastosComunes";
import { useToast } from "../../context/ToastContext";
import { formatMonto } from "../../lib/format";
import { fechaLarga, nombreUnidad, tituloPeriodo } from "../../lib/gastosComunes";

export default function ResidenteGastosComunes() {
  const toast = useToast();
  const { data, cargando, error, recargar } = useAsync(() => gastosComunesApi.miCuenta(), []);

  async function copiarInstrucciones(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Datos de pago copiados.");
    } catch {
      toast.error("No se pudo copiar; selecciona el texto a mano.");
    }
  }
  const [params, setParams] = useSearchParams();
  const abierto = params.get("ver");

  function abrir(id: string | null) {
    setParams(
      (actuales) => {
        const siguientes = new URLSearchParams(actuales);
        if (id) siguientes.set("ver", id);
        else siguientes.delete("ver");
        return siguientes;
      },
      { replace: true }
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Wallet}
        title="Gastos comunes"
        subtitle={
          data?.unidad
            ? `Lo que corresponde a tu unidad (${nombreUnidad(data.unidad)}), en qué se gastó y tus pagos.`
            : "Lo que corresponde a tu unidad, en qué se gastó y tus pagos."
        }
      />

      {cargando && !data ? (
        <Spinner />
      ) : error || !data ? (
        <Alert tone="red">{error ?? "No se pudo cargar tu estado de cuenta."}</Alert>
      ) : !data.unidad ? (
        <Card plana>
          <div className="p-5">
            <EmptyState
              icon={Wallet}
              title="Tu cuenta no tiene una unidad asignada"
              description="Pídele a la administración que te asocie a tu departamento para ver tus gastos comunes."
            />
          </div>
        </Card>
      ) : (
        <>
          {/* Lo primero: cuanto debo y para cuando. */}
          <Card plana className="overflow-hidden">
            {data.saldoPendiente === 0 ? (
              <div className="flex items-center gap-4 px-5 py-5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                  <CheckCircle size={28} weight="fill" aria-hidden />
                </span>
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">Estás al día</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-300">No tienes saldo pendiente en tu unidad.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-3 dark:bg-slate-700/60">
                <Cifra icono={Wallet} etiqueta="Saldo por pagar" valor={formatMonto(data.saldoPendiente)} detalle="total pendiente de tu unidad" />
                <Cifra
                  icono={WarningCircle}
                  etiqueta="Vencido"
                  valor={data.deudaVencida > 0 ? formatMonto(data.deudaVencida) : 0}
                  detalle={data.deudaVencida > 0 ? (data.cobrosVencidos === 1 ? "de 1 mes" : `de ${data.cobrosVencidos} meses`) : "nada vencido"}
                  alerta
                />
                <div className="col-span-2 sm:col-span-1">
                  <Cifra
                    icono={CalendarBlank}
                    etiqueta="Próximo vencimiento"
                    valor={data.proximoVencimiento ? fechaLarga(data.proximoVencimiento).replace(/ de \d{4}$/, "") : "Sin datos"}
                  />
                </div>
              </div>
            )}
          </Card>

          {data.deudaVencida > 0 && (
            <Alert tone="red">
              Tienes {formatMonto(data.deudaVencida)} vencidos
              {data.cobrosVencidos === 1 ? " de 1 mes" : ` de ${data.cobrosVencidos} meses`}. Si ya pagaste, entrega tu comprobante a la
              administración para que lo registre.
            </Alert>
          )}

          {data.saldoPendiente > 0 && data.instruccionesPago && (
            <Card plana>
              <CardHeader
                nivel={2}
                title="Cómo pagar"
                subtitle="Después de pagar, abre el mes y envía tu comprobante."
                action={
                  <Button size="sm" variant="secondary" className="shrink-0 max-sm:min-h-11" onClick={() => copiarInstrucciones(data.instruccionesPago!)}>
                    <Copy size={14} aria-hidden /> Copiar
                  </Button>
                }
              />
              <p className="select-text whitespace-pre-line px-5 py-4 text-sm text-slate-700 dark:text-slate-200">{data.instruccionesPago}</p>
            </Card>
          )}

          <Card plana className="overflow-hidden">
            <CardHeader nivel={2} title="Cobros de tu unidad" subtitle="Abre un mes para ver en qué se gastó y tus pagos." />
            {data.cobros.length === 0 ? (
              <div className="p-5">
                <EmptyState icon={Wallet} title="Aún no hay cobros para tu unidad" description="Cuando la administración emita el cobro del mes, aparecerá aquí." />
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {data.cobros.map((c) => (
                  <li key={c.id}>
                    {/* Toda la fila abre el detalle del mes. */}
                    <button
                      type="button"
                      onClick={() => abrir(c.id)}
                      className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 dark:hover:bg-slate-700/50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-slate-900 dark:text-slate-100">{tituloPeriodo(c.periodo.anio, c.periodo.mes)}</span>
                          <EstadoCobroBadge estado={c.estado} />
                          {c.comprobantePendiente && <Badge tone="amber">Pago en revisión</Badge>}
                        </span>
                        <span className="mt-0.5 block text-sm text-slate-600 dark:text-slate-300">
                          {c.estado === "PAGADO" ? `Total ${formatMonto(c.montoTotal)}` : `Vence el ${fechaLarga(c.periodo.fechaVencimiento)}`}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span
                          className={clsx(
                            "block font-display text-base font-bold tabular-nums",
                            c.saldo === 0 ? "text-emerald-700 dark:text-emerald-300" : c.estado === "VENCIDO" ? "text-red-700 dark:text-red-300" : "text-slate-900 dark:text-white"
                          )}
                        >
                          {formatMonto(c.saldo)}
                        </span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400">{c.saldo === 0 ? "pagado" : "por pagar"}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {abierto && <ModalCobro id={abierto} onClose={() => abrir(null)} onActualizado={recargar} />}
    </div>
  );
}
