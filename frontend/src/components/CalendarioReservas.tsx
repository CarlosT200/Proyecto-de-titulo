import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { reservasApi } from "../api/endpoints";
import { hoyLocal } from "../lib/format";
import type { EspacioComun } from "../types";

type Ocupado = { horaInicio: string; horaFin: string };

const DIAS_SEMANA = ["L", "M", "X", "J", "V", "S", "D"];
const NOMBRES_DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MESES_ADELANTE = 3;

const aMinutos = (hora: string) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
const dos = (n: number) => String(n).padStart(2, "0");
const iso = (anio: number, mes: number, dia: number) => `${anio}-${dos(mes)}-${dos(dia)}`;
const hhmm = (min: number) => `${dos(Math.floor(min / 60))}:${dos(min % 60)}`;

// Minutos reservados dentro del horario del espacio, sobre los minutos que esta abierto (0 a 1).
function proporcionOcupada(espacio: EspacioComun, reservas: Ocupado[]): number {
  const abre = aMinutos(espacio.horarioInicio);
  const cierra = aMinutos(espacio.horarioFin);
  const total = cierra - abre;
  if (total <= 0) return 0;
  const ocupado = reservas.reduce((s, r) => s + Math.max(0, Math.min(cierra, aMinutos(r.horaFin)) - Math.max(abre, aMinutos(r.horaInicio))), 0);
  return Math.min(1, ocupado / total);
}

function nivel(p: number): { texto: string; clase: string } {
  if (p >= 0.999) return { texto: "lleno", clase: "bg-slate-400 dark:bg-slate-500" };
  if (p >= 0.5) return { texto: "muy ocupado", clase: "bg-accent-500" };
  if (p > 0) return { texto: "con algunas reservas", clase: "bg-brand-500" };
  return { texto: "libre", clase: "" };
}

