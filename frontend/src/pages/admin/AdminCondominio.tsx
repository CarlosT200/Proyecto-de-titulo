import { FormEvent, ReactNode, useEffect, useState } from "react";
import clsx from "clsx";
import { Buildings, Clock, PencilSimple, Plus, UsersThree } from "@phosphor-icons/react";
import { condominioApi } from "../../api/endpoints";
import { useAsync } from "../../hooks/useAsync";
import { useFiltroUrl } from "../../hooks/useFiltroUrl";
import { useAcercarAlAparecer } from "../../hooks/useAcercarAlAparecer";
import { usePulsoAlCambiar } from "../../hooks/usePulsoAlCambiar";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Input, Label, Modal, PageHeader, Select, Spinner, Textarea } from "../../components/ui";
import { mensajeError } from "../../api/client";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";
import { useAuth } from "../../context/AuthContext";
import type { Departamento, EspacioComun, Torre } from "../../types";

const SECCIONES = ["espacios", "unidades", "datos"] as const;
type Seccion = (typeof SECCIONES)[number];

const aMinutos = (hora: string) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
const ordenNatural = (a: string, b: string) => a.localeCompare(b, "es", { numeric: true });

export default function AdminCondominio() {
  const [elegida, setSeccion] = useFiltroUrl("seccion", SECCIONES);
  const seccion: Seccion = elegida || "espacios";
  const espacios = useAsync(() => condominioApi.listarEspacios(), []);
  const torres = useAsync(() => condominioApi.listarTorres(), []);
  const departamentos = useAsync(() => condominioApi.listarDepartamentos(), []);

  const pestanas: { valor: Seccion; largo: string; corto: string; cuenta?: number }[] = [
    { valor: "espacios", largo: "Espacios comunes", corto: "Espacios", cuenta: espacios.data?.length },
    { valor: "unidades", largo: "Torres y unidades", corto: "Unidades", cuenta: departamentos.data?.length },
    { valor: "datos", largo: "Datos del condominio", corto: "Datos" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader icon={Buildings} title="Estructura del condominio" subtitle="Espacios comunes, torres, unidades y datos generales." />

      {/* Pestañas: en celular ocupan el ancho en tres partes iguales, con nombres cortos. */}
      <div role="tablist" aria-label="Secciones" className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 sm:inline-grid sm:w-auto dark:bg-slate-800">
        {pestanas.map((p) => (
          <button
            key={p.valor}
            type="button"
            role="tab"
            id={`pestana-${p.valor}`}
            aria-selected={seccion === p.valor}
            aria-controls={`panel-${p.valor}`}
            onClick={() => setSeccion(p.valor === "espacios" ? "" : p.valor)}
            className={clsx(
              "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:px-4 lg:min-h-10",
              seccion === p.valor
                ? "bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            )}
          >
            <span className="sm:hidden">{p.corto}</span>
            <span className="hidden sm:inline">{p.largo}</span>
            {p.cuenta !== undefined && (
              <span className="rounded-full bg-slate-200/80 px-1.5 text-xs tabular-nums text-slate-700 dark:bg-slate-600 dark:text-slate-100">{p.cuenta}</span>
            )}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${seccion}`} aria-labelledby={`pestana-${seccion}`}>
        {seccion === "espacios" && <EspaciosComunes {...espacios} />}
        {seccion === "unidades" && (
          <TorresYUnidades
            torres={torres.data}
            departamentos={departamentos.data}
            cargando={(torres.cargando && !torres.data) || (departamentos.cargando && !departamentos.data)}
            error={torres.error ?? departamentos.error}
            recargar={() => {
              torres.recargar();
              departamentos.recargar();
            }}
          />
        )}
        {seccion === "datos" && <DatosCondominio />}
      </div>
    </div>
  );
}

// Lo nuevo entra con un movimiento corto y, si quedo fuera de la pantalla, se acerca para confirmarlo.
function Nuevo({ nuevo, className, children }: { nuevo: boolean; className?: string; children: ReactNode }) {
  const ref = useAcercarAlAparecer<HTMLLIElement>(nuevo, 1023);
  return (
    <li ref={ref} className={clsx(className, nuevo && "animate-aparece")}>
      {children}
    </li>
  );
}

function EstadoEspacio({ activo }: { activo: boolean }) {
  const pulso = usePulsoAlCambiar(String(activo));
  return (
    <span key={pulso} className={clsx("inline-flex", pulso > 0 && "animate-aparece")}>
      <Badge tone={activo ? "green" : "slate"}>{activo ? "Disponible" : "Desactivado"}</Badge>
    </span>
  );
}

function CamposEspacio({
  prefijo,
  valores,
  onCambio,
}: {
  prefijo: string;
  valores: { nombre: string; descripcion: string; capacidad: string; horarioInicio: string; horarioFin: string };
  onCambio: (campo: keyof typeof valores, valor: string) => void;
}) {
  const horarioInvalido = valores.horarioInicio && valores.horarioFin && aMinutos(valores.horarioFin) <= aMinutos(valores.horarioInicio);
  return (
    <>
      <div>
        <Label htmlFor={`${prefijo}-nombre`}>Nombre</Label>
        <Input id={`${prefijo}-nombre`} required maxLength={80} value={valores.nombre} onChange={(e) => onCambio("nombre", e.target.value)} placeholder="Ej: Quincho" />
      </div>
      <div>
        <Label htmlFor={`${prefijo}-descripcion`}>Descripción (opcional)</Label>
        <Textarea
          id={`${prefijo}-descripcion`}
          rows={2}
          maxLength={300}
          value={valores.descripcion}
          onChange={(e) => onCambio("descripcion", e.target.value)}
          placeholder="Ej: Con parrilla y mesas para 20 personas."
        />
      </div>
      <div>
        <Label htmlFor={`${prefijo}-capacidad`}>Capacidad (opcional)</Label>
        <Input
          id={`${prefijo}-capacidad`}
          type="number"
          inputMode="numeric"
          min={1}
          value={valores.capacidad}
          onChange={(e) => onCambio("capacidad", e.target.value)}
          placeholder="Personas"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor={`${prefijo}-desde`}>Abre</Label>
          <Input id={`${prefijo}-desde`} type="time" required value={valores.horarioInicio} onChange={(e) => onCambio("horarioInicio", e.target.value)} />
        </div>
        <div>
          <Label htmlFor={`${prefijo}-hasta`}>Cierra</Label>
          <Input id={`${prefijo}-hasta`} type="time" required value={valores.horarioFin} onChange={(e) => onCambio("horarioFin", e.target.value)} />
        </div>
      </div>
      {horarioInvalido && <Alert tone="amber">El horario de cierre debe ser posterior al de apertura.</Alert>}
    </>
  );
}

const ESPACIO_VACIO = { nombre: "", descripcion: "", capacidad: "", horarioInicio: "09:00", horarioFin: "22:00" };

function datosEspacio(v: typeof ESPACIO_VACIO) {
  return {
    nombre: v.nombre.trim(),
    descripcion: v.descripcion.trim() || undefined,
    capacidad: v.capacidad ? Number(v.capacidad) : undefined,
    horarioInicio: v.horarioInicio,
    horarioFin: v.horarioFin,
  };
}

function EspaciosComunes({
  data,
  cargando,
  error,
  recargar,
}: {
  data: EspacioComun[] | null;
  cargando: boolean;
  error: string | null;
  recargar: () => void;
}) {
  const toast = useToast();
  const confirmar = useConfirm();
  const [valores, setValores] = useState(ESPACIO_VACIO);
  const [formError, setFormError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [editando, setEditando] = useState<EspacioComun | null>(null);
  const [nuevoId, setNuevoId] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setEnviando(true);
    try {
      const creado = await condominioApi.crearEspacio(datosEspacio(valores));
      setValores(ESPACIO_VACIO);
      setNuevoId(creado.id);
      toast.success("Espacio común creado.");
      recargar();
    } catch (err) {
      setFormError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  async function alternar(esp: EspacioComun) {
    if (esp.activo) {
      const ok = await confirmar(`¿Desactivar ${esp.nombre}? Los residentes dejarán de verlo para reservar hasta que lo vuelvas a activar.`, {
        titulo: "Desactivar espacio",
        textoConfirmar: "Desactivar",
        textoCancelar: "Volver",
      });
      if (!ok) return;
    }
    try {
      await condominioApi.actualizarEspacio(esp.id, { activo: !esp.activo });
      toast.success(esp.activo ? "Espacio desactivado." : "Espacio activado.");
      recargar();
    } catch (err) {
      toast.error(mensajeError(err));
    }
  }

  const ordenados = [...(data ?? [])].sort((a, b) => Number(b.activo) - Number(a.activo) || ordenNatural(a.nombre, b.nombre));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card plana className="lg:col-span-2">
        <CardHeader nivel={2} title="Espacios comunes" subtitle="Los disponibles aparecen para reservar; los desactivados no." />
        {cargando && !data ? (
          <Spinner />
        ) : error ? (
          <Alert tone="red">{error}</Alert>
        ) : !ordenados.length ? (
          <EmptyState icon={Buildings} title="Aún no hay espacios comunes" description="Crea el primero con el formulario." />
        ) : (
          <ul className="grid gap-px bg-slate-100 sm:grid-cols-2 dark:bg-slate-700/60">
            {ordenados.map((esp) => (
              <Nuevo
                key={esp.id}
                nuevo={esp.id === nuevoId}
                className="flex flex-col gap-3 bg-white p-5 dark:bg-slate-800 sm:[&:last-child:nth-child(odd)]:col-span-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className={clsx("break-words font-display font-semibold", esp.activo ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-300")}>
                    {esp.nombre}
                  </h3>
                  <EstadoEspacio activo={esp.activo} />
                </div>
                {esp.descripcion && <p className="text-sm text-slate-600 dark:text-slate-300">{esp.descripcion}</p>}
                <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700 dark:text-slate-200">
                  <span className="inline-flex items-center gap-1.5 tabular-nums">
                    <Clock size={16} className="text-brand-600 dark:text-brand-300" aria-hidden /> {esp.horarioInicio} a {esp.horarioFin}
                  </span>
                  {esp.capacidad ? (
                    <span className="inline-flex items-center gap-1.5">
                      <UsersThree size={16} className="text-brand-600 dark:text-brand-300" aria-hidden /> Hasta {esp.capacidad} personas
                    </span>
                  ) : null}
                </p>
                <div className="mt-auto grid grid-cols-2 gap-2">
                  <Button size="sm" variant="secondary" className="max-sm:min-h-11" onClick={() => setEditando(esp)}>
                    <PencilSimple size={14} aria-hidden /> Editar
                  </Button>
                  <Button size="sm" variant="secondary" className="max-sm:min-h-11" onClick={() => alternar(esp)}>
                    {esp.activo ? "Desactivar" : "Activar"}
                  </Button>
                </div>
              </Nuevo>
            ))}
          </ul>
        )}
      </Card>

      {/* En celular el formulario va primero: es lo que se usa al configurar el condominio. */}
      <Card plana className="h-fit max-lg:order-first">
        <CardHeader nivel={2} title="Nuevo espacio común" />
        <form onSubmit={handleSubmit} className="space-y-3 p-5">
          <CamposEspacio prefijo="campo-espacio" valores={valores} onCambio={(c, v) => setValores((s) => ({ ...s, [c]: v }))} />
          {formError && <Alert tone="red">{formError}</Alert>}
          <Button type="submit" className="w-full" loading={enviando}>
            <Plus size={16} weight="bold" aria-hidden /> Crear espacio
          </Button>
        </form>
      </Card>

      <Modal open={editando !== null} onClose={() => setEditando(null)} title={editando ? `Editar ${editando.nombre}` : "Editar espacio"}>
        {editando && (
          <EditarEspacio
            espacio={editando}
            onGuardado={() => {
              setEditando(null);
              recargar();
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function EditarEspacio({ espacio, onGuardado }: { espacio: EspacioComun; onGuardado: () => void }) {
  const toast = useToast();
  const [valores, setValores] = useState({
    nombre: espacio.nombre,
    descripcion: espacio.descripcion ?? "",
    capacidad: espacio.capacidad ? String(espacio.capacidad) : "",
    horarioInicio: espacio.horarioInicio,
    horarioFin: espacio.horarioFin,
  });
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      // al editar, una descripcion vacia se guarda vacia (borrarla es valido)
      await condominioApi.actualizarEspacio(espacio.id, { ...datosEspacio(valores), descripcion: valores.descripcion.trim() });
      toast.success("Espacio actualizado.");
      onGuardado();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <CamposEspacio prefijo="campo-editar-espacio" valores={valores} onCambio={(c, v) => setValores((s) => ({ ...s, [c]: v }))} />
      <p className="text-xs text-slate-500 dark:text-slate-400">Las reservas ya hechas no cambian; el nuevo horario rige para las próximas.</p>
      {error && <Alert tone="red">{error}</Alert>}
      <Button type="submit" className="w-full" loading={enviando}>
        Guardar cambios
      </Button>
    </form>
  );
}

function TorresYUnidades({
  torres,
  departamentos,
  cargando,
  error,
  recargar,
}: {
  torres: Torre[] | null;
  departamentos: Departamento[] | null;
  cargando: boolean;
  error: string | null;
  recargar: () => void;
}) {
  const toast = useToast();
  const [nombreTorre, setNombreTorre] = useState("");
  const [enviandoTorre, setEnviandoTorre] = useState(false);
  const [errorTorre, setErrorTorre] = useState<string | null>(null);
  const [numero, setNumero] = useState("");
  const [torreId, setTorreId] = useState("");
  const [enviandoUnidad, setEnviandoUnidad] = useState(false);
  const [errorUnidad, setErrorUnidad] = useState<string | null>(null);
  const [nuevaId, setNuevaId] = useState<string | null>(null);

  // Si hay una sola torre, la unidad nueva va ahi por defecto.
  useEffect(() => {
    if (torres?.length === 1 && !torreId) setTorreId(torres[0].id);
  }, [torres, torreId]);

  async function crearTorre(e: FormEvent) {
    e.preventDefault();
    setErrorTorre(null);
    setEnviandoTorre(true);
    try {
      const torre = await condominioApi.crearTorre(nombreTorre.trim());
      setNombreTorre("");
      setTorreId(torre.id);
      toast.success("Torre creada.");
      recargar();
    } catch (err) {
      setErrorTorre(mensajeError(err));
    } finally {
      setEnviandoTorre(false);
    }
  }

  async function crearUnidad(e: FormEvent) {
    e.preventDefault();
    setErrorUnidad(null);
    setEnviandoUnidad(true);
    try {
      const unidad = await condominioApi.crearDepartamento({ numero: numero.trim(), torreId: torreId || null });
      setNumero("");
      setNuevaId(unidad.id);
      toast.success("Unidad creada.");
      recargar();
    } catch (err) {
      setErrorUnidad(mensajeError(err));
    } finally {
      setEnviandoUnidad(false);
    }
  }

  // Unidades agrupadas por torre (y las que no tienen torre al final), en orden natural (101, 102, 1001).
  const grupos = [
    ...[...(torres ?? [])].sort((a, b) => ordenNatural(a.nombre, b.nombre)).map((t) => ({ id: t.id, nombre: t.nombre })),
    { id: "", nombre: "Sin torre" },
  ]
    .map((g) => ({
      ...g,
      unidades: (departamentos ?? []).filter((d) => (d.torre?.id ?? "") === g.id).sort((a, b) => ordenNatural(a.numero, b.numero)),
    }))
    .filter((g) => g.id || g.unidades.length > 0);
  const ocupadas = (departamentos ?? []).filter((d) => d.residentes.length > 0).length;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card plana className="lg:col-span-2">
        <CardHeader
          nivel={2}
          title="Unidades por torre"
          subtitle={departamentos?.length ? `${departamentos.length} ${departamentos.length === 1 ? "unidad" : "unidades"} · ${ocupadas} con residentes` : undefined}
        />
        {cargando ? (
          <Spinner />
        ) : error ? (
          <Alert tone="red">{error}</Alert>
        ) : !grupos.length ? (
          <EmptyState icon={Buildings} title="Aún no hay torres ni unidades" description="Crea una torre y luego sus unidades." />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {grupos.map((g) => (
              <section key={g.id || "sin-torre"} aria-labelledby={`torre-${g.id || "sin"}`} className="p-5">
                <h3 id={`torre-${g.id || "sin"}`} className="mb-3 flex items-baseline justify-between gap-3">
                  <span className="font-display font-semibold text-slate-900 dark:text-white">{g.nombre}</span>
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    {g.unidades.length} {g.unidades.length === 1 ? "unidad" : "unidades"}
                  </span>
                </h3>
                {g.unidades.length === 0 ? (
                  <p className="text-sm text-slate-600 dark:text-slate-300">Sin unidades todavía.</p>
                ) : (
                  <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                    {g.unidades.map((d) => (
                      <Nuevo
                        key={d.id}
                        nuevo={d.id === nuevaId}
                        className={clsx(
                          "rounded-xl border p-3",
                          d.residentes.length
                            ? "border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800"
                            : "border-dashed border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-900/40"
                        )}
                      >
                        <p className="font-display text-lg font-bold tabular-nums text-slate-900 dark:text-white">{d.numero}</p>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          {d.residentes.length === 0
                            ? "Desocupada"
                            : d.residentes.length === 1
                              ? `${d.residentes[0].nombre} ${d.residentes[0].apellido}`
                              : `${d.residentes.length} residentes`}
                        </p>
                      </Nuevo>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        )}
      </Card>

      <div className="h-fit space-y-6 max-lg:order-first">
        <Card plana>
          <CardHeader nivel={2} title="Nueva unidad" />
          <form onSubmit={crearUnidad} className="space-y-3 p-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
              <div>
                <Label htmlFor="campo-unidad-torre">Torre</Label>
                <Select id="campo-unidad-torre" value={torreId} onChange={(e) => setTorreId(e.target.value)}>
                  <option value="">Sin torre</option>
                  {torres?.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="campo-unidad-numero">Número</Label>
                <Input id="campo-unidad-numero" required maxLength={20} value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Ej: 101" />
              </div>
            </div>
            {errorUnidad && <Alert tone="red">{errorUnidad}</Alert>}
            <Button type="submit" className="w-full" loading={enviandoUnidad}>
              <Plus size={16} weight="bold" aria-hidden /> Crear unidad
            </Button>
          </form>
        </Card>
        <Card plana>
          <CardHeader nivel={2} title="Nueva torre" subtitle="Si el condominio tiene un solo edificio, basta con una." />
          <form onSubmit={crearTorre} className="space-y-3 p-5">
            <div>
              <Label htmlFor="campo-torre-nombre">Nombre</Label>
              <Input id="campo-torre-nombre" required maxLength={60} value={nombreTorre} onChange={(e) => setNombreTorre(e.target.value)} placeholder="Ej: Torre B" />
            </div>
            {errorTorre && <Alert tone="red">{errorTorre}</Alert>}
            <Button type="submit" variant="secondary" className="w-full" loading={enviandoTorre}>
              Crear torre
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

function DatosCondominio() {
  const toast = useToast();
  const { usuario, actualizarUsuario } = useAuth();
  const { data, cargando, error } = useAsync(() => condominioApi.obtener(), []);
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [comuna, setComuna] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setNombre(data.nombre);
    setDireccion(data.direccion ?? "");
    setComuna(data.comuna ?? "");
  }, [data]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setEnviando(true);
    try {
      const guardado = await condominioApi.actualizar({ nombre: nombre.trim(), direccion: direccion.trim() || null, comuna: comuna.trim() || null });
      // el nombre aparece en la cabecera, el panel y la credencial: se actualiza sin volver a entrar
      if (usuario) actualizarUsuario({ ...usuario, condominio: { id: guardado.id, nombre: guardado.nombre } });
      toast.success("Datos del condominio guardados.");
    } catch (err) {
      setFormError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card plana className="max-w-2xl">
      <CardHeader nivel={2} title="Datos del condominio" subtitle="El nombre aparece en la cabecera, en las credenciales QR y en el aviso de privacidad." />
      {cargando && !data ? (
        <Spinner />
      ) : error ? (
        <Alert tone="red">{error}</Alert>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3 p-5">
          <div>
            <Label htmlFor="campo-condo-nombre">Nombre</Label>
            <Input id="campo-condo-nombre" required maxLength={120} value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Label htmlFor="campo-condo-direccion">Dirección (opcional)</Label>
              <Input id="campo-condo-direccion" maxLength={160} value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Ej: Av. Siempre Viva 742" />
            </div>
            <div>
              <Label htmlFor="campo-condo-comuna">Comuna (opcional)</Label>
              <Input id="campo-condo-comuna" maxLength={80} value={comuna} onChange={(e) => setComuna(e.target.value)} placeholder="Ej: Ñuñoa" />
            </div>
          </div>
          {formError && <Alert tone="red">{formError}</Alert>}
          <Button type="submit" className="w-full sm:w-auto" loading={enviando}>
            Guardar datos
          </Button>
        </form>
      )}
    </Card>
  );
}
