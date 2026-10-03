import { FormEvent, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { qrApi } from "../../api/endpoints";
import { QrCode } from "@phosphor-icons/react";
import { Alert, Button, Card, CardHeader, Input, Label, PageHeader } from "../../components/ui";
import { DetalleAcceso, DetalleAccesoData } from "../../components/DetalleAcceso";
import { mensajeError } from "../../api/client";

type Resultado = { resultado: "AUTORIZADO" | "RECHAZADO"; motivo: string; detalle?: DetalleAccesoData };

const READER_ID = "qr-reader";

// El QR ahora codifica un link (https://.../acceso/<token>) en vez de solo
// el token en texto plano, para que cualquier camara de celular lo reconozca
// como algo abrible. Si lo que se escaneo o pego es ese link, se extrae el
// token de la URL; si ya es el token crudo (compatibilidad con QRs viejos
// generados antes de este cambio), se usa tal cual.
function extraerToken(texto: string): string {
  const limpio = texto.trim();
  try {
    const url = new URL(limpio);
    const partes = url.pathname.split("/").filter(Boolean);
    const idx = partes.indexOf("acceso");
    if (idx !== -1 && partes[idx + 1]) return decodeURIComponent(partes[idx + 1]);
  } catch {
    // No es una URL valida -> se asume que ya es el token.
  }
  return limpio;
}

export default function ConserjeValidarQR() {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const procesandoRef = useRef(false);
  const [escaneando, setEscaneando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [errorCamara, setErrorCamara] = useState<string | null>(null);
  const [tokenManual, setTokenManual] = useState("");
  const [validandoManual, setValidandoManual] = useState(false);

  async function validarToken(token: string) {
    if (procesandoRef.current) return;
    procesandoRef.current = true;
    try {
      const res = await qrApi.validar(extraerToken(token));
      setResultado(res);
    } catch (err) {
      setResultado({ resultado: "RECHAZADO", motivo: mensajeError(err, "No se pudo validar el código.") });
    } finally {
      procesandoRef.current = false;
    }
  }

  async function iniciarCamara() {
    setErrorCamara(null);
    setResultado(null);
    try {
      const scanner = new Html5Qrcode(READER_ID);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          // Caja de lectura como % del video en vez de un tamaño fijo en px:
          // con un tamaño fijo chico (240px) el usuario tenia que acercar
          // demasiado el QR (mas dificil aun si es el QR en la pantalla de
          // otro celular, con brillo/reflejo). Tambien se pide mayor
          // resolucion de camara -- con la resolucion por defecto (bastante
          // baja) la libreria no alcanzaba a leer el detalle del codigo.
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const lado = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.8);
            return { width: lado, height: lado };
          },
          aspectRatio: 1,
          videoConstraints: {
            facingMode: "environment",
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        },
        async (decodedText) => {
          await validarToken(decodedText);
          await detenerCamara();
        },
        () => {
          // errores de lectura frame a frame, se ignoran (es normal mientras se enfoca)
        }
      );
      setEscaneando(true);
    } catch {
      setErrorCamara("No se pudo acceder a la cámara. Usa la validación manual más abajo.");
    }
  }

  async function detenerCamara() {
    const scanner = scannerRef.current;
    if (scanner) {
      try {
        await scanner.stop();
        await scanner.clear();
      } catch {
        // ignorar si ya estaba detenido
      }
    }
    scannerRef.current = null;
    setEscaneando(false);
  }

  useEffect(() => {
    return () => {
      detenerCamara();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleManualSubmit(e: FormEvent) {
    e.preventDefault();
    setValidandoManual(true);
    try {
      await validarToken(tokenManual.trim());
      setTokenManual("");
    } finally {
      setValidandoManual(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={QrCode} title="Validar acceso QR" subtitle="Escanea el código de un residente o una visita (HU-18, HU-21)." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Escáner de cámara" />
          <div className="space-y-3 p-5">
            <div id={READER_ID} className="mx-auto w-full max-w-sm overflow-hidden rounded-lg bg-slate-900" />
            {escaneando && (
              <p className="text-center text-xs text-slate-400 dark:text-slate-500">
                Si es el QR en la pantalla de otro celular, sube el brillo y acércalo despacio hasta que quede dentro del recuadro.
              </p>
            )}
            {errorCamara && <Alert tone="amber">{errorCamara}</Alert>}
            <Button className="w-full" variant={escaneando ? "secondary" : "primary"} onClick={escaneando ? detenerCamara : iniciarCamara}>
              {escaneando ? "Detener escáner" : "Iniciar escáner"}
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader title="Validación manual" subtitle="Si no hay cámara disponible, pega el código QR" />
          <form onSubmit={handleManualSubmit} className="space-y-3 p-5">
            <div>
              <Label htmlFor="campo-validarqr-1">Código</Label>
              <Input id="campo-validarqr-1" value={tokenManual} onChange={(e) => setTokenManual(e.target.value)} placeholder="Pega el contenido del QR" />
            </div>
            <Button type="submit" className="w-full" loading={validandoManual} disabled={!tokenManual.trim()}>
              Validar
            </Button>
          </form>

          {resultado && (
            <div className="border-t border-slate-100 dark:border-slate-700/60 p-5">
              <div
                className={
                  resultado.resultado === "AUTORIZADO"
                    ? "rounded-lg border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-4 text-center"
                    : "rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-4 text-center"
                }
              >
                <p className={resultado.resultado === "AUTORIZADO" ? "text-lg font-bold text-emerald-700 dark:text-emerald-300" : "text-lg font-bold text-red-700 dark:text-red-300"}>
                  {resultado.resultado === "AUTORIZADO" ? "✓ Acceso autorizado" : "✗ Acceso rechazado"}
                </p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{resultado.motivo}</p>
                <DetalleAcceso detalle={resultado.detalle} className="mt-3 rounded-md bg-white/60 p-3 text-left dark:bg-slate-900/30" />
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
