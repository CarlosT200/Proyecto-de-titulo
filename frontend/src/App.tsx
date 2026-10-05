import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import {
  Buildings,
  CalendarBlank,
  ChartBar,
  ClipboardText,
  ClockCounterClockwise,
  FileText,
  House,
  Megaphone,
  Package,
  QrCode,
  Siren,
  Users,
  Warning,
  Wrench,
} from "@phosphor-icons/react";
import { useAuth } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppLayout, NavItem } from "./layouts/AppLayout";
import { Spinner } from "./components/ui";
import Login from "./pages/Login";

// Cada pagina es su propio chunk (code-splitting por ruta) en vez de un solo
// bundle de ~900kB: nadie necesita el JS de "Condominio" o "Documentos" para
// ver su dashboard. React.lazy + Suspense cargan el chunk de la ruta recien
// cuando se navega a ella; el componente se reusa igual si aparece en mas de
// un rol (AlertasSos, Perfil) porque import() cachea por modulo.
const AccesoQR = lazy(() => import("./pages/AccesoQR"));
const Privacidad = lazy(() => import("./pages/Privacidad"));
const AlertasSos = lazy(() => import("./pages/AlertasSos"));

const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminUsuarios = lazy(() => import("./pages/admin/AdminUsuarios"));
const AdminCondominio = lazy(() => import("./pages/admin/AdminCondominio"));
const AdminReservas = lazy(() => import("./pages/admin/AdminReservas"));
const AdminMultas = lazy(() => import("./pages/admin/AdminMultas"));
const AdminIncidencias = lazy(() => import("./pages/admin/AdminIncidencias"));
const AdminEncomiendas = lazy(() => import("./pages/admin/AdminEncomiendas"));
const AdminComunicados = lazy(() => import("./pages/admin/AdminComunicados"));
const AdminDocumentos = lazy(() => import("./pages/admin/AdminDocumentos"));
const AdminAccesos = lazy(() => import("./pages/admin/AdminAccesos"));
const AdminAuditoria = lazy(() => import("./pages/admin/AdminAuditoria"));

const ResidenteInicio = lazy(() => import("./pages/residente/ResidenteInicio"));
const ResidenteReservas = lazy(() => import("./pages/residente/ResidenteReservas"));
const ResidenteMultas = lazy(() => import("./pages/residente/ResidenteMultas"));
const ResidenteIncidencias = lazy(() => import("./pages/residente/ResidenteIncidencias"));
const ResidenteEncomiendas = lazy(() => import("./pages/residente/ResidenteEncomiendas"));
const ResidenteComunicados = lazy(() => import("./pages/residente/ResidenteComunicados"));
const ResidenteQR = lazy(() => import("./pages/residente/ResidenteQR"));
const ResidenteDocumentos = lazy(() => import("./pages/residente/ResidenteDocumentos"));

const ConserjeInicio = lazy(() => import("./pages/conserje/ConserjeInicio"));
const ConserjeEncomiendas = lazy(() => import("./pages/conserje/ConserjeEncomiendas"));
const ConserjeValidarQR = lazy(() => import("./pages/conserje/ConserjeValidarQR"));
const ConserjeAccesos = lazy(() => import("./pages/conserje/ConserjeAccesos"));

const Perfil = lazy(() => import("./pages/Perfil"));

function PaginaCargando() {
  return <Spinner className="min-h-[50vh]" />;
}

const ICON_SIZE = 20;

const ADMIN_NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: <ChartBar size={ICON_SIZE} /> },
  { to: "/alertas-sos", label: "Alertas SOS", icon: <Siren size={ICON_SIZE} /> },
  { to: "/residentes", label: "Residentes", icon: <Users size={ICON_SIZE} /> },
  { to: "/condominio", label: "Condominio", icon: <Buildings size={ICON_SIZE} /> },
  { to: "/reservas", label: "Reservas", icon: <CalendarBlank size={ICON_SIZE} /> },
  { to: "/multas", label: "Multas", icon: <Warning size={ICON_SIZE} /> },
  { to: "/incidencias", label: "Incidencias", icon: <Wrench size={ICON_SIZE} /> },
  { to: "/encomiendas", label: "Encomiendas", icon: <Package size={ICON_SIZE} /> },
  { to: "/comunicados", label: "Comunicados", icon: <Megaphone size={ICON_SIZE} /> },
  { to: "/documentos", label: "Documentos", icon: <FileText size={ICON_SIZE} /> },
  { to: "/accesos", label: "Accesos QR", icon: <QrCode size={ICON_SIZE} /> },
  { to: "/auditoria", label: "Registro de actividad", icon: <ClipboardText size={ICON_SIZE} /> },
];

