import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Buildings, CheckCircle, QrCode, SignIn, WarningCircle, XCircle } from "@phosphor-icons/react";
import { useAuth } from "../context/AuthContext";
import { qrApi } from "../api/endpoints";
import { mensajeError } from "../api/client";
import { Button, Spinner } from "../components/ui";
import { DetalleAcceso, DetalleAccesoData } from "../components/DetalleAcceso";
import { PieDePagina } from "../components/PieDePagina";

// Pagina publica (fuera de ProtectedRoute) a la que apunta el link codificado
// en el QR (ver backend/src/modules/qr/qr.service.ts, urlAcceso). Antes el QR
// codificaba solo el token en texto plano: al escanearlo con la camara comun
// del celular (no con el escaner propio de la app) no habia nada que abrir,
// solo texto suelto. Ahora es un link real: cualquier camara lo reconoce.
//
// Si quien lo abre esta autenticado como conserje, valida automaticamente
// (mismo endpoint que la pagina "Validar QR"). Para cualquier otra persona
// (el propio residente revisando su QR, o la visita) muestra un mensaje
// simple en vez de datos crudos o un error de permisos.
type Resultado = { resultado: "AUTORIZADO" | "RECHAZADO"; motivo: string; detalle?: DetalleAccesoData };

export default function AccesoQR() {
  const { token } = useParams<{ token: string }>();
  const location = useLocation();
  const { usuario, cargando } = useAuth();
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [validando, setValidando] = useState(false);

  const esConserje = usuario?.rol === "CONSERJE";

  useEffect(() => {
    if (!esConserje || !token) return;
    setValidando(true);
    qrApi
      .validar(token)
      .then(setResultado)
      .catch((err) => setResultado({ resultado: "RECHAZADO", motivo: mensajeError(err, "No se pudo validar el código.") }))
      .finally(() => setValidando(false));
  }, [esConserje, token]);

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-brand-50 via-slate-50 to-slate-100 px-4 py-10 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-brand-900/5 dark:border-slate-700 dark:bg-slate-800">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-600/30">
          <Buildings size={24} weight="duotone" />
        </div>

        {!token ? (
          <>
            <WarningCircle size={40} weight="fill" className="mx-auto mb-3 text-red-500" />
            <p className="font-display text-lg font-bold text-slate-900 dark:text-white">Código no reconocido</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">El link no incluye un código de acceso válido.</p>
          </>
        ) : esConserje ? (
          validando ? (
            <>
              <Spinner />
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Validando código...</p>
            </>
          ) : resultado ? (
            <div
              className={
                resultado.resultado === "AUTORIZADO"
                  ? "rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10"
                  : "rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10"
              }
            >
              <p
                className={
                  resultado.resultado === "AUTORIZADO"
                    ? "text-lg font-bold text-emerald-700 dark:text-emerald-300"
                    : "text-lg font-bold text-red-700 dark:text-red-300"
                }
              >
                {resultado.resultado === "AUTORIZADO" ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <CheckCircle size={26} weight="fill" /> Acceso autorizado
                  </span>
                ) : (
                  <span className="inline-flex items-center justify-center gap-2">
                    <XCircle size={26} weight="fill" /> Acceso rechazado
                  </span>
                )}
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{resultado.motivo}</p>
              <DetalleAcceso detalle={resultado.detalle} className="mt-3 rounded-md bg-white/60 p-3 text-left dark:bg-slate-900/30" />
            </div>
          ) : null
        ) : (
          <>
            <QrCode size={40} weight="duotone" className="mx-auto mb-3 text-brand-600 dark:text-brand-400" />
            <p className="font-display text-lg font-bold text-slate-900 dark:text-white">Código de acceso QR</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Muéstraselo al conserje para que lo escanee desde su celular y valide tu ingreso.
            </p>
            <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
              <CheckCircle size={14} />
              No necesitas hacer nada más en esta pantalla.
            </div>
            {!usuario && (
              <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-700">
                <p className="text-xs text-slate-500 dark:text-slate-400">¿Eres parte del equipo de conserjería?</p>
                <Link to="/login" state={{ volverA: location.pathname }} className="mt-2 inline-block">
                  <Button variant="secondary" size="sm">
                    <SignIn size={16} /> Iniciar sesión para validar
                  </Button>
                </Link>
              </div>
            )}
          </>
        )}

        {usuario && (
          <Link to="/" className="mt-6 inline-block">
            <Button variant="secondary" size="sm">
              Volver a HabitaSmart
            </Button>
          </Link>
        )}
      </div>
      <PieDePagina className="mt-6" />
    </div>
  );
}
