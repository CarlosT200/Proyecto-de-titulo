import { Siren } from "@phosphor-icons/react";
import { useConfigPublica } from "../context/configPublica";

// Franja visible en toda la app cuando el servidor esta en modo demostracion del SOS
// (SOS_MODO_DEMO=true). Sirve para comprobar de un vistazo, antes de tocar nada, que el boton SOS
// no va a llamar a un numero real. No se muestra en operacion real ni mientras no se sepa el modo.
export function BannerModoDemo() {
  const configPublica = useConfigPublica();
  if (configPublica.estado !== "ok" || !configPublica.config.sosModoDemo) return null;
  return (
    <div
      role="status"
      data-testid="banner-modo-demo"
      className="flex items-center justify-center gap-2 border-b border-amber-300 bg-amber-100 px-4 py-1.5 text-center text-xs font-semibold text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-200"
    >
      <Siren size={14} weight="fill" aria-hidden />
      <span>
        Modo demostración: el botón SOS avisa a conserjería pero <strong>no llama</strong> a números de emergencia reales.
      </span>
    </div>
  );
}
