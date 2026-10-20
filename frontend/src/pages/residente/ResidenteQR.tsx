import { FormEvent, useEffect, useState } from "react";
import clsx from "clsx";
import { DownloadSimple, Plus, QrCode, ShareNetwork, UserPlus } from "@phosphor-icons/react";
import { qrApi } from "../../api/endpoints";
import { useAsync } from "../../hooks/useAsync";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  Label,
  Modal,
  PageHeader,
  Spinner,
  Textarea,
} from "../../components/ui";
import { CredencialResidente } from "../../components/CredencialResidente";
import { formatDia, formatFechaHora, hoyLocal } from "../../lib/format";
import { compartirQr } from "../../lib/compartirQr";
import { horaLocal } from "../../lib/dias";
import { ESTADO_VISITA_LABEL, ESTADO_VISITA_TONO } from "../../lib/badges";
import { mensajeError } from "../../api/client";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";
import { useAuth } from "../../context/AuthContext";

// El QR del residente se renueva solo cada ROTACION_SEGUNDOS: cada vez que
// se pide uno nuevo, el backend revoca el anterior (ver
// backend/.../qr.service.ts, generarQrResidente), asi que si alguien le
// saca una foto/captura al codigo, deja de servir apenas rota -- es la
// razon de ser del temporizador, no solo estetica.
const ROTACION_SEGUNDOS = 60;

