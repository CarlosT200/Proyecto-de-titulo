// Tonos de color de las tarjetas de indicadores (StatCard) y de los accesos rapidos del inicio.
// icono: degrade solido con icono blanco; brillo: mancha difusa de fondo del mismo tono.
export const STAT_TONES: Record<string, { icono: string; brillo: string }> = {
  slate: { icono: "from-slate-500 to-slate-700 shadow-slate-500/30", brillo: "bg-slate-400/20" },
  brand: { icono: "from-brand-500 to-brand-700 shadow-brand-600/30", brillo: "bg-brand-500/20" },
  green: { icono: "from-emerald-400 to-emerald-600 shadow-emerald-500/30", brillo: "bg-emerald-500/20" },
  amber: { icono: "from-amber-400 to-orange-500 shadow-amber-500/30", brillo: "bg-amber-500/20" },
  red: { icono: "from-red-500 to-rose-600 shadow-red-500/30", brillo: "bg-red-500/20" },
  purple: { icono: "from-violet-500 to-purple-700 shadow-purple-500/30", brillo: "bg-purple-500/20" },
};
