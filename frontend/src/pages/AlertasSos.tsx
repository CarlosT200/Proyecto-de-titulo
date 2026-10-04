import { useEffect } from "react";
import { motion } from "framer-motion";
import { Siren } from "@phosphor-icons/react";
import { sosApi } from "../api/endpoints";
import { useAsync } from "../hooks/useAsync";
import { Alert, Badge, Card, EmptyState, PageHeader, Spinner, staggerFade } from "../components/ui";
import { formatFechaHora } from "../lib/format";
import { TIPO_EMERGENCIA_LABEL, TIPO_EMERGENCIA_TONO } from "../lib/badges";

// Compartida entre administrador y conserjeria: ambos necesitan enterarse de
// inmediato cuando un residente activa el boton SOS (ver components/BotonSOS.tsx),
// para poder asistir (abrir reja, guiar a la unidad correcta, etc).
export default function AlertasSos() {
  const { data, cargando, error, setData } = useAsync(() => sosApi.listar(), []);

  useEffect(() => {
    const intervalo = setInterval(() => {
      sosApi.listar().then(setData).catch(() => {});
    }, 15000);
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Siren}
        title="Alertas SOS"
        subtitle="Emergencias activadas por residentes desde su celular."
      />

      <Card>
        {cargando ? (
          <Spinner />
        ) : error ? (
          <Alert tone="red">{error}</Alert>
        ) : !data?.length ? (
          <EmptyState icon={Siren} title="Sin alertas registradas" description="Aquí aparecerán las emergencias que activen los residentes." />
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {data.map((a, i) => (
              <motion.div
                key={a.id}
                {...staggerFade(i)}
                className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-700/60"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    {a.usuario.nombre} {a.usuario.apellido}
                    {a.usuario.departamento && (
                      <span className="font-normal text-slate-500 dark:text-slate-400">
                        {" "}
                        · {a.usuario.departamento.torre?.nombre ?? ""} {a.usuario.departamento.numero}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{formatFechaHora(a.createdAt)}</p>
                </div>
                <Badge tone={TIPO_EMERGENCIA_TONO[a.tipo]}>{TIPO_EMERGENCIA_LABEL[a.tipo]}</Badge>
              </motion.div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