export default function ResidenteQR() {
  const toast = useToast();
  const confirmar = useConfirm();
  const { usuario } = useAuth();
  const [qrResidente, setQrResidente] = useState<{ qrDataUrl: string; expiraEn: string; codigoManual: string } | null>(null);
  const [errorQr, setErrorQr] = useState<string | null>(null);
  const [segundosRestantes, setSegundosRestantes] = useState(ROTACION_SEGUNDOS);

  const { data: visitas, cargando, error, recargar } = useAsync(() => qrApi.misVisitas(), []);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [visitaQr, setVisitaQr] = useState<{ nombre: string; qrDataUrl: string; expiraEn: string; codigoManual: string | null } | null>(null);
  const [modalInvitadoAbierto, setModalInvitadoAbierto] = useState(false);
  const [nombreInvitado, setNombreInvitado] = useState("");
  const [generandoInvitado, setGenerandoInvitado] = useState(false);
  const [errorInvitado, setErrorInvitado] = useState<string | null>(null);

  async function generarQrResidente() {
    setErrorQr(null);
    try {
      const res = await qrApi.generarQrResidente();
      setQrResidente(res);
      setSegundosRestantes(ROTACION_SEGUNDOS);
    } catch (err) {
      setErrorQr(mensajeError(err));
    }
  }

  async function generarQrInvitado() {
    setErrorInvitado(null);
    setGenerandoInvitado(true);
    try {
      const res = await qrApi.crearVisitaRapida(nombreInvitado || undefined);
      setVisitaQr({ nombre: res.nombreVisita, qrDataUrl: res.qrDataUrl, expiraEn: res.expiraEn, codigoManual: res.codigoManual });
      setModalInvitadoAbierto(false);
      setNombreInvitado("");
      recargar();
    } catch (err) {
      setErrorInvitado(mensajeError(err));
    } finally {
      setGenerandoInvitado(false);
    }
  }

  async function qrDeVisita(id: string, nombre: string, yaGenerado: boolean) {
    try {
      const res = yaGenerado ? await qrApi.verQrVisita(id) : await qrApi.generarQrVisita(id);
      setVisitaQr({ nombre, ...res });
      recargar();
    } catch (err) {
      toast.error(mensajeError(err, "No se pudo generar el código."));
    }
  }

  async function revocar(id: string, nombre: string) {
    const ok = await confirmar(`¿Revocar la autorización de ${nombre}? Ya no podrá ingresar con ese QR.`, {
      titulo: "Revocar visita",
      textoConfirmar: "Revocar",
      textoCancelar: "Volver",
    });
    if (!ok) return;
    try {
      await qrApi.revocarVisita(id);
      toast.info("Autorización de visita revocada.");
      recargar();
    } catch (err) {
      toast.error(mensajeError(err, "No se pudo revocar la visita."));
    }
  }

  async function compartir() {
    if (!visitaQr) return;
    const resultado = await compartirQr(
      visitaQr.qrDataUrl,
      visitaQr.nombre,
      `Tu código de acceso a ${usuario?.condominio?.nombre ?? "el condominio"}. Muéstralo en conserjería. Vigente hasta ${formatFechaHora(visitaQr.expiraEn)}.`
    );
    if (resultado === "descargado") toast.success("Imagen del QR descargada. Envíasela a tu visita.");
    else if (resultado === "abierto") toast.info("Se abrió el código QR. Mantén presionada la imagen para guardarla o compartirla con tu visita.");
  }

  // Vigentes primero (lo que se puede usar), luego el resto, cada grupo del mas reciente al mas antiguo.
  const visitasOrdenadas = [...(visitas ?? [])].sort(
    (a, b) => Number(b.estado === "VIGENTE") - Number(a.estado === "VIGENTE") || b.periodoInicio.localeCompare(a.periodoInicio)
  );

  useEffect(() => {
    generarQrResidente();
    const intervaloRotacion = setInterval(generarQrResidente, ROTACION_SEGUNDOS * 1000);
    const intervaloCuenta = setInterval(() => {
      setSegundosRestantes((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => {
      clearInterval(intervaloRotacion);
      clearInterval(intervaloCuenta);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader icon={QrCode} title="Mi QR y visitas" subtitle="Identificación digital y autorización de visitas." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card plana className="h-fit">
          <CardHeader nivel={2} title="Mi credencial" subtitle="Muéstrala en conserjería para tu ingreso." />
          <div className="flex flex-col items-center gap-3 p-5">
            {errorQr && <Alert tone="red">{errorQr}</Alert>}
            {usuario && qrResidente ? (
              <CredencialResidente
                usuario={usuario}
                qrDataUrl={qrResidente.qrDataUrl}
                segundosRestantes={segundosRestantes}
                rotacionSegundos={ROTACION_SEGUNDOS}
                codigo={qrResidente.codigoManual}
              />
            ) : (
              !errorQr && <Spinner />
            )}
            <Button className="w-full" onClick={() => setModalInvitadoAbierto(true)}>
              <UserPlus size={16} aria-hidden /> QR para un invitado
            </Button>
            <p className="text-center text-sm text-slate-600 dark:text-slate-300">
              Un código de 4 horas para que alguien te visite, listo para enviarlo por WhatsApp.
            </p>
          </div>
        </Card>

        <Card plana className="overflow-hidden lg:col-span-2">
          <CardHeader
            nivel={2}
            title="Visitas autorizadas"
            subtitle="Para una visita con fecha y horario definidos."
            action={
              <Button size="sm" variant="secondary" className="shrink-0 max-sm:min-h-11" onClick={() => setModalAbierto(true)}>
                <Plus size={14} weight="bold" aria-hidden /> Registrar
              </Button>
            }
          />
          {cargando && !visitas ? (
            <Spinner />
          ) : error ? (
            <Alert tone="red">{error}</Alert>
          ) : !visitas?.length ? (
            <EmptyState icon={QrCode} title="Aún no has registrado visitas" />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {visitasOrdenadas.map((v) => {
                // Una visita cuyo horario ya termino se muestra como expirada aunque nadie la haya usado.
                const vencida = v.estado === "VIGENTE" && new Date(v.periodoFin).getTime() < Date.now();
                const estado = vencida ? "EXPIRADA" : v.estado;
                const vigente = estado === "VIGENTE";
                return (
                  <li key={v.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={clsx("break-words font-medium", vigente ? "text-slate-900 dark:text-slate-100" : "text-slate-600 dark:text-slate-300")}>
                          {v.nombreVisita}
                        </p>
                        <Badge tone={ESTADO_VISITA_TONO[estado]}>{ESTADO_VISITA_LABEL[estado]}</Badge>
                      </div>
                      <p className="mt-0.5 text-sm tabular-nums text-slate-600 dark:text-slate-300">
                        {formatDia(v.periodoInicio)} · {horaLocal(v.periodoInicio)} a {horaLocal(v.periodoFin)}
                        {v.soloUnUso ? " · un solo uso" : ""}
                      </p>
                    </div>
                    {vigente && (
                      <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex">
                        <Button size="sm" variant="secondary" className="max-sm:min-h-11" onClick={() => qrDeVisita(v.id, v.nombreVisita, Boolean(v.qrToken))}>
                          <QrCode size={14} aria-hidden /> {v.qrToken ? "Ver QR" : "Generar QR"}
                        </Button>
                        <Button size="sm" variant="secondary" className="text-red-700 max-sm:min-h-11 dark:text-red-300" onClick={() => revocar(v.id, v.nombreVisita)}>
                          Revocar
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Modal open={modalAbierto} onClose={() => setModalAbierto(false)} title="Registrar visita">
        <FormularioVisita
          onCreado={() => {
            setModalAbierto(false);
            recargar();
          }}
        />
      </Modal>

      <Modal
        open={modalInvitadoAbierto}
        onClose={() => {
          setModalInvitadoAbierto(false);
          setErrorInvitado(null);
        }}
        title="QR para un invitado"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Se genera una autorización de 4 horas, de un solo uso. Envía el código a tu visita y el conserje lo validará al
            ingreso; quedará en tu lista de visitas autorizadas automáticamente.
          </p>
          <div>
            <Label htmlFor="campo-qr-1">Nombre del invitado (opcional)</Label>
            <Input id="campo-qr-1"
              value={nombreInvitado}
              onChange={(e) => setNombreInvitado(e.target.value)}
              placeholder="Invitado"
              maxLength={120}
            />
          </div>
          {errorInvitado && <Alert tone="red">{errorInvitado}</Alert>}
          <Button className="w-full" loading={generandoInvitado} onClick={generarQrInvitado}>
            Generar QR
          </Button>
        </div>
      </Modal>

      <Modal open={!!visitaQr} onClose={() => setVisitaQr(null)} title={`QR de ${visitaQr?.nombre ?? ""}`}>
        {visitaQr && (
          <div className="flex flex-col items-center gap-4">
            <img src={visitaQr.qrDataUrl} alt={`Código QR de acceso de ${visitaQr.nombre}`} className="h-60 w-60 rounded-xl bg-white p-2 ring-1 ring-slate-200" />
            {visitaQr.codigoManual && (
              <div className="text-center">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Código para conserjería</p>
                <p className="mt-0.5 font-display text-xl font-bold tracking-[0.25em] tabular-nums text-slate-800 dark:text-white">
                  {visitaQr.codigoManual.length === 6 ? `${visitaQr.codigoManual.slice(0, 3)}-${visitaQr.codigoManual.slice(3)}` : visitaQr.codigoManual}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Si no pueden escanear el QR, dicta este código.</p>
              </div>
            )}
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Vigente hasta {formatFechaHora(visitaQr.expiraEn)}</p>
            <Button className="w-full" onClick={compartir}>
              <ShareNetwork size={18} aria-hidden /> Enviar a mi visita
            </Button>
            <p className="flex items-start gap-1.5 text-center text-sm text-slate-600 dark:text-slate-300">
              <DownloadSimple size={16} className="mt-0.5 shrink-0" aria-hidden />
              Se abre el menú para compartir (WhatsApp, correo…). En el computador se descarga la imagen.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}

function FormularioVisita({ onCreado }: { onCreado: () => void }) {
  const toast = useToast();
  const [nombreVisita, setNombreVisita] = useState("");
  const [fecha, setFecha] = useState(hoyLocal());
  const [horaInicio, setHoraInicio] = useState("09:00");
  const [horaFin, setHoraFin] = useState("20:00");
  const [observaciones, setObservaciones] = useState("");
  const [soloUnUso, setSoloUnUso] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const periodoInicio = new Date(`${fecha}T${horaInicio}:00`).toISOString();
      const periodoFin = new Date(`${fecha}T${horaFin}:00`).toISOString();
      await qrApi.crearVisita({ nombreVisita, fecha, periodoInicio, periodoFin, observaciones: observaciones || undefined, soloUnUso });
      toast.success("Visita registrada.");
      onCreado();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="campo-qr-2">Nombre de la visita</Label>
        <Input id="campo-qr-2" required maxLength={120} value={nombreVisita} onChange={(e) => setNombreVisita(e.target.value)} placeholder="Ej: María González" />
      </div>
      <div>
        <Label htmlFor="campo-qr-3">Fecha</Label>
        <Input id="campo-qr-3"
          type="date"
          required
          min={hoyLocal()}
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="campo-qr-4">Desde</Label>
          <Input id="campo-qr-4" type="time" required value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="campo-qr-5">Hasta</Label>
          <Input id="campo-qr-5" type="time" required value={horaFin} onChange={(e) => setHoraFin(e.target.value)} />
        </div>
      </div>
      <div>
        <Label htmlFor="campo-qr-6">Observaciones (opcional)</Label>
        <Textarea id="campo-qr-6" rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
      </div>
      {horaInicio && horaFin && horaFin <= horaInicio && <Alert tone="amber">La hora de término debe ser posterior a la de inicio.</Alert>}
      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 dark:border-slate-600 dark:text-slate-200">
        <input type="checkbox" className="h-5 w-5 accent-brand-600" checked={soloUnUso} onChange={(e) => setSoloUnUso(e.target.checked)} />
        Autorización de un solo uso (el QR deja de servir al entrar)
      </label>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Avísale a tu visita que registras su nombre para su ingreso al condominio.
      </p>
      {error && <Alert tone="red">{error}</Alert>}
      <Button type="submit" className="w-full" loading={cargando}>
        Registrar visita
      </Button>
    </form>
  );
}
