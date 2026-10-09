import { FormEvent, ReactNode, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import clsx from "clsx";
import { useAuth } from "../../context/AuthContext";
import { generarPasswordTemporal } from "../../lib/password";
import { Copy, Key, MagicWand, PencilSimple, Phone, Prohibit, UserPlus, Users } from "@phosphor-icons/react";
import { condominioApi, usuariosApi } from "../../api/endpoints";
import { useAsync } from "../../hooks/useAsync";
import { useFiltroUrl } from "../../hooks/useFiltroUrl";
import { useAcercarAlAparecer } from "../../hooks/useAcercarAlAparecer";
import { usePulsoAlCambiar } from "../../hooks/usePulsoAlCambiar";
import { Alert, Badge, Button, Card, EmptyState, Input, Label, Modal, PageHeader, SearchInput, Select, Spinner } from "../../components/ui";
import { CeldaResumen } from "../../components/CeldaResumen";
import { mensajeError } from "../../api/client";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";
import type { Rol, Usuario } from "../../types";

const ROL_LABEL: Record<Rol, string> = { ADMIN: "Administración", RESIDENTE: "Residente", CONSERJE: "Conserjería" };
const ROLES = ["RESIDENTE", "CONSERJE", "ADMIN"] as const;
const VISTAS = ["residentes", "sin-unidad", "deshabilitados"] as const;

type Departamento = { id: string; numero: string; torre: { nombre: string } | null };

const unidadDe = (u: Pick<Usuario, "departamento">) =>
  u.departamento ? [u.departamento.torre?.nombre, u.departamento.numero].filter(Boolean).join(" ") : null;
const esActivo = (u: Usuario) => u.activo !== false;
const sinUnidad = (u: Usuario) => u.rol === "RESIDENTE" && esActivo(u) && !u.departamento;

// Activos primero: residentes (los que no tienen unidad arriba, porque hay que asignarla; luego por
// torre y numero), despues conserjeria y administracion. Al final las cuentas deshabilitadas.
function ordenarUsuarios(lista: Usuario[]): Usuario[] {
  const ordenRol: Record<Rol, number> = { RESIDENTE: 0, CONSERJE: 1, ADMIN: 2 };
  return [...lista].sort((a, b) => {
    if (esActivo(a) !== esActivo(b)) return esActivo(a) ? -1 : 1;
    if (a.rol !== b.rol) return ordenRol[a.rol] - ordenRol[b.rol];
    if (a.rol === "RESIDENTE") {
      const ua = unidadDe(a);
      const ub = unidadDe(b);
      if (!ua !== !ub) return ua ? 1 : -1;
      if (ua && ub && ua !== ub) return ua.localeCompare(ub, "es", { numeric: true });
    }
    return `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`, "es");
  });
}

function Iniciales({ usuario }: { usuario: Usuario }) {
  const tono = !esActivo(usuario)
    ? "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300"
    : usuario.rol === "RESIDENTE"
      ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200"
      : usuario.rol === "CONSERJE"
        ? "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200"
        : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-100";
  return (
    <span aria-hidden className={clsx("flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold", tono)}>
      {(usuario.nombre[0] ?? "").toUpperCase()}
      {(usuario.apellido[0] ?? "").toUpperCase()}
    </span>
  );
}

// Lo que hay que mirar de una cuenta, en palabras: deshabilitada o residente sin unidad. Si cambia
// (se habilita o deshabilita) entra con un movimiento corto; al cargar la pagina no se mueve.
function EstadoCuenta({ usuario }: { usuario: Usuario }) {
  const estado = !esActivo(usuario) ? "deshabilitada" : sinUnidad(usuario) ? "sin-unidad" : "activa";
  const pulso = usePulsoAlCambiar(estado);
  return (
    <span key={pulso} className={clsx("inline-flex", pulso > 0 && "animate-aparece")}>
      {estado === "deshabilitada" ? (
        <Badge tone="slate">Deshabilitada</Badge>
      ) : estado === "sin-unidad" ? (
        <Badge tone="amber">Sin unidad</Badge>
      ) : (
        <Badge tone="green">Activa</Badge>
      )}
    </span>
  );
}

function BotonAccion({
  tono = "normal",
  onClick,
  children,
}: {
  tono?: "normal" | "peligro" | "positivo";
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:px-3 xl:min-h-9",
        tono === "normal" && "border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700",
        tono === "peligro" && "border-red-200 text-red-700 hover:bg-red-50 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10",
        tono === "positivo" && "border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/40 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
      )}
    >
      {children}
    </button>
  );
}

