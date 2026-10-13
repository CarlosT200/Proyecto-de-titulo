import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Camera, ArrowClockwise, Trash, Image as ImagenIcon, Check } from "@phosphor-icons/react";
import { Alert, Button } from "./ui";

// Captura de una foto directamente desde la pagina: abre la camara del dispositivo dentro de la
// propia pantalla (sin salir a la app de camara) y toma la foto, o permite elegir una de la galeria.
// Pensado sobre todo para el celular del conserje. getUserMedia requiere HTTPS (produccion) o
// localhost; si no hay camara o se niega el permiso, queda disponible "Elegir de galeria".
export function CapturaFoto({ foto, onFoto }: { foto: File | null; onFoto: (f: File | null) => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [camaraActiva, setCamaraActiva] = useState(false);
  const [abriendo, setAbriendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!foto) { setPreview(null); return; }
    const url = URL.createObjectURL(foto);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [foto]);

  // Detener la camara al desmontar para no dejar el LED/sensor encendido.
  useEffect(() => () => detenerStream(), []);

  function detenerStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function abrirCamara() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Este dispositivo no permite abrir la cámara en la página. Elige una foto de la galería.");
      return;
    }
    setAbriendo(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } }, audio: false,
      });
      streamRef.current = stream;
      setCamaraActiva(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch {
      setError("No se pudo abrir la cámara. Revisa los permisos del navegador o elige una foto de la galería.");
    } finally {
      setAbriendo(false);
    }
  }

  function cerrarCamara() {
    detenerStream();
    setCamaraActiva(false);
  }

  function capturar() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const max = 1280;
    const escala = Math.min(1, max / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * escala);
    canvas.height = Math.round(video.videoHeight * escala);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) onFoto(new File([blob], `encomienda-${Date.now()}.jpg`, { type: "image/jpeg" }));
      cerrarCamara();
    }, "image/jpeg", 0.85);
  }

  function elegirArchivo(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) { onFoto(f); setError(null); }
    e.target.value = "";
  }

  // Vista de la camara en vivo.
  if (camaraActiva) {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-300 bg-slate-900 dark:border-slate-600">
        <video ref={videoRef} playsInline muted autoPlay className="block max-h-72 w-full bg-black object-contain" />
        <div className="flex gap-2 bg-slate-900 p-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={cerrarCamara}>Cancelar</Button>
          <Button type="button" className="flex-1" onClick={capturar}>
            <Camera size={18} weight="fill" aria-hidden /> Capturar
          </Button>
        </div>
      </div>
    );
  }

  // Vista con la foto ya tomada/elegida.
  if (preview) {
    return (
      <div className="space-y-2">
        <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
          <img src={preview} alt="Foto de la encomienda" className="block max-h-72 w-full object-contain bg-slate-50 dark:bg-slate-900" />
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-emerald-600/90 px-2 py-0.5 text-xs font-semibold text-white">
            <Check size={12} weight="bold" aria-hidden /> Lista
          </span>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={abrirCamara} loading={abriendo}>
            <ArrowClockwise size={16} aria-hidden /> Repetir
          </Button>
          <Button type="button" variant="ghost" size="sm" className="flex-1" onClick={() => onFoto(null)}>
            <Trash size={16} aria-hidden /> Quitar
          </Button>
        </div>
      </div>
    );
  }

  // Vista inicial: tomar foto o elegir de la galeria.
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button type="button" className="flex-1" onClick={abrirCamara} loading={abriendo}>
          <Camera size={18} weight="fill" aria-hidden /> Tomar foto
        </Button>
        <Button type="button" variant="secondary" className="flex-1" onClick={() => fileRef.current?.click()}>
          <ImagenIcon size={18} aria-hidden /> Elegir de galería
        </Button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={elegirArchivo} />
      {error && <Alert tone="amber">{error}</Alert>}
    </div>
  );
}
