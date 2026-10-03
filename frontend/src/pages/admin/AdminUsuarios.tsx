import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { UserPlus, Users } from "@phosphor-icons/react";
import { condominioApi, usuariosApi } from "../../api/endpoints";
import { useAsync } from "../../hooks/useAsync";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Input, Label, Modal, PageHeader, SearchInput, Select, Spinner, staggerFade } from "../../components/ui";
import { mensajeError } from "../../api/client";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";
import type { Rol } from "../../types";

const ROL_LABEL: Record<Rol, string> = { ADMIN: "Administrador", RESIDENTE: "Residente", CONSERJE: "Conserje" };

export default function AdminUsuarios() {
  const toast = useToast();
  const confirmar = useConfirm();
  const { data: usuarios, cargando, error, recargar } = useAsync(() => usuariosApi.listar(), []);
  const { data: departamentos } = useAsync(() => condominioApi.listarDepartamentos(), []);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroRol, setFiltroRol] = useState<Rol | "">("");

  const filtrados = (usuarios ?? []).filter((u) => {
    const coincideTexto =
      !busqueda ||
      `${u.nombre} ${u.apellido} ${u.email}`.toLowerCase().includes(busqueda.toLowerCase());
    const coincideRol = !filtroRol || u.rol === filtroRol;
    return coincideTexto && coincideRol;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Users}
        title="Residentes y usuarios"
        subtitle="Registro y administración de residentes (HU-02)."
        action={
          <Button onClick={() => setModalAbierto(true)}>
            <UserPlus size={16} weight="bold" /> Nuevo usuario
          </Button>
        }
      />

      <div className="flex flex-wrap gap-3">
        <SearchInput
          value={busqueda}
          onChange={setBusqueda}
          placeholder="Buscar por nombre o correo..."
          className="w-full sm:max-w-xs"
        />
        <Select aria-label="Filtrar por rol" value={filtroRol} onChange={(e) => setFiltroRol(e.target.value as Rol | "")} className="w-full sm:w-48">
          <option value="">Todos los roles</option>
          <option value="ADMIN">Administrador</option>
          <option value="RESIDENTE">Residente</option>
          <option value="CONSERJE">Conserje</option>
        </Select>
      </div>

      <Card>
        {cargando ? (
          <Spinner />
        ) : error ? (
          <Alert tone="red">{error}</Alert>
        ) : !usuarios?.length ? (
          <EmptyState title="Aún no hay usuarios registrados" />
        ) : !filtrados.length ? (
          <EmptyState title="Sin resultados" description="Ningún usuario coincide con la búsqueda." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 dark:border-slate-700/60 text-xs uppercase text-slate-400 dark:text-slate-500">
                <tr>
                  <th className="px-5 py-3">Nombre</th>
                  <th className="px-5 py-3">Correo</th>
                  <th className="px-5 py-3">Rol</th>
                  <th className="px-5 py-3">Unidad</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {filtrados.map((u, i) => (
                  <motion.tr key={u.id} {...staggerFade(i)} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-700/60">
                    <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-100">
                      {u.nombre} {u.apellido}
                    </td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{u.email}</td>
                    <td className="px-5 py-3">
                      <Badge tone="blue">{ROL_LABEL[u.rol]}</Badge>
                    </td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                      {u.departamento ? `${u.departamento.torre?.nombre ?? ""} ${u.departamento.numero}` : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={u.activo ? "green" : "slate"}>{u.activo ? "Activo" : "Deshabilitado"}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          if (u.activo) {
                            const ok = await confirmar(
                              `¿Deshabilitar a ${u.nombre} ${u.apellido}? No podrá iniciar sesión hasta que lo vuelvas a habilitar.`,
                              { titulo: "Deshabilitar usuario", textoConfirmar: "Deshabilitar" }
                            );
                            if (!ok) return;
                          }
                          await usuariosApi.actualizar(u.id, { activo: !u.activo });
                          toast.success(u.activo ? "Usuario deshabilitado." : "Usuario habilitado.");
                          recargar();
                        }}
                      >
                        {u.activo ? "Deshabilitar" : "Habilitar"}
                      </Button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modalAbierto} onClose={() => setModalAbierto(false)} title="Registrar usuario">
        <FormularioUsuario
          departamentos={departamentos ?? []}
          onCreado={() => {
            setModalAbierto(false);
            recargar();
          }}
        />
      </Modal>
    </div>
  );
}

function FormularioUsuario({
  departamentos,
  onCreado,
}: {
  departamentos: { id: string; numero: string; torre: { nombre: string } | null }[];
  onCreado: () => void;
}) {
  const toast = useToast();
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [email, setEmail] = useState("");
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
      await usuariosApi.crear({
        nombre,
        apellido,
        email,
        password,
        rol,
        departamentoId: rol === "RESIDENTE" ? departamentoId || null : null,
      });
      toast.success("Usuario registrado correctamente.");
      onCreado();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="campo-usuarios-1">Nombre</Label>
          <Input id="campo-usuarios-1" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="campo-usuarios-2">Apellido</Label>
          <Input id="campo-usuarios-2" required value={apellido} onChange={(e) => setApellido(e.target.value)} />
        </div>
      </div>
      <div>
        <Label htmlFor="campo-usuarios-3">Correo electrónico</Label>
        <Input id="campo-usuarios-3" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="campo-usuarios-4">Contraseña temporal</Label>
        <Input id="campo-usuarios-4" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="campo-usuarios-5">Rol</Label>
        <Select id="campo-usuarios-5" value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
          <option value="RESIDENTE">Residente</option>
          <option value="CONSERJE">Conserje</option>
          <option value="ADMIN">Administrador</option>
        </Select>
      </div>
      {rol === "RESIDENTE" && (
        <div>
          <Label htmlFor="campo-usuarios-6">Unidad</Label>
          <Select id="campo-usuarios-6" value={departamentoId} onChange={(e) => setDepartamentoId(e.target.value)}>
            <option value="">Sin asignar</option>
            {departamentos.map((d) => (
              <option key={d.id} value={d.id}>
                {d.torre?.nombre ?? ""} {d.numero}
              </option>
            ))}
          </Select>
        </div>
      )}
      {error && <Alert tone="red">{error}</Alert>}
      <Button type="submit" className="w-full" loading={cargando}>
        Registrar usuario
      </Button>
    </form>
  );
}
