import { FormEvent, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { QrCode, UserPlus } from "@phosphor-icons/react";
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
  staggerFade,
  Textarea,
} from "../../components/ui";
import { CredencialResidente } from "../../components/CredencialResidente";
import { formatFechaHora, hoyLocal } from "../../lib/format";
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
  const [qrResidente, setQrResidente] = useState<{ qrDataUrl: string; expiraEn: string } | null>(null);
  const [errorQr, setErrorQr] = useState<string | null>(null);
  const [segundosRestantes, setSegundosRestantes] = useState(ROTACION_SEGUNDOS);

  const { data: visitas, cargando, error, recargar } = useAsync(() => qrApi.misVisitas(), []);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [visitaQr, setVisitaQr] = useState<{ nombre: string; qrDataUrl: string; expiraEn: string } | null>(null);
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
      setVisitaQr({ nombre: res.nombreVisita, qrDataUrl: res.qrDataUrl, expiraEn: res.expiraEn });
      setModalInvitadoAbierto(false);
      setNombreInvitado("");
      recargar();
    } catch (err) {
      setErrorInvitado(mensajeError(err));
    } finally {
      setGenerandoInvitado(false);
    }
  }

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
        <Card className="h-fit">
          <CardHeader title="Mi credencial" subtitle="Muéstrala en conserjería para tu ingreso" />
          <div className="flex flex-col items-center gap-3 p-5">
            {errorQr && <Alert tone="red">{errorQr}</Alert>}
            {usuario && qrResidente ? (
              <CredencialResidente
                usuario={usuario}
                qrDataUrl={qrResidente.qrDataUrl}
                segundosRestantes={segundosRestantes}
                rotacionSegundos={ROTACION_SEGUNDOS}
              />
            ) : (
              !errorQr && <Spinner />
            )}
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => setModalInvitadoAbierto(true)}
            >
              <UserPlus size={16} /> QR para un invitado
            </Button>
            <p className="text-center text-xs text-slate-400 dark:text-slate-500">
              Genera un código para que alguien te visite, sin registrar la visita a mano.
            </p>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Visitas autorizadas"
            action={<Button size="sm" onClick={() => setModalAbierto(true)}>+ Registrar visita</Button>}
          />
          {cargando ? (
            <Spinner />
          ) : error ? (
            <Alert tone="red">{error}</Alert>
          ) : !visitas?.length ? (
            <EmptyState icon={QrCode} title="Aún no has registrado visitas" />
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {visitas.map((v, i) => (
                <motion.div key={v.id} {...staggerFade(i)} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 py-3 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-700/60">
                  <div className="min-w-0 flex-1 basis-44">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{v.nombreVisita}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatFechaHora(v.periodoInicio)} — {formatFechaHora(v.periodoFin)}
                      {v.soloUnUso ? " · Uso único" : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={ESTADO_VISITA_TONO[v.estado]}>{ESTADO_VISITA_LABEL[v.estado]}</Badge>
                    {v.estado === "VIGENTE" && !v.qrToken && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={async () => {
                          const res = await qrApi.generarQrVisita(v.id);
                          setVisitaQr({ nombre: v.nombreVisita, ...res });
                          recargar();
                        }}
                      >
                        Generar QR
                      </Button>
                    )}
                    {v.estado === "VIGENTE" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          const ok = await confirmar(
                            `¿Revocar la autorización de ${v.nombreVisita}? Ya no podrá ingresar con ese QR.`,
                            { titulo: "Revocar visita", textoConfirmar: "Revocar" }
                          );
                          if (!ok) return;
                          await qrApi.revocarVisita(v.id);
                          toast.info("Autorización de visita revocada.");
                          recargar();
                        }}
                      >
                        Revocar
                      </Button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
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
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Se genera una autorización de 4 horas, de un solo uso. Comparte el código con tu visita y el conserje lo
            validara al ingreso; quedara en tu lista de visitas autorizadas automaticamente.
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
          <div className="flex flex-col items-center gap-3">
            <img src={visitaQr.qrDataUrl} alt="QR de visita" className="h-56 w-56" />
            <p className="text-xs text-slate-500 dark:text-slate-400">Vigente hasta {formatFechaHora(visitaQr.expiraEn)}</p>
            <p className="text-center text-xs text-slate-400 dark:text-slate-500">
              Comparte este código con tu visita. El conserje lo validará al ingreso.
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
        <Input id="campo-qr-2" required value={nombreVisita} onChange={(e) => setNombreVisita(e.target.value)} />
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
        <Label htmlFor="campo-qr-6">Observaciones</Label>
        <Textarea id="campo-qr-6" rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
        <input type="checkbox" checked={soloUnUso} onChange={(e) => setSoloUnUso(e.target.checked)} />
        Autorización de un solo uso
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