const RESIDENTE_NAV: NavItem[] = [
  { to: "/", label: "Inicio", icon: <House size={ICON_SIZE} /> },
  { to: "/reservas", label: "Reservas", icon: <CalendarBlank size={ICON_SIZE} /> },
  { to: "/multas", label: "Mis multas", icon: <Warning size={ICON_SIZE} /> },
  { to: "/incidencias", label: "Incidencias", icon: <Wrench size={ICON_SIZE} /> },
  { to: "/encomiendas", label: "Encomiendas", icon: <Package size={ICON_SIZE} /> },
  { to: "/comunicados", label: "Comunicados", icon: <Megaphone size={ICON_SIZE} /> },
  { to: "/qr", label: "Mi QR y visitas", icon: <QrCode size={ICON_SIZE} /> },
  { to: "/documentos", label: "Documentos", icon: <FileText size={ICON_SIZE} /> },
];

const CONSERJE_NAV: NavItem[] = [
  { to: "/", label: "Inicio", icon: <House size={ICON_SIZE} /> },
  { to: "/encomiendas", label: "Encomiendas", icon: <Package size={ICON_SIZE} /> },
  { to: "/alertas-sos", label: "Alertas SOS", icon: <Siren size={ICON_SIZE} /> },
  { to: "/validar", label: "Validar QR", icon: <QrCode size={ICON_SIZE} /> },
  { to: "/accesos", label: "Historial de accesos", icon: <ClockCounterClockwise size={ICON_SIZE} /> },
];

function AdminApp() {
  return (
    <AppLayout nav={ADMIN_NAV}>
      <Suspense fallback={<PaginaCargando />}>
        <Routes>
          <Route index element={<AdminDashboard />} />
          <Route path="alertas-sos" element={<AlertasSos />} />
          <Route path="residentes" element={<AdminUsuarios />} />
          <Route path="condominio" element={<AdminCondominio />} />
          <Route path="reservas" element={<AdminReservas />} />
          <Route path="multas" element={<AdminMultas />} />
          <Route path="incidencias" element={<AdminIncidencias />} />
          <Route path="encomiendas" element={<AdminEncomiendas />} />
          <Route path="comunicados" element={<AdminComunicados />} />
          <Route path="documentos" element={<AdminDocumentos />} />
          <Route path="accesos" element={<AdminAccesos />} />
          <Route path="auditoria" element={<AdminAuditoria />} />
          <Route path="perfil" element={<Perfil />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppLayout>
  );
}

function ResidenteApp() {
  return (
    <AppLayout nav={RESIDENTE_NAV}>
      <Suspense fallback={<PaginaCargando />}>
        <Routes>
          <Route index element={<ResidenteInicio />} />
          <Route path="reservas" element={<ResidenteReservas />} />
          <Route path="multas" element={<ResidenteMultas />} />
          <Route path="incidencias" element={<ResidenteIncidencias />} />
          <Route path="encomiendas" element={<ResidenteEncomiendas />} />
          <Route path="comunicados" element={<ResidenteComunicados />} />
          <Route path="qr" element={<ResidenteQR />} />
          <Route path="documentos" element={<ResidenteDocumentos />} />
          <Route path="perfil" element={<Perfil />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppLayout>
  );
}

function ConserjeApp() {
  return (
    <AppLayout nav={CONSERJE_NAV}>
      <Suspense fallback={<PaginaCargando />}>
        <Routes>
          <Route index element={<ConserjeInicio />} />
          <Route path="encomiendas" element={<ConserjeEncomiendas />} />
          <Route path="alertas-sos" element={<AlertasSos />} />
          <Route path="validar" element={<ConserjeValidarQR />} />
          <Route path="accesos" element={<ConserjeAccesos />} />
          <Route path="perfil" element={<Perfil />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppLayout>
  );
}

function RoleRouter() {
  const { usuario } = useAuth();
  if (!usuario) return null;
  if (usuario.rol === "ADMIN") return <AdminApp />;
  if (usuario.rol === "RESIDENTE") return <ResidenteApp />;
  return <ConserjeApp />;
}

export default function App() {
  return (
    <Suspense fallback={<PaginaCargando />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/acceso/:token" element={<AccesoQR />} />
        <Route path="/privacidad" element={<Privacidad />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <RoleRouter />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Suspense>
  );
}
