import { FormEvent, useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import clsx from "clsx";
import {
  Buildings,
  CalendarCheck,
  ChartBar,
  Envelope,
  Eye,
  EyeSlash,
  House,
  Icon as PhosphorIcon,
  Key,
  LockKey,
  Package,
  QrCode,
  ShieldCheck,
  Siren,
  WarningCircle,
} from "@phosphor-icons/react";
import { useAuth } from "../context/AuthContext";
import { api, mensajeError } from "../api/client";
import { Button } from "../components/ui";
import { SkylineBackground } from "../components/SkylineBackground";
import { PieDePagina } from "../components/PieDePagina";

const CARACTERISTICAS: { icon: PhosphorIcon; titulo: string; texto: string; tono: string }[] = [
  { icon: QrCode, titulo: "Acceso con QR", texto: "Credencial y visitas", tono: "from-brand-500 to-brand-700" },
  { icon: Siren, titulo: "Botón SOS", texto: "Ayuda inmediata 24/7", tono: "from-red-500 to-rose-600" },
  { icon: Package, titulo: "Encomiendas", texto: "Aviso apenas llegan", tono: "from-violet-500 to-purple-700" },
  { icon: CalendarCheck, titulo: "Reservas", texto: "Quincho, salas y más", tono: "from-emerald-400 to-emerald-600" },
];

// Cuentas del seed (ver backend/prisma/seed.ts). Un toque completa y entra:
// util para la demo/defensa sin tener que dictar correos.
const CUENTAS_DEMO: { rol: string; email: string; icon: PhosphorIcon }[] = [
  { rol: "Residente", email: "residente@habitasmart.cl", icon: House },
  { rol: "Conserje", email: "conserje@habitasmart.cl", icon: Key },
  { rol: "Admin", email: "admin@habitasmart.cl", icon: ChartBar },
];
const PASSWORD_DEMO = "Habita2026!";

// 16px en celular: con menos, Safari de iPhone hace zoom al enfocar el campo.
const CAMPO =
  "campo-login w-full rounded-xl border border-white/15 bg-white/[0.06] py-3 pl-11 text-base text-white placeholder:text-slate-400 transition focus:border-brand-400 focus:bg-white/10 focus:outline-none focus:ring-4 focus:ring-brand-500/25 sm:text-sm";

function Wordmark({ claro = false }: { claro?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-900/40 ring-1 ring-white/25">
        <Buildings size={26} weight="fill" />
      </div>
      <p className={clsx("font-display text-2xl font-bold tracking-tight", claro ? "text-white" : "text-slate-900")}>
        Habita<span className={claro ? "text-accent-300" : "text-brand-600"}>Smart</span>
      </p>
    </div>
  );
}

export default function Login() {
  const { usuario, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Si el conserje abrio un QR con la camara del celular y su sesion habia vencido, despues
  // de iniciar sesion vuelve a ese QR en vez de caer en el inicio.
  const volverA = (location.state as { volverA?: string } | null)?.volverA;
  const destino = volverA?.startsWith("/acceso/") ? volverA : "/";
  // El servidor decide si se muestran las cuentas de demostracion (ocultas en produccion).
  const [cuentasDemo, setCuentasDemo] = useState(false);
  useEffect(() => {
    api
      .get<{ cuentasDemo: boolean }>("/config")
      .then((r) => setCuentasDemo(r.data.cuentasDemo))
      .catch(() => setCuentasDemo(false));
  }, []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verPassword, setVerPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  if (usuario) {
    return <Navigate to={destino} replace />;
  }

  async function entrar(correo: string, clave: string) {
    setError(null);
    setCargando(true);
    try {
      await login(correo, clave);
      navigate(destino);
    } catch (err) {
      setError(mensajeError(err, "Correo o contraseña incorrectos."));
    } finally {
      setCargando(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    entrar(email, password);
  }

  function entrarComo(correo: string) {
    setEmail(correo);
    setPassword(PASSWORD_DEMO);
    entrar(correo, PASSWORD_DEMO);
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      <SkylineBackground />

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
        <div className="grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
          {/* Columna de marca (escritorio) */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative isolate hidden text-white lg:block"
          >
            {/* Velo oscuro difuso detras del texto: sin el, las ventanas iluminadas del fondo
                quedan justo detras de algunas palabras y parecen resaltadas. */}
            <div aria-hidden className="pointer-events-none absolute -inset-x-12 -inset-y-10 -z-10 rounded-[3rem] bg-slate-950/75 blur-3xl" />
            <Wordmark claro />
            <h1 className="mt-8 font-display text-5xl font-bold leading-[1.1] tracking-tight [text-shadow:0_2px_24px_rgba(0,0,0,0.45)]">
              Tu condominio,
              <br />
              <span className="bg-gradient-to-r from-accent-300 via-amber-200 to-white bg-clip-text text-transparent">
                en la palma de tu mano.
              </span>
            </h1>
            <p className="mt-4 max-w-md text-base text-white/85 [text-shadow:0_1px_12px_rgba(0,0,0,0.7)]">
              Comunicados, reservas, encomiendas, multas y control de acceso por QR. Todo en un solo lugar, para
              residentes, conserjería y administración.
            </p>

            <div className="mt-8 grid max-w-lg grid-cols-2 gap-3">
              {CARACTERISTICAS.map((c, i) => (
                <motion.div
                  key={c.titulo}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.25 + i * 0.08 }}
                  className="flex items-center gap-3 rounded-2xl bg-slate-950/40 p-3 ring-1 ring-white/15 backdrop-blur-md"
                >
                  <div
                    className={clsx(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg",
                      c.tono
                    )}
                  >
                    <c.icon size={20} weight="fill" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{c.titulo}</p>
                    <p className="truncate text-xs text-white/70">{c.texto}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-8 flex items-center gap-2 text-sm text-white/80 [text-shadow:0_1px_12px_rgba(0,0,0,0.7)]">
              <ShieldCheck size={18} weight="fill" className="text-accent-300" />
              Acceso seguro por roles y trazabilidad completa
            </div>
          </motion.div>

          <div className="mx-auto w-full max-w-md">
            {/* Marca sobre el cielo (celular) */}
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="mb-6 flex flex-col items-center text-center text-white lg:hidden"
            >
              <Wordmark claro />
              <p className="mt-3 text-base font-medium text-white/90 [text-shadow:0_1px_12px_rgba(0,0,0,0.5)]">
                Tu condominio, en la palma de tu mano.
              </p>
              {/* Lo que ofrece, tambien en el celular (en escritorio esta en la columna de marca). */}
              <ul className="mt-5 grid w-full grid-cols-4 gap-2" aria-label="Funciones principales">
                {CARACTERISTICAS.map((c) => (
                  <li key={c.titulo} className="flex flex-col items-center gap-1.5 rounded-2xl bg-slate-950/45 px-1 py-2.5 ring-1 ring-white/15 backdrop-blur-md">
                    <span className={clsx("flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg", c.tono)}>
                      <c.icon size={18} weight="fill" aria-hidden />
                    </span>
                    <span className="text-[11px] font-semibold leading-tight text-white">{c.titulo}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Tarjeta de login — vidrio oscuro: panel esmerilado sobre la ciudad al atardecer */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
              className="login-card relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 shadow-[0_35px_70px_-20px_rgba(2,6,23,0.8)] backdrop-blur-2xl"
            >
              {/* Filo superior en degradé de marca (azul -> naranja): la firma llamativa del panel */}
              <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brand-500 via-brand-400 to-accent-500" />
              {/* Reflejo fino del borde del vidrio */}
              <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[3px] h-px bg-white/15" />
              {/* Brillo cálido del atardecer que se cuela por el vidrio, arriba a la derecha */}
              <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(249,115,22,0.38),transparent_70%)] blur-2xl" />
              {/* Halo azul suave abajo a la izquierda, para que el vidrio no se vea plano */}
              <div aria-hidden className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(37,99,235,0.3),transparent_70%)] blur-2xl" />

              <div className="relative p-7 sm:p-8">
                <div className="flex items-center gap-3.5">
                  <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-900/50 ring-1 ring-white/20">
                    <Buildings size={24} weight="fill" />
                    <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-accent-500 ring-2 ring-slate-900" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-display text-2xl font-bold leading-tight tracking-tight text-white">Te damos la bienvenida</h2>
                    <p className="mt-0.5 text-sm text-slate-300">Ingresa con tu correo y contraseña.</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  <div>
                    <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-300">
                      Correo electrónico
                    </label>
                    <div className="relative">
                      <Envelope size={20} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        id="email"
                        type="email"
                        inputMode="email"
                        autoComplete="username"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="tu@correo.cl"
                        className={clsx(CAMPO, "pr-3")}
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-300">
                      Contraseña
                    </label>
                    <div className="relative">
                      <LockKey size={20} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        id="password"
                        type={verPassword ? "text" : "password"}
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className={clsx(CAMPO, "pr-12")}
                      />
                      <button
                        type="button"
                        onClick={() => setVerPassword((v) => !v)}
                        aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                        aria-pressed={verPassword}
                        className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                      >
                        {verPassword ? <EyeSlash size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <motion.div
                      role="alert"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-500/15 px-3 py-2.5 text-sm text-red-200"
                    >
                      <WarningCircle size={18} weight="fill" className="mt-0.5 shrink-0" />
                      {error}
                    </motion.div>
                  )}

                  <Button type="submit" className="h-12 w-full rounded-xl text-base" loading={cargando}>
                    Iniciar sesión
                  </Button>
                </form>

                {cuentasDemo && (
                <div className="mt-7">
                  <div className="flex items-center gap-3 text-xs font-medium text-slate-400">
                    <span className="h-px flex-1 bg-white/15" />
                    Probar con una cuenta de demostración
                    <span className="h-px flex-1 bg-white/15" />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {CUENTAS_DEMO.map((c) => (
                      <button
                        key={c.email}
                        type="button"
                        disabled={cargando}
                        onClick={() => entrarComo(c.email)}
                        className="group flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2 py-2.5 text-xs font-semibold text-slate-200 transition-[transform,background-color,border-color,color] duration-150 ease-salida hover:border-brand-400/50 hover:bg-brand-500/15 hover:text-white active:scale-[0.97] disabled:opacity-60 [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-0.5"
                      >
                        <c.icon size={20} weight="duotone" className="text-brand-300" />
                        {c.rol}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-center text-xs text-slate-400">Contraseña de todas: {PASSWORD_DEMO}</p>
                </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      <PieDePagina sobreOscuro className="relative z-10 px-4 pb-6" />
    </div>
  );
}