// La cuenta recien registrada entra con un movimiento corto y, si quedo fuera de la pantalla, se acerca.
function ItemNuevo<T extends HTMLElement>({
  nueva,
  como: Como,
  className,
  children,
}: {
  nueva: boolean;
  como: "li" | "tr";
  className?: string;
  children: ReactNode;
}) {
  const ref = useAcercarAlAparecer<T>(nueva, 1279);
  return (
    <Como ref={ref as never} className={clsx(className, nueva && "animate-aparece")}>
      {children}
    </Como>
  );
}

export default function AdminUsuarios() {
  const toast = useToast();
  const confirmar = useConfirm();
  const { usuario: yo } = useAuth();
  const { data: usuarios, cargando, error, recargar } = useAsync(() => usuariosApi.listar(), []);
  const { data: departamentos } = useAsync(() => condominioApi.listarDepartamentos(), []);
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [usuarioClave, setUsuarioClave] = useState<Usuario | null>(null);
  const [nuevaId, setNuevaId] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [rol, setRol] = useFiltroUrl("rol", ROLES);
  const [vista, setVista] = useFiltroUrl("vista", VISTAS);
  const [, setParams] = useSearchParams();

  const lista = usuarios ?? [];
  const residentes = lista.filter((u) => u.rol === "RESIDENTE" && esActivo(u)).length;
  const porAsignar = lista.filter(sinUnidad).length;
  const deshabilitados = lista.filter((u) => !esActivo(u)).length;

  const filtrados = ordenarUsuarios(
    lista.filter((u) => {
      const texto = `${u.nombre} ${u.apellido} ${u.email} ${unidadDe(u) ?? ""} ${u.telefono ?? ""}`.toLowerCase();
      if (busqueda && !texto.includes(busqueda.toLowerCase())) return false;
      if (rol && u.rol !== rol) return false;
      if (vista === "residentes") return u.rol === "RESIDENTE" && esActivo(u);
      if (vista === "sin-unidad") return sinUnidad(u);
      if (vista === "deshabilitados") return !esActivo(u);
      return true;
    })
  );
  const hayFiltros = Boolean(busqueda || rol || vista);

  async function alternarActivo(u: Usuario) {
    if (esActivo(u)) {
      const ok = await confirmar(`¿Deshabilitar a ${u.nombre} ${u.apellido}? No podrá iniciar sesión hasta que lo vuelvas a habilitar.`, {
        titulo: "Deshabilitar cuenta",
        textoConfirmar: "Deshabilitar",
        textoCancelar: "Volver",
      });
      if (!ok) return;
    }
    try {
      await usuariosApi.actualizar(u.id, { activo: !esActivo(u) });
      toast.success(esActivo(u) ? "Cuenta deshabilitada." : "Cuenta habilitada.");
      recargar();
    } catch (err) {
      toast.error(mensajeError(err));
    }
  }

  const acciones = (u: Usuario) =>
    u.id === yo?.id ? (
      <Link
        to="/perfil"
        className="inline-flex min-h-11 items-center rounded-lg text-sm font-medium text-brand-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-brand-400 xl:min-h-9"
      >
        <span className="xl:hidden">Tu cuenta: edítala en Mi perfil</span>
        <span className="hidden xl:inline">Editar en Mi perfil</span>
      </Link>
    ) : (
      <div className="grid grid-cols-3 gap-2 xl:flex xl:justify-end">
        <BotonAccion onClick={() => setEditando(u)}>
          <PencilSimple size={16} aria-hidden className="max-sm:hidden" /> Editar
        </BotonAccion>
        <BotonAccion onClick={() => setUsuarioClave(u)}>
          <Key size={16} aria-hidden className="max-sm:hidden" /> Clave
        </BotonAccion>
        {esActivo(u) ? (
          <BotonAccion tono="peligro" onClick={() => alternarActivo(u)}>
            <Prohibit size={16} aria-hidden className="max-sm:hidden" /> Deshabilitar
          </BotonAccion>
        ) : (
          <BotonAccion tono="positivo" onClick={() => alternarActivo(u)}>
            Habilitar
          </BotonAccion>
        )}
      </div>
    );

  const nombre = (u: Usuario) => (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <span className={clsx("break-words font-medium", esActivo(u) ? "text-slate-900 dark:text-slate-100" : "text-slate-600 dark:text-slate-300")}>
        {u.nombre} {u.apellido}
      </span>
      {u.id === yo?.id && <span className="text-xs font-medium text-brand-700 dark:text-brand-300">(tú)</span>}
    </span>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Users}
        title="Residentes y usuarios"
        subtitle="Cuentas de residentes, conserjería y administración."
        action={
          <Button onClick={() => setCreando(true)} className="max-sm:w-full">
            <UserPlus size={16} weight="bold" aria-hidden /> Nuevo usuario
          </Button>
        }
      />

      {lista.length > 0 && (
        <Card plana className="overflow-hidden">
          <div className="grid grid-cols-3 gap-px bg-slate-100 dark:bg-slate-700/60">
            <CeldaResumen
              titulo="Residentes"
              valor={residentes}
              detalle="con cuenta activa"
              activa={vista === "residentes"}
              onToggle={() => setVista(vista === "residentes" ? "" : "residentes")}
            />
            <CeldaResumen
              titulo="Sin unidad"
              valor={porAsignar}
              detalle="por asignar"
              alerta="amber"
              activa={vista === "sin-unidad"}
              onToggle={() => setVista(vista === "sin-unidad" ? "" : "sin-unidad")}
            />
            <CeldaResumen
              titulo="Deshabilitadas"
              valor={deshabilitados}
              detalle="sin acceso"
              activa={vista === "deshabilitados"}
              onToggle={() => setVista(vista === "deshabilitados" ? "" : "deshabilitados")}
            />
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 items-center gap-3 sm:flex sm:flex-wrap">
        <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar por nombre, correo o unidad..." className="w-full sm:max-w-xs" />
        <Select aria-label="Filtrar por rol" value={rol} onChange={(e) => setRol(e.target.value as Rol | "")} className="w-full sm:w-48">
          <option value="">Todos los roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROL_LABEL[r]}
            </option>
          ))}
        </Select>
        {hayFiltros && (
          <button
            type="button"
            onClick={() => {
              setBusqueda("");
              // los dos filtros de la direccion en un solo cambio: dos cambios seguidos se pisan
              setParams(
                (actuales) => {
                  const siguientes = new URLSearchParams(actuales);
                  siguientes.delete("rol");
                  siguientes.delete("vista");
                  return siguientes;
                },
                { replace: true }
              );
            }}
            className="inline-flex items-center justify-center rounded-lg text-sm font-medium text-brand-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 max-sm:min-h-11 dark:text-brand-400"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <Card plana className="overflow-hidden">
        {cargando && !usuarios ? (
          <Spinner />
        ) : error ? (
          <Alert tone="red">{error}</Alert>
        ) : !lista.length ? (
          <EmptyState icon={Users} title="Aún no hay usuarios registrados" />
        ) : !filtrados.length ? (
          <EmptyState title="Sin resultados" description="Ninguna cuenta coincide con los filtros." />
        ) : (
          <>
            <p className="border-b border-slate-100 px-5 py-3 text-xs text-slate-500 dark:border-slate-700/60 dark:text-slate-400">
              Primero residentes (los sin unidad arriba), luego conserjería y administración; al final las cuentas deshabilitadas.
            </p>

            {/* Celular y tablet: tarjetas (una columna en celular, dos desde 640 px). Desde 1280 px: tabla. */}
            <ul className="grid gap-px bg-slate-100 sm:grid-cols-2 xl:hidden dark:bg-slate-700/60">
              {filtrados.map((u) => (
                <ItemNuevo<HTMLLIElement>
                  key={u.id}
                  como="li"
                  nueva={u.id === nuevaId}
                  className="flex flex-col gap-3 bg-white px-5 py-4 dark:bg-slate-800 sm:[&:last-child:nth-child(odd)]:col-span-2"
                >
                  <div className="flex items-start gap-3">
                    <Iniciales usuario={u} />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-start justify-between gap-2">
                        {nombre(u)}
                        <EstadoCuenta usuario={u} />
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        {ROL_LABEL[u.rol]}
                        {u.rol === "RESIDENTE" && unidadDe(u) ? ` · ${unidadDe(u)}` : ""}
                      </p>
                      <p className="break-all text-sm text-slate-600 dark:text-slate-300">{u.email}</p>
                      {u.telefono && (
                        <p className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                          <Phone size={14} aria-hidden /> {u.telefono}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-auto">{acciones(u)}</div>
                </ItemNuevo>
              ))}
            </ul>

            <div className="hidden overflow-x-auto xl:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-xs uppercase text-slate-500 dark:border-slate-700/60 dark:text-slate-400">
                  <tr>
                    <th scope="col" className="px-5 py-3">Persona</th>
                    <th scope="col" className="px-5 py-3">Rol y unidad</th>
                    <th scope="col" className="px-5 py-3">Estado</th>
                    <th scope="col" className="px-5 py-3">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {filtrados.map((u) => (
                    <ItemNuevo<HTMLTableRowElement> key={u.id} como="tr" nueva={u.id === nuevaId}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Iniciales usuario={u} />
                          <div className="min-w-0">
                            {nombre(u)}
                            <span className="block break-all text-xs text-slate-500 dark:text-slate-400">
                              {u.email}
                              {u.telefono ? ` · ${u.telefono}` : ""}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-slate-600 dark:text-slate-300">
                        {ROL_LABEL[u.rol]}
                        {u.rol === "RESIDENTE" && <span className="block text-xs text-slate-500 dark:text-slate-400">{unidadDe(u) ?? "Sin unidad"}</span>}
                      </td>
                      <td className="px-5 py-3">
                        <EstadoCuenta usuario={u} />
                      </td>
                      <td className="px-5 py-3 text-right">{acciones(u)}</td>
                    </ItemNuevo>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <Modal open={creando} onClose={() => setCreando(false)} title="Registrar usuario">
        <FormularioUsuario
          departamentos={departamentos ?? []}
          onCreado={(creado) => {
            setCreando(false);
            setNuevaId(creado.id);
            recargar();
          }}
        />
      </Modal>

      <Modal open={editando !== null} onClose={() => setEditando(null)} title={editando ? `Editar a ${editando.nombre} ${editando.apellido}` : "Editar usuario"}>
        {editando && (
          <FormularioEditar
            usuario={editando}
            departamentos={departamentos ?? []}
            onGuardado={() => {
              setEditando(null);
              recargar();
            }}
          />
        )}
      </Modal>

      <Modal
        open={usuarioClave !== null}
        onClose={() => setUsuarioClave(null)}
        title={usuarioClave ? `Restablecer clave de ${usuarioClave.nombre}` : "Restablecer clave"}
      >
        {usuarioClave && <FormularioRestablecer usuario={usuarioClave} onListo={() => setUsuarioClave(null)} />}
      </Modal>
    </div>
  );
}

function SelectorUnidad({
  id,
  departamentos,
  value,
  onChange,
}: {
  id: string;
  departamentos: Departamento[];
  value: string;
  onChange: (valor: string) => void;
}) {
  const ordenados = [...departamentos].sort((a, b) =>
    unidadDe({ departamento: a })!.localeCompare(unidadDe({ departamento: b })!, "es", { numeric: true })
  );
  return (
    <div>
      <Label htmlFor={id}>Unidad</Label>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Sin asignar</option>
        {ordenados.map((d) => (
          <option key={d.id} value={d.id}>
            {unidadDe({ departamento: d })}
          </option>
        ))}
      </Select>
      {!value && (
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Sin unidad no recibe cobros de gastos comunes ni aparece con su unidad en portería.</p>
      )}
    </div>
  );
}

function FormularioUsuario({ departamentos, onCreado }: { departamentos: Departamento[]; onCreado: (usuario: Usuario) => void }) {
  const toast = useToast();
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<Rol>("RESIDENTE");
  const [departamentoId, setDepartamentoId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const creado = await usuariosApi.crear({
        nombre,
        apellido,
        email,
        password,
        rol,
        telefono: telefono.trim() || undefined,
        departamentoId: rol === "RESIDENTE" ? departamentoId || null : null,
      });
      toast.success("Usuario registrado correctamente.");
      onCreado(creado);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="campo-usuarios-1">Nombre</Label>
          <Input id="campo-usuarios-1" required autoComplete="off" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="campo-usuarios-2">Apellido</Label>
          <Input id="campo-usuarios-2" required autoComplete="off" value={apellido} onChange={(e) => setApellido(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="campo-usuarios-3">Correo electrónico</Label>
          <Input id="campo-usuarios-3" type="email" required autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="campo-usuarios-tel">Teléfono (opcional)</Label>
          <Input
            id="campo-usuarios-tel"
            type="tel"
            inputMode="tel"
            maxLength={30}
            autoComplete="off"
            placeholder="+56 9 1234 5678"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="campo-usuarios-4">Contraseña temporal</Label>
        <div className="flex gap-2">
          <Input id="campo-usuarios-4" required minLength={8} autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="button" variant="secondary" onClick={() => setPassword(generarPasswordTemporal())} className="shrink-0">
            <MagicWand size={16} aria-hidden /> Generar
          </Button>
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Entrégasela a la persona: tendrá que cambiarla la primera vez que entre.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="campo-usuarios-5">Rol</Label>
          <Select id="campo-usuarios-5" value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
            <option value="RESIDENTE">Residente</option>
            <option value="CONSERJE">Conserjería</option>
            <option value="ADMIN">Administración</option>
          </Select>
        </div>
        {rol === "RESIDENTE" && (
          <SelectorUnidad id="campo-usuarios-6" departamentos={departamentos} value={departamentoId} onChange={setDepartamentoId} />
        )}
      </div>
      {error && <Alert tone="red">{error}</Alert>}
      <Button type="submit" className="w-full" loading={cargando}>
        Registrar usuario
      </Button>
    </form>
  );
}

// Corregir el nombre, el telefono o la unidad (por ejemplo, un residente que se cambio de departamento).
// El correo y el rol no se cambian: son la identidad de la cuenta.
function FormularioEditar({
  usuario,
  departamentos,
  onGuardado,
}: {
  usuario: Usuario;
  departamentos: Departamento[];
  onGuardado: () => void;
}) {
  const toast = useToast();
  const [nombre, setNombre] = useState(usuario.nombre);
  const [apellido, setApellido] = useState(usuario.apellido);
  const [telefono, setTelefono] = useState(usuario.telefono ?? "");
  const [departamentoId, setDepartamentoId] = useState(usuario.departamento?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      await usuariosApi.actualizar(usuario.id, {
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        telefono: telefono.trim() || null,
        ...(usuario.rol === "RESIDENTE" ? { departamentoId: departamentoId || null } : {}),
      });
      toast.success("Datos actualizados.");
      onGuardado();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-700 dark:bg-slate-900/40 dark:text-slate-200">
        <span className="font-medium">{ROL_LABEL[usuario.rol]}</span> · <span className="break-all">{usuario.email}</span>
        <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">El correo y el rol no se pueden cambiar.</span>
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="campo-editar-nombre">Nombre</Label>
          <Input id="campo-editar-nombre" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="campo-editar-apellido">Apellido</Label>
          <Input id="campo-editar-apellido" required value={apellido} onChange={(e) => setApellido(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="campo-editar-telefono">Teléfono (opcional)</Label>
          <Input
            id="campo-editar-telefono"
            type="tel"
            inputMode="tel"
            maxLength={30}
            placeholder="+56 9 1234 5678"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
          />
        </div>
        {usuario.rol === "RESIDENTE" && (
          <SelectorUnidad id="campo-editar-unidad" departamentos={departamentos} value={departamentoId} onChange={setDepartamentoId} />
        )}
      </div>
      {error && <Alert tone="red">{error}</Alert>}
      <Button type="submit" className="w-full" loading={cargando}>
        Guardar cambios
      </Button>
    </form>
  );
}

function FormularioRestablecer({ usuario, onListo }: { usuario: Usuario; onListo: () => void }) {
  const toast = useToast();
  const [password, setPassword] = useState(() => generarPasswordTemporal());
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [entregada, setEntregada] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      await usuariosApi.restablecerPassword(usuario.id, password);
      setEntregada(password);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(entregada ?? "");
      toast.success("Contraseña copiada.");
    } catch {
      toast.error("No se pudo copiar; anótala a mano.");
    }
  }

  if (entregada) {
    return (
      <div className="space-y-4">
        <Alert tone="green">La contraseña de {usuario.nombre} quedó restablecida.</Alert>
        <div>
          <p className="text-sm text-slate-600 dark:text-slate-300">Entrégale esta contraseña temporal:</p>
          <p className="mt-2 select-all break-all rounded-lg bg-slate-100 px-4 py-3 text-center font-mono text-xl tracking-wider text-slate-900 dark:bg-slate-900 dark:text-white">
            {entregada}
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            No se vuelve a mostrar. Al entrar con ella, el sistema le pedirá elegir una contraseña propia.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={copiar} className="flex-1">
            <Copy size={16} aria-hidden /> Copiar
          </Button>
          <Button type="button" onClick={onListo} className="flex-1">
            Listo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Define una contraseña temporal para {usuario.nombre} {usuario.apellido}. La anterior dejará de funcionar y tendrá que elegir una
        propia al entrar.
      </p>
      <div>
        <Label htmlFor="campo-restablecer-password">Contraseña temporal</Label>
        <div className="flex gap-2">
          <Input id="campo-restablecer-password" required minLength={8} autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="button" variant="secondary" onClick={() => setPassword(generarPasswordTemporal())} className="shrink-0">
            <MagicWand size={16} aria-hidden /> Generar
          </Button>
        </div>
      </div>
      {error && <Alert tone="red">{error}</Alert>}
      <Button type="submit" className="w-full" loading={cargando}>
        Restablecer contraseña
      </Button>
    </form>
  );
}
