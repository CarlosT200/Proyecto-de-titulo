import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { Buildings } from "@phosphor-icons/react";
import { condominioApi } from "../../api/endpoints";
import { useAsync } from "../../hooks/useAsync";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Input, Label, PageHeader, Select, Spinner, staggerFade } from "../../components/ui";
import { mensajeError } from "../../api/client";
import { useToast } from "../../context/ToastContext";
import clsx from "clsx";

type Tab = "torres" | "departamentos" | "espacios";

export default function AdminCondominio() {
  const [tab, setTab] = useState<Tab>("espacios");

  return (
    <div className="space-y-6">
      <PageHeader icon={Buildings} title="Estructura del condominio" subtitle="Torres, departamentos y espacios comunes (HU-03)." />

      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
        {(
          [
            ["espacios", "Espacios comunes"],
            ["torres", "Torres"],
            ["departamentos", "Departamentos"],
          ] as [Tab, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={clsx(
              "border-b-2 px-3 py-2 max-sm:py-3 text-sm font-medium transition-colors",
              tab === value
                ? "border-brand-600 text-brand-700 dark:text-brand-300"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "espacios" && <EspaciosComunes />}
      {tab === "torres" && <Torres />}
      {tab === "departamentos" && <Departamentos />}
    </div>
  );
}

function EspaciosComunes() {
  const toast = useToast();
  const { data, cargando, error, recargar } = useAsync(() => condominioApi.listarEspacios(), []);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [capacidad, setCapacidad] = useState("");
  const [horarioInicio, setHorarioInicio] = useState("09:00");
  const [horarioFin, setHorarioFin] = useState("22:00");
  const [formError, setFormError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setEnviando(true);
    try {
      await condominioApi.crearEspacio({
        nombre,
        descripcion: descripcion || undefined,
        capacidad: capacidad ? Number(capacidad) : undefined,
        horarioInicio,
        horarioFin,
      });
      setNombre("");
      setDescripcion("");
      setCapacidad("");
      toast.success("Espacio común creado.");
      recargar();
    } catch (err) {
      setFormError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Espacios comunes registrados" />
        {cargando ? (
          <Spinner />
        ) : error ? (
          <Alert tone="red">{error}</Alert>
        ) : !data?.length ? (
          <EmptyState icon={Buildings} title="Aún no hay espacios comunes" />
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {data.map((esp, i) => (
              <motion.div key={esp.id} {...staggerFade(i)} className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-700/60">
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{esp.nombre}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {esp.horarioInicio} - {esp.horarioFin} {esp.capacidad ? `· Capacidad ${esp.capacidad}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={esp.activo ? "green" : "slate"}>{esp.activo ? "Activo" : "Inactivo"}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await condominioApi.actualizarEspacio(esp.id, { activo: !esp.activo });
                      toast.success(esp.activo ? "Espacio desactivado." : "Espacio activado.");
                      recargar();
                    }}
                  >
                    {esp.activo ? "Desactivar" : "Activar"}
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Card>

      <Card className="h-fit">
        <CardHeader title="Nuevo espacio común" />
        <form onSubmit={handleSubmit} className="space-y-3 p-5">
          <div>
            <Label htmlFor="campo-condominio-1">Nombre</Label>
            <Input id="campo-condominio-1" required value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Quincho" />
          </div>
          <div>
            <Label htmlFor="campo-condominio-2">Descripción</Label>
            <Input id="campo-condominio-2" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="campo-condominio-3">Capacidad</Label>
            <Input id="campo-condominio-3" type="number" min={1} value={capacidad} onChange={(e) => setCapacidad(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="campo-condominio-4">Horario desde</Label>
              <Input id="campo-condominio-4" type="time" value={horarioInicio} onChange={(e) => setHorarioInicio(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="campo-condominio-5">Horario hasta</Label>
              <Input id="campo-condominio-5" type="time" value={horarioFin} onChange={(e) => setHorarioFin(e.target.value)} />
            </div>
          </div>
          {formError && <Alert tone="red">{formError}</Alert>}
          <Button type="submit" className="w-full" loading={enviando}>
            Crear espacio
          </Button>
        </form>
      </Card>
    </div>
  );
}

function Torres() {
  const toast = useToast();
  const { data, cargando, error, recargar } = useAsync(() => condominioApi.listarTorres(), []);
  const [nombre, setNombre] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      await condominioApi.crearTorre(nombre);
      setNombre("");
      toast.success("Torre creada.");
      recargar();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Torres / edificios" />
        {cargando ? (
          <Spinner />
        ) : error ? (
          <Alert tone="red">{error}</Alert>
        ) : !data?.length ? (
          <EmptyState icon={Buildings} title="Aún no hay torres registradas" />
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {data.map((t, i) => (
              <motion.div key={t.id} {...staggerFade(i)} className="px-5 py-3 text-sm text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-700/60">
                {t.nombre}
              </motion.div>
            ))}
          </div>
        )}
      </Card>
      <Card className="h-fit">
        <CardHeader title="Nueva torre" />
        <form onSubmit={handleSubmit} className="space-y-3 p-5">
          <div>
            <Label htmlFor="campo-condominio-6">Nombre</Label>
            <Input id="campo-condominio-6" required value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Torre B" />
          </div>
          <Button type="submit" className="w-full" loading={enviando}>
            Crear torre
          </Button>
        </form>
      </Card>
    </div>
  );
}

function Departamentos() {
  const toast = useToast();
  const { data, cargando, error, recargar } = useAsync(() => condominioApi.listarDepartamentos(), []);
  const { data: torres } = useAsync(() => condominioApi.listarTorres(), []);
  const [numero, setNumero] = useState("");
  const [torreId, setTorreId] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setEnviando(true);
    try {
      await condominioApi.crearDepartamento({ numero, torreId: torreId || null });
      setNumero("");
      toast.success("Departamento creado.");
      recargar();
    } catch (err) {
      setFormError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Departamentos" />
        {cargando ? (
          <Spinner />
        ) : error ? (
          <Alert tone="red">{error}</Alert>
        ) : !data?.length ? (
          <EmptyState icon={Buildings} title="Aún no hay departamentos registrados" />
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {data.map((d, i) => (
              <motion.div key={d.id} {...staggerFade(i)} className="flex items-center justify-between px-5 py-3 text-sm transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-700/60">
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  {d.torre?.nombre ?? "Sin torre"} - {d.numero}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {d.residentes.length} residente{d.residentes.length === 1 ? "" : "s"}
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </Card>
      <Card className="h-fit">
        <CardHeader title="Nuevo departamento" />
        <form onSubmit={handleSubmit} className="space-y-3 p-5">
          <div>
            <Label htmlFor="campo-condominio-7">Torre</Label>
            <Select id="campo-condominio-7" value={torreId} onChange={(e) => setTorreId(e.target.value)}>
              <option value="">Sin torre</option>
              {torres?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="campo-condominio-8">Número</Label>
            <Input id="campo-condominio-8" required value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="101" />
          </div>
          {formError && <Alert tone="red">{formError}</Alert>}
          <Button type="submit" className="w-full" loading={enviando}>
            Crear departamento
          </Button>
        </form>
      </Card>
    </div>
  );
}
