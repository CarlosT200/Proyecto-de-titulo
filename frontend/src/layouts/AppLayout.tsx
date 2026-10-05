import { ReactNode, useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { Bell, Buildings, List, Moon, SignOut, Sun, Trash, UserCircle, X } from "@phosphor-icons/react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useConfirm } from "../context/ConfirmContext";
import { notificacionesApi } from "../api/endpoints";
import { NOTIFICACION_SOS_CLASE } from "../lib/badges";
import { BotonSOS } from "../components/BotonSOS";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { PieDePagina } from "../components/PieDePagina";
import { desactivarPush } from "../lib/push";
import type { Notificacion } from "../types";

export interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

const ROL_LABEL: Record<string, string> = {
  ADMIN: "Administrador",
  RESIDENTE: "Residente",
  CONSERJE: "Conserje",
};

// A donde redirigir segun el tipo de entidad de la notificacion. Las rutas
// son las mismas para admin y residente (cada uno tiene su propia pagina
// montada en ese path dentro de su AppLayout); si el rol actual no tiene esa
// seccion (ej. conserje), el catch-all "*" del router lo manda a su inicio.
const RUTA_POR_ENTIDAD: Record<string, string> = {
  Incidencia: "/incidencias",
  Multa: "/multas",
  Encomienda: "/encomiendas",
  Comunicado: "/comunicados",
  AlertaSos: "/alertas-sos",
};

export function AppLayout({ nav, children }: { nav: NavItem[]; children: ReactNode }) {
  const { usuario, logout } = useAuth();
  const { tema, setTema } = useTheme();
  const confirmar = useConfirm();
  const navigate = useNavigate();
  const location = useLocation();
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
  // Menu lateral en escritorio: el residente parte con el oculto (su inicio ya
  // tiene accesos rapidos grandes y ver ~9 opciones de entrada lo abrumaba);
  // admin y conserje lo usan para todo, asi que parten con el visible.
  const [sidebarAbierto, setSidebarAbierto] = useState(() => usuario?.rol !== "RESIDENTE");
  const [esEscritorio, setEsEscritorio] = useState(() => window.matchMedia("(min-width: 1024px)").matches);

  useEffect(() => {
    const consulta = window.matchMedia("(min-width: 1024px)");
    const alCambiar = () => setEsEscritorio(consulta.matches);
    consulta.addEventListener("change", alCambiar);
    return () => consulta.removeEventListener("change", alCambiar);
  }, []);

  const menuVisible = esEscritorio ? sidebarAbierto : menuMovilAbierto;

  function alternarMenu() {
    if (esEscritorio) setSidebarAbierto((v) => !v);
    else setMenuMovilAbierto(true);
  }
  const panelRef = useRef<HTMLDivElement>(null);
  const cerrarMenuRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuMovilAbierto) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuMovilAbierto(false);
    };
    document.addEventListener("keydown", alTeclear);
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // un instante despues: mientras empieza la transicion de visibility el boton aun no es enfocable
    const enfoque = window.setTimeout(() => cerrarMenuRef.current?.focus(), 30);
    return () => {
      window.clearTimeout(enfoque);
      document.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = overflowPrevio;
    };
  }, [menuMovilAbierto]);

  useEffect(() => {
    if (esEscritorio) setMenuMovilAbierto(false);
  }, [esEscritorio]);

  useEffect(() => {
    if (!panelAbierto) return;
    function alClickearFuera(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelAbierto(false);
      }
    }
    document.addEventListener("mousedown", alClickearFuera);
    return () => document.removeEventListener("mousedown", alClickearFuera);
  }, [panelAbierto]);

  useEffect(() => {
    let activo = true;
    function cargar() {
      notificacionesApi.listar().then((data) => {
        if (activo) setNotificaciones(data);
      }).catch(() => {});
    }
    cargar();
    const intervalo = setInterval(cargar, 30000);
    return () => {
      activo = false;
      clearInterval(intervalo);
    };
  }, []);

  const noLeidas = notificaciones.filter((n) => !n.leida).length;

  async function handleLogout() {
    // La suscripcion push queda ligada al navegador, no a la sesion: sin esto,
    // en un equipo compartido (ej. el computador de conserjeria) la siguiente
    // persona seguiria recibiendo las notificaciones de la cuenta anterior.
    // Tiene que ir antes de logout(): borrarla en el backend necesita el token.
    // Con tope de tiempo para que una red lenta nunca bloquee el cierre de sesion.
    await Promise.race([desactivarPush().catch(() => {}), new Promise((r) => setTimeout(r, 2000))]);
    logout();
    navigate("/login");
  }

  function abrirNotificacion(n: Notificacion) {
    if (!n.leida) {
      notificacionesApi.leer(n.id).catch(() => {});
      setNotificaciones((prev) => prev.map((item) => (item.id === n.id ? { ...item, leida: true } : item)));
    }
    setPanelAbierto(false);
    const ruta = n.entidadTipo ? RUTA_POR_ENTIDAD[n.entidadTipo] : undefined;
    if (ruta) navigate(ruta);
  }

  function eliminarNotificacion(id: string) {
    setNotificaciones((prev) => prev.filter((item) => item.id !== id));
    notificacionesApi.eliminar(id).catch(() => {});
  }

  async function eliminarTodasNotificaciones() {
    const ok = await confirmar("¿Borrar todas las notificaciones? Esta acción no se puede deshacer.", {
      titulo: "Borrar notificaciones",
      textoConfirmar: "Borrar todas",
    });
    if (!ok) return;
    setNotificaciones([]);
    notificacionesApi.eliminarTodas().catch(() => {});
  }

  return (
    <div className="relative isolate flex min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Fondo ambiental: brillos de marca difusos (mismo lenguaje que la credencial y el
          login). Estatico a proposito -- animar blur de este tamaño cuesta en celulares. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(closest-side,rgb(96_165_250/0.3),transparent)] dark:bg-[radial-gradient(closest-side,rgb(37_99_235/0.3),transparent)]" />
        <div className="absolute -right-40 top-1/4 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(closest-side,rgb(251_146_60/0.22),transparent)] dark:bg-[radial-gradient(closest-side,rgb(234_88_12/0.16),transparent)]" />
        <div className="absolute -bottom-40 left-1/3 h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(closest-side,rgb(167_139_250/0.15),transparent)] dark:bg-[radial-gradient(closest-side,rgb(124_58_237/0.15),transparent)]" />
        <div
          className="absolute inset-0 opacity-[0.35] dark:opacity-[0.25]"
          style={{
            backgroundImage: "radial-gradient(rgba(100,116,139,0.18) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
      </div>

      {/* Sidebar desktop (fijo: el menu queda a mano aunque la pagina sea larga).
          Se anima el ancho del contenedor; el contenido interno mantiene w-64 para
          no reacomodarse letra por letra durante la animacion. */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarAbierto ? 256 : 0 }}
        transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
        aria-hidden={!sidebarAbierto}
        className={clsx(
          "sticky top-0 hidden h-screen shrink-0 overflow-hidden bg-white/80 backdrop-blur-xl lg:block dark:bg-slate-900/80",
          sidebarAbierto && "border-r border-slate-200/70 dark:border-white/[0.06]"
        )}
      >
        {/* invisible al cerrar (sus links no quedan tabulables); la transicion de
            visibility hace que se oculte recien al terminar la animacion de ancho. */}
        <div className={clsx("flex h-full w-64 flex-col transition-[visibility] duration-300", !sidebarAbierto && "invisible")}>
          <SidebarContent nav={nav} usuario={usuario} />
        </div>
      </motion.aside>

      {/* Sidebar movil: siempre montado y animado solo con CSS (transform/opacity).
          "invisible" al cerrar: sus links no quedan tabulables y no recibe toques. */}
      <div
        className={clsx("fixed inset-0 z-40 transition-[visibility] duration-200 lg:hidden", !menuMovilAbierto && "invisible")}
        aria-hidden={!menuMovilAbierto}
      >
        <div
          onClick={() => setMenuMovilAbierto(false)}
          className={clsx(
            "absolute inset-0 bg-slate-900/50 transition-opacity duration-200 dark:bg-black/60",
            menuMovilAbierto ? "opacity-100" : "opacity-0"
          )}
        />
        <aside
          className={clsx(
            "relative flex h-full w-64 flex-col bg-white shadow-xl transition-transform duration-200 ease-out will-change-transform dark:bg-slate-900",
            menuMovilAbierto ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <button
            ref={cerrarMenuRef}
            className="absolute right-3 top-3 rounded-lg p-1.5 max-sm:p-3 text-slate-400 hover:bg-slate-100 dark:text-slate-500 dark:hover:bg-slate-800"
            onClick={() => setMenuMovilAbierto(false)}
            aria-label="Cerrar menú"
          >
            <X size={18} />
          </button>
          <SidebarContent nav={nav} usuario={usuario} onNavigate={() => setMenuMovilAbierto(false)} animarPildora={false} />
        </aside>
      </div>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200/70 bg-white/95 px-4 py-3 lg:bg-white/80 lg:px-8 lg:backdrop-blur-xl dark:border-white/[0.06] dark:bg-slate-900/95 dark:lg:bg-slate-900/80">
          <div className="flex items-center gap-2">
            <button
              className="flex h-10 w-10 max-sm:h-11 max-sm:w-11 max-[359px]:h-10 max-[359px]:w-10 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              onClick={alternarMenu}
              aria-label={menuVisible ? "Ocultar menú" : "Mostrar menú"}
              aria-expanded={menuVisible}
              title={menuVisible ? "Ocultar menú" : "Mostrar menú"}
            >
              <List size={22} weight="bold" />
            </button>
            {/* Logo en el header cuando el menu lateral no esta a la vista (celular, o
                escritorio con el menu oculto) -- si no, la marca desaparece por completo. */}
            <Link
              to="/"
              className={clsx("hidden items-center gap-2 sm:flex", sidebarAbierto && "lg:hidden")}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md shadow-brand-600/30">
                <Buildings size={17} weight="fill" />
              </span>
              <span className="font-display text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                Habita<span className="text-brand-600 dark:text-brand-400">Smart</span>
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-1 min-[360px]:gap-2 sm:gap-4">
            <div className="flex items-center gap-0.5 rounded-full border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setTema("claro")}
                aria-label="Modo claro"
                aria-pressed={tema === "claro"}
                title="Modo claro"
                className={clsx(
                  "flex h-9 w-9 max-sm:h-11 max-sm:w-11 max-[359px]:h-9 max-[359px]:w-9 items-center justify-center rounded-full transition-colors",
                  tema === "claro"
                    ? "bg-white text-amber-500 shadow-sm dark:bg-slate-700"
                    : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                )}
              >
                <Sun size={19} weight={tema === "claro" ? "fill" : "regular"} />
              </button>
              <button
                type="button"
                onClick={() => setTema("oscuro")}
                aria-label="Modo oscuro"
                aria-pressed={tema === "oscuro"}
                title="Modo oscuro"
                className={clsx(
                  "flex h-9 w-9 max-sm:h-11 max-sm:w-11 max-[359px]:h-9 max-[359px]:w-9 items-center justify-center rounded-full transition-colors",
                  tema === "oscuro"
                    ? "bg-white text-brand-600 shadow-sm dark:bg-slate-700 dark:text-brand-300"
                    : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                )}
              >
                <Moon size={19} weight={tema === "oscuro" ? "fill" : "regular"} />
              </button>
            </div>
            <div className="sm:relative" ref={panelRef}>
              <button
                className="relative rounded-lg p-2 max-sm:p-3 max-[359px]:p-2.5 text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                onClick={() => setPanelAbierto((v) => !v)}
                aria-label="Notificaciones"
              >
                <motion.span
                  className="block"
                  animate={noLeidas > 0 ? { rotate: [0, -12, 10, -6, 0] } : {}}
                  transition={{ duration: 0.6, repeat: noLeidas > 0 ? Infinity : 0, repeatDelay: 3 }}
                >
                  <Bell size={20} weight={noLeidas > 0 ? "fill" : "regular"} className={noLeidas > 0 ? "text-accent-500" : undefined} />
                </motion.span>
                {noLeidas > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-900">
                    {noLeidas > 9 ? "9+" : noLeidas}
                  </span>
                )}
              </button>
              <AnimatePresence>
                {panelAbierto && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute inset-x-3 top-full z-30 mt-2 rounded-xl border border-slate-200 bg-white shadow-lg sm:inset-x-auto sm:right-0 sm:top-auto sm:w-80 dark:border-slate-700 dark:bg-slate-800"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-700/60">
                      <span className="text-sm font-semibold dark:text-white">Notificaciones</span>
                      <div className="flex items-center gap-3">
                        {noLeidas > 0 && (
                          <button
                            className="text-xs text-brand-600 hover:underline dark:text-brand-400 max-sm:min-h-11"
                            onClick={() => {
                              notificacionesApi.leerTodas().then(() =>
                                setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })))
                              );
                            }}
                          >
                            Marcar todas como leídas
                          </button>
                        )}
                        {notificaciones.length > 0 && (
                          <button className="text-xs text-slate-500 hover:underline dark:text-slate-400 max-sm:min-h-11" onClick={eliminarTodasNotificaciones}>
                            Borrar todas
                          </button>
                        )}
                        <button
                          onClick={() => setPanelAbierto(false)}
                          className="rounded-lg p-1 max-sm:p-3 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                          aria-label="Cerrar notificaciones"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="max-h-[min(20rem,calc(100dvh-9rem))] overflow-y-auto">
                      {notificaciones.length === 0 ? (
                        <p className="px-4 py-6 text-center text-xs text-slate-400 dark:text-slate-500">Sin notificaciones.</p>
                      ) : (
                        notificaciones.map((n) => {
                          const clicable = Boolean(n.entidadTipo && RUTA_POR_ENTIDAD[n.entidadTipo]);
                          const sos = NOTIFICACION_SOS_CLASE[n.tipo];
                          return (
                            <div
                              key={n.id}
                              className={clsx(
                                "relative border-b border-slate-50 text-sm dark:border-slate-700/40",
                                sos ? sos.caja : !n.leida && "bg-brand-50/60 dark:bg-brand-500/10"
                              )}
                            >
                              <button
                                type="button"
                                onClick={() => abrirNotificacion(n)}
                                disabled={!clicable}
                                className={clsx(
                                  "block w-full px-4 py-3 pr-10 max-sm:pr-14 text-left transition-colors",
                                  clicable && (sos ? "cursor-pointer" : "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40")
                                )}
                              >
                                <p className={clsx("font-medium", sos ? sos.titulo : "text-slate-800 dark:text-slate-100")}>{n.titulo}</p>
                                <p className={clsx("mt-0.5 text-xs", sos ? sos.mensaje : "text-slate-500 dark:text-slate-400")}>{n.mensaje}</p>
                              </button>
                              <button
                                type="button"
                                onClick={() => eliminarNotificacion(n.id)}
                                className={clsx(
                                  "absolute right-1 top-1.5 rounded-lg p-1.5 max-sm:p-3.5 transition-colors hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-500/20 dark:hover:text-red-400",
                                  sos ? sos.titulo : "text-slate-400 dark:text-slate-500"
                                )}
                                aria-label="Eliminar notificación"
                                title="Eliminar notificación"
                              >
                                <Trash size={14} />
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {/* En celular solo se ve el circulo de la foto (el nombre no cabe junto a "Salir"). */}
            <Link
              to="/perfil"
              aria-label="Mi perfil"
              title="Mi perfil"
              className="flex items-center gap-2.5 rounded-full p-0.5 max-sm:p-1 max-[359px]:p-0.5 transition-colors hover:bg-slate-50 sm:rounded-lg sm:px-2 sm:py-1 dark:hover:bg-slate-800"
            >
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                  {usuario?.nombre} {usuario?.apellido}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{usuario && ROL_LABEL[usuario.rol]}</p>
              </div>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-700">
                {usuario?.fotoUrl ? (
                  <img src={usuario.fotoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <UserCircle size={20} className="text-slate-400 dark:text-slate-500" />
                )}
              </div>
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 max-sm:min-h-11 max-[359px]:px-2 text-xs font-medium text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-slate-600 dark:text-slate-300 dark:hover:border-red-500/40 dark:hover:bg-red-500/10 dark:hover:text-red-400"
            >
              <SignOut size={14} />
              Salir
            </button>
          </div>
        </header>
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          // Residentes: el boton flotante de SOS ocupa los ultimos 88px de la
          // pantalla (bottom-6 + 64px). Footer (pt-6 + texto) + pb-12/14 suman
          // >= 88px, asi el ultimo contenido queda siempre por encima del boton.
          className={clsx("flex-1 p-4 lg:p-8", usuario?.rol === "RESIDENTE" && "pb-12 lg:pb-14")}
        >
          <ErrorBoundary resetKey={location.pathname}>{children}</ErrorBoundary>
          {/* Pegado al contenido (antes mt-auto lo mandaba al fondo de la pantalla y
              quedaban cientos de px vacios en paginas cortas). En celular, para
              residentes, pr-20 lo corre a la izquierda del boton SOS. */}
          <PieDePagina className={clsx("pt-6", usuario?.rol === "RESIDENTE" && "pr-20 sm:pr-0")} />
        </motion.main>
      </div>

      {usuario?.rol === "RESIDENTE" && <BotonSOS />}
    </div>
  );
}

function SidebarContent({
  nav,
  usuario,
  onNavigate,
  animarPildora = true,
}: {
  nav: NavItem[];
  usuario: ReturnType<typeof useAuth>["usuario"];
  onNavigate?: () => void;
  animarPildora?: boolean;
}) {
  return (
    <>
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-5 dark:border-white/[0.06]">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-600/30 ring-1 ring-white/20">
          <Buildings size={20} weight="fill" />
        </div>
        <div className="min-w-0">
          <p className="font-display text-base font-bold leading-none tracking-tight text-slate-900 dark:text-white">
            Habita<span className="text-brand-600 dark:text-brand-400">Smart</span>
          </p>
          <p className="mt-1 truncate text-[11px] text-slate-400 dark:text-slate-500">
            {usuario?.condominio?.nombre ?? "Gestión de condominios"}
          </p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            onClick={onNavigate}
            className={({ isActive }) =>
              clsx(
                "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "text-white"
                  : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.05] dark:hover:text-white"
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  // Oscuro a la izquierda (donde va el texto) para que el blanco
                  // mantenga contraste AA; el degrade aclara hacia la derecha.
                  (animarPildora ? (
                    <motion.div
                      layoutId="nav-active-pill"
                      className="absolute inset-0 rounded-xl bg-gradient-to-r from-brand-700 via-brand-600 to-brand-500 shadow-lg shadow-brand-600/30"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  ) : (
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-brand-700 via-brand-600 to-brand-500 shadow-lg shadow-brand-600/30" />
                  ))
                )}
                <span className="relative z-10">{item.icon}</span>
                <span className="relative z-10">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-100 p-3 dark:border-white/[0.06]">
        <NavLink
          to="/perfil"
          onClick={onNavigate}
          className={({ isActive }) =>
            clsx(
              "flex items-center gap-3 rounded-xl p-2 transition-colors",
              isActive
                ? "bg-brand-50 ring-1 ring-brand-200 dark:bg-brand-500/15 dark:ring-brand-500/30"
                : "hover:bg-slate-100/80 dark:hover:bg-white/[0.05]"
            )
          }
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 ring-2 ring-white shadow-sm dark:bg-slate-700 dark:ring-slate-800">
            {usuario?.fotoUrl ? (
              <img src={usuario.fotoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <UserCircle size={22} className="text-slate-400 dark:text-slate-500" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
              {usuario?.nombre} {usuario?.apellido}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Mi perfil</p>
          </div>
        </NavLink>
      </div>
    </>
  );
}