// Calendario del mes para un espacio comun: cada dia muestra que tan ocupado esta (barra bajo el
// numero) y se toca para elegirlo. Los dias pasados no se pueden elegir.
export function CalendarioReservas({
  espacio,
  fecha,
  onElegir,
  version = 0,
}: {
  espacio: EspacioComun;
  fecha: string;
  onElegir: (fecha: string) => void;
  /** Cambia despues de reservar o cancelar, para volver a consultar la ocupacion. */
  version?: number;
}) {
  const hoy = hoyLocal();
  const [anioHoy, mesHoy] = hoy.split("-").map(Number);
  const [visible, setVisible] = useState(() => {
    const [a, m] = fecha.split("-").map(Number);
    return { anio: a, mes: m };
  });
  const [reservas, setReservas] = useState<Record<string, Ocupado[]>>({});
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(false);

  const diasDelMes = new Date(visible.anio, visible.mes, 0).getDate();
  const desde = iso(visible.anio, visible.mes, 1);
  const hasta = iso(visible.anio, visible.mes, diasDelMes);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(false);
    reservasApi
      .ocupacion(espacio.id, desde, hasta)
      .then((r) => {
        if (!vigente) return;
        const porDia: Record<string, Ocupado[]> = {};
        r.reservas.forEach((x) => (porDia[x.fecha] ??= []).push({ horaInicio: x.horaInicio, horaFin: x.horaFin }));
        setReservas(porDia);
      })
      .catch(() => vigente && setError(true))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [espacio.id, desde, hasta, version]);

  const indiceMes = (visible.anio - anioHoy) * 12 + (visible.mes - mesHoy);
  const mover = (delta: number) =>
    setVisible((v) => {
      const total = v.anio * 12 + (v.mes - 1) + delta;
      return { anio: Math.floor(total / 12), mes: (total % 12) + 1 };
    });

  // Lunes primero: el dia de la semana del 1 (0 = lunes).
  const inicioSemana = (new Date(visible.anio, visible.mes - 1, 1).getDay() + 6) % 7;
  const celdas = useMemo(() => {
    const lista: (number | null)[] = Array(inicioSemana).fill(null);
    for (let d = 1; d <= diasDelMes; d++) lista.push(d);
    while (lista.length % 7) lista.push(null);
    return lista;
  }, [inicioSemana, diasDelMes]);

  return (
    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => mover(-1)}
          disabled={indiceMes <= 0}
          aria-label="Mes anterior"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:pointer-events-none disabled:opacity-30 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <CaretLeft size={18} weight="bold" aria-hidden />
        </button>
        <p className="font-display font-semibold capitalize text-slate-900 dark:text-white" aria-live="polite">
          {MESES[visible.mes - 1]} {visible.anio}
          {cargando && <span className="sr-only"> (cargando)</span>}
        </p>
        <button
          type="button"
          onClick={() => mover(1)}
          disabled={indiceMes >= MESES_ADELANTE}
          aria-label="Mes siguiente"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:pointer-events-none disabled:opacity-30 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <CaretRight size={18} weight="bold" aria-hidden />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center" role="group" aria-label={`Días de ${MESES[visible.mes - 1]}`}>
        {DIAS_SEMANA.map((d, i) => (
          <span key={d} className="pb-1 text-xs font-semibold text-slate-500 dark:text-slate-400" aria-hidden>
            <abbr title={NOMBRES_DIAS[i]} className="no-underline">
              {d}
            </abbr>
          </span>
        ))}
        {celdas.map((dia, i) => {
          if (dia === null) return <span key={`v-${i}`} aria-hidden />;
          const valor = iso(visible.anio, visible.mes, dia);
          const pasado = valor < hoy;
          const elegido = valor === fecha;
          const p = proporcionOcupada(espacio, reservas[valor] ?? []);
          const n = nivel(p);
          const lleno = p >= 0.999;
          const nombreDia = NOMBRES_DIAS[(new Date(visible.anio, visible.mes - 1, dia).getDay() + 6) % 7];
          return (
            <button
              key={valor}
              type="button"
              disabled={pasado}
              aria-pressed={elegido}
              aria-label={`${nombreDia} ${dia} de ${MESES[visible.mes - 1]}${pasado ? "" : `: ${n.texto}`}${valor === hoy ? " (hoy)" : ""}`}
              onClick={() => onElegir(valor)}
              className={clsx(
                "relative flex min-h-11 flex-col items-center justify-center rounded-lg text-sm tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
                pasado && "pointer-events-none text-slate-400 dark:text-slate-600",
                !pasado && !elegido && "text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-700",
                !pasado && !elegido && lleno && "bg-slate-100 text-slate-500 line-through dark:bg-slate-700/60 dark:text-slate-400",
                elegido && "bg-brand-600 font-semibold text-white",
                valor === hoy && !elegido && "ring-1 ring-inset ring-brand-400"
              )}
            >
              {dia}
              {!pasado && p > 0 && (
                <span aria-hidden className={clsx("absolute inset-x-2 bottom-1 h-1 overflow-hidden rounded-full", elegido ? "bg-white/30" : "bg-slate-200 dark:bg-slate-600")}>
                  <span className={clsx("block h-full rounded-full", elegido ? "bg-white" : n.clase)} style={{ width: `${Math.max(18, Math.round(p * 100))}%` }} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">
        La barra bajo cada día muestra cuánto de su horario ya está reservado. Sin barra: día libre.
      </p>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300" aria-hidden>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-4 rounded-full bg-brand-500" /> Menos de la mitad
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-4 rounded-full bg-accent-500" /> La mitad o más
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-4 rounded-full bg-slate-400" /> Lleno
        </span>
      </div>
      {error && <p className="mt-2 text-sm text-red-700 dark:text-red-300">No se pudo cargar la ocupación del mes. Puedes elegir el día igual.</p>}
    </div>
  );
}

// Selector visual de franjas horarias (bloques de 1 hora) del espacio para el dia elegido. Muestra
// TODAS las horas; las ya reservadas aparecen tachadas y no se pueden tocar, y las que ya pasaron (si
// el dia es hoy) quedan deshabilitadas. El residente toca la hora de inicio y luego la de termino.
export function SelectorHoras({
  espacio,
  fecha,
  ocupados,
  horaInicio,
  horaFin,
  onCambio,
}: {
  espacio: EspacioComun;
  fecha: string;
  ocupados: Ocupado[];
  horaInicio: string;
  horaFin: string;
  onCambio: (inicio: string, fin: string) => void;
}) {
  const abre = aMinutos(espacio.horarioInicio);
  const cierra = aMinutos(espacio.horarioFin);
  const ahora = new Date();
  const nowMin = fecha === hoyLocal() ? ahora.getHours() * 60 + ahora.getMinutes() : -1;

  const franjas = useMemo(() => {
    const lista: { iniMin: number; finMin: number; ini: string; fin: string; ocupado: boolean; pasado: boolean }[] = [];
    for (let t = abre; t < cierra; t += 60) {
      const finMin = Math.min(t + 60, cierra);
      const ocupado = ocupados.some((o) => t < aMinutos(o.horaFin) && finMin > aMinutos(o.horaInicio));
      const pasado = nowMin >= 0 && t <= nowMin;
      lista.push({ iniMin: t, finMin, ini: hhmm(t), fin: hhmm(finMin), ocupado, pasado });
    }
    return lista;
  }, [abre, cierra, ocupados, nowMin]);

  const selIni = horaInicio ? aMinutos(horaInicio) : -1;
  const selFin = horaFin ? aMinutos(horaFin) : -1;
  const haySeleccion = selIni >= 0 && selFin > selIni;

  // Primer toque: fija el inicio (bloque de 1 hora). Segundo toque: fija el término y arma el rango.
  // Tercer toque: empieza de nuevo. Al cambiar de día o espacio se reinicia el anclaje.
  const [ancla, setAncla] = useState<number | null>(null);
  useEffect(() => {
    setAncla(null);
  }, [espacio.id, fecha]);

  function elegir(f: (typeof franjas)[number]) {
    if (f.ocupado || f.pasado) return;
    if (ancla === null) {
      setAncla(f.iniMin);
      onCambio(f.ini, f.fin);
      return;
    }
    const anclaFin = Math.min(ancla + 60, cierra);
    const lo = Math.min(ancla, f.iniMin);
    const hi = Math.max(anclaFin, f.finMin);
    // Si entre el inicio y el término hay alguna franja ocupada o pasada, no se puede: reinicia ahí.
    const bloqueada = franjas.some((s) => s.iniMin >= lo && s.finMin <= hi && (s.ocupado || s.pasado));
    if (bloqueada) {
      setAncla(f.iniMin);
      onCambio(f.ini, f.fin);
    } else {
      onCambio(hhmm(lo), hhmm(hi));
      setAncla(null);
    }
  }

  if (franjas.length === 0) return null;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Elige el horario</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">Toca inicio y término</p>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" role="group" aria-label="Horarios disponibles">
        {franjas.map((f) => {
          const noDisponible = f.ocupado || f.pasado;
          const seleccionada = haySeleccion && !noDisponible && f.iniMin >= selIni && f.finMin <= selFin;
          return (
            <button
              key={f.iniMin}
              type="button"
              disabled={noDisponible}
              aria-pressed={seleccionada}
              aria-label={`${f.ini} a ${f.fin}${f.ocupado ? ", reservado" : f.pasado ? ", ya pasó" : seleccionada ? ", elegido" : ", disponible"}`}
              onClick={() => elegir(f)}
              className={clsx(
                "flex min-h-[54px] flex-col items-center justify-center rounded-lg border px-1 py-1.5 text-sm tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
                seleccionada && "border-brand-600 bg-brand-600 font-semibold text-white shadow-sm",
                !seleccionada && !noDisponible &&
                  "border-slate-200 bg-white text-slate-800 hover:border-brand-300 hover:bg-brand-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10",
                f.ocupado && "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 line-through dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-500",
                f.pasado && !f.ocupado && "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400 opacity-70 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-500"
              )}
            >
              <span>{f.ini}</span>
              <span className={clsx("text-[11px]", seleccionada ? "text-white/85" : "opacity-70")}>
                {f.ocupado ? "Reservado" : f.pasado ? "—" : `a ${f.fin}`}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-4 rounded-sm border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800" /> Disponible
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-4 rounded-sm bg-brand-600" /> Tu elección
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-4 rounded-sm bg-slate-200 dark:bg-slate-700" /> Reservado
        </span>
      </div>
    </div>
  );
}

// Linea del dia: el horario del espacio de punta a punta, con lo ya reservado en gris y el horario
// que se esta eligiendo en azul (o en ambar si choca o queda fuera).
export function LineaDelDia({
  espacio,
  ocupados,
  horaInicio,
  horaFin,
  conflicto,
}: {
  espacio: EspacioComun;
  ocupados: Ocupado[];
  horaInicio: string;
  horaFin: string;
  conflicto: boolean;
}) {
  const abre = aMinutos(espacio.horarioInicio);
  const cierra = aMinutos(espacio.horarioFin);
  const total = Math.max(1, cierra - abre);
  const pos = (hora: string) => Math.min(100, Math.max(0, ((aMinutos(hora) - abre) / total) * 100));
  const eleccionValida = horaInicio && horaFin && aMinutos(horaFin) > aMinutos(horaInicio);
  const medio = abre + Math.round(total / 2 / 30) * 30;
  const etiquetaMedio = `${dos(Math.floor(medio / 60))}:${dos(medio % 60)}`;

  return (
    <div aria-hidden>
      <div className="relative h-7 overflow-hidden rounded-lg bg-emerald-50 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/10 dark:ring-emerald-500/30">
        {ocupados.map((o, i) => (
          <span
            key={i}
            className="absolute inset-y-0 bg-slate-300 bg-[repeating-linear-gradient(135deg,transparent_0,transparent_4px,rgba(255,255,255,0.45)_4px,rgba(255,255,255,0.45)_8px)] dark:bg-slate-600"
            style={{ left: `${pos(o.horaInicio)}%`, width: `${Math.max(0.8, pos(o.horaFin) - pos(o.horaInicio))}%` }}
          />
        ))}
        {eleccionValida && (
          <span
            className={clsx("absolute inset-y-0.5 rounded-md border-2", conflicto ? "border-amber-500 bg-amber-400/40" : "border-brand-600 bg-brand-500/30")}
            style={{ left: `${pos(horaInicio)}%`, width: `${Math.max(1.5, pos(horaFin) - pos(horaInicio))}%` }}
          />
        )}
      </div>
      <div className="mt-1 flex justify-between text-xs tabular-nums text-slate-500 dark:text-slate-400">
        <span>{espacio.horarioInicio}</span>
        <span>{etiquetaMedio}</span>
        <span>{espacio.horarioFin}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-slate-600 dark:text-slate-300">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-3 rounded-sm bg-emerald-100 ring-1 ring-emerald-300 dark:bg-emerald-500/20" /> Libre
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-3 rounded-sm bg-slate-300 dark:bg-slate-600" /> Reservado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-3 rounded-sm border-2 border-brand-600" /> Tu elección
        </span>
      </div>
    </div>
  );
}
