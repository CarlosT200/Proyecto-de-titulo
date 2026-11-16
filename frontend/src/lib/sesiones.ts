// Convierte un User-Agent en una descripcion corta y entendible ("Chrome en Android"). Es solo para
// que la persona reconozca sus sesiones: no necesita ser exacto para cada navegador raro.
export function describirAgente(agente: string | null | undefined): { texto: string; movil: boolean } {
  if (!agente) return { texto: "Dispositivo desconocido", movil: false };
  const ua = agente;

  const sistema = /iPhone|iPad|iPod/.test(ua)
    ? "iPhone"
    : /Android/.test(ua)
      ? "Android"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X|Macintosh/.test(ua)
          ? "Mac"
          : /Linux/.test(ua)
            ? "Linux"
            : null;

  const navegador = /HabitaSmart|Electron/.test(ua)
    ? "App de escritorio"
    : /Edg\//.test(ua)
      ? "Edge"
      : /OPR\/|Opera/.test(ua)
        ? "Opera"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Chrome\//.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : "Navegador";

  const movil = sistema === "iPhone" || sistema === "Android";
  return { texto: sistema ? `${navegador} en ${sistema}` : navegador, movil };
}
