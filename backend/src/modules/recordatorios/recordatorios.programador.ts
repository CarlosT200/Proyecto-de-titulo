import { enviarRecordatorios } from "./recordatorios.service";

const CADA_MS = 60 * 60 * 1000;

let enCurso = false;

export async function correrRecordatorios(origen: string) {
  if (enCurso) return null;
  enCurso = true;
  try {
    const r = await enviarRecordatorios();
    const total = r.gastoPorVencer + r.gastoVencido + r.encomiendas;
    if (total > 0) console.log(`[recordatorios] (${origen}) enviados: ${JSON.stringify(r)}`);
    return r;
  } catch (error) {
    console.error("[recordatorios] Falló la revisión:", error);
    return null;
  } finally {
    enCurso = false;
  }
}

// Revisa al minuto de iniciar y despues cada hora mientras el servidor esta encendido. En el plan
// gratis de Render el servidor se duerme sin visitas: para que igual corra cada hora, una tarea de
// GitHub Actions llama a POST /api/tareas/recordatorios (ver .github/workflows/recordatorios.yml).
export function programarRecordatorios() {
  setTimeout(() => void correrRecordatorios("inicio"), 60 * 1000).unref();
  setInterval(() => void correrRecordatorios("cada hora"), CADA_MS).unref();
}
