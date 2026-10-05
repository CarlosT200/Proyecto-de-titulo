import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CalendarBlank, CheckCircle, Wallet, WarningCircle } from "@phosphor-icons/react";
import { gastosComunesApi } from "../../api/endpoints";
import { useAsync } from "../../hooks/useAsync";
import { Alert, Button, Card, CardHeader, EmptyState, PageHeader, Spinner, StatCard, staggerFade } from "../../components/ui";
import { EstadoCobroBadge, ModalCobro } from "../../components/GastosComunes";
import { formatMonto } from "../../lib/format";
import { fechaLarga, nombreUnidad, tituloPeriodo } from "../../lib/gastosComunes";

export default function ResidenteGastosComunes() {
  const { data, cargando, error, recargar } = useAsync(() => gastosComunesApi.miCuenta(), []);
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
        <Card>
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
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
            <StatCard
              icon={data.saldoPendiente > 0 ? Wallet : CheckCircle}
              label={data.saldoPendiente > 0 ? "Saldo por pagar" : "Estás al día"}
              value={0}
              valorTexto={formatMonto(data.saldoPendiente)}
              tone={data.saldoPendiente > 0 ? "brand" : "green"}
              index={0}
            />
            <StatCard
              icon={WarningCircle}
              label={data.deudaVencida > 0 ? "Vencido" : "Sin deuda vencida"}
              value={0}
              valorTexto={formatMonto(data.deudaVencida)}
              tone={data.deudaVencida > 0 ? "red" : "green"}
              index={1}
            />
            <div className="col-span-2 md:col-span-1">
              <StatCard
                icon={CalendarBlank}
                label="Próximo vencimiento"
                value={0}
                valorTexto={data.proximoVencimiento ? fechaLarga(data.proximoVencimiento).replace(/ de \d{4}$/, "") : "Nada pendiente"}
                tone="slate"
                index={2}
              />
            </div>
          </div>

          {data.deudaVencida > 0 && (
            <Alert tone="red">
              Tienes {formatMonto(data.deudaVencida)} vencidos
              {data.cobrosVencidos === 1 ? " de 1 mes" : ` de ${data.cobrosVencidos} meses`}. Si ya pagaste, entrega tu comprobante a la
              administración para que lo registre.
            </Alert>
          )}

          {data.saldoPendiente > 0 && data.instruccionesPago && (
            <Card>
              <CardHeader title="Cómo pagar" subtitle="Indicaciones de la administración" />
              <p className="whitespace-pre-line px-5 pb-5 text-sm text-slate-600 dark:text-slate-300">{data.instruccionesPago}</p>
            </Card>
          )}

          <Card>
            <CardHeader title="Cobros de tu unidad" subtitle="Toca un mes para ver en qué se gastó y tus pagos." />
            {data.cobros.length === 0 ? (
              <div className="p-5">
                <EmptyState icon={Wallet} title="Aún no hay cobros para tu unidad" description="Cuando la administración emita el cobro del mes, aparecerá aquí." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="tabla-movil w-full text-left text-sm">
                  <thead className="border-b border-slate-100 text-xs uppercase text-slate-400 dark:border-slate-700/60 dark:text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Mes</th>
                      <th className="px-5 py-3 text-right">Total</th>
                      <th className="px-5 py-3 text-right">Saldo</th>
                      <th className="px-5 py-3">Estado</th>
                      <th className="px-5 py-3">
                        <span className="sr-only">Acciones</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                    {data.cobros.map((c, i) => (
                      <motion.tr key={c.id} {...staggerFade(i)} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-700/60">
                        <td data-label="Mes" className="px-5 py-3">
                          <div>
                            <span className="font-medium text-slate-800 dark:text-slate-100">{tituloPeriodo(c.periodo.anio, c.periodo.mes)}</span>
                            <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
                              {c.estado === "PAGADO" ? "Pagado" : `Vence el ${fechaLarga(c.periodo.fechaVencimiento)}`}
                            </span>
                          </div>
                        </td>
                        <td data-label="Total" className="whitespace-nowrap px-5 py-3 text-right text-slate-700 dark:text-slate-200">
                          {formatMonto(c.montoTotal)}
                        </td>
                        <td data-label="Saldo" className="whitespace-nowrap px-5 py-3 text-right font-medium text-slate-800 dark:text-slate-100">
                          {formatMonto(c.saldo)}
                        </td>
                        <td data-label="Estado" className="px-5 py-3">
                          <EstadoCobroBadge estado={c.estado} />
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Button size="sm" variant="secondary" className="whitespace-nowrap" onClick={() => abrir(c.id)}>
                            Ver detalle
                          </Button>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {abierto && <ModalCobro id={abierto} onClose={() => abrir(null)} onActualizado={recargar} />}
    </div>
  );
}
