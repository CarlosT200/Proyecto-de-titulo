// --- Guardia del seed de demostracion (Fase 2J) --------------------------------------------------
// El seed crea cuentas con una contraseña PUBLICA (esta en el repositorio). Ejecutarlo por error
// contra la base de un condominio real dejaria tres cuentas con acceso conocido. Por eso solo corre
// sin preguntar contra bases claramente locales o de prueba; contra cualquier otra exige un permiso
// explicito por variable de entorno.

export interface ResultadoGuardia {
  permitido: boolean;
  motivo: string;
}

function datosDeUrl(databaseUrl: string): { host: string; base: string } | null {
  try {
    const url = new URL(databaseUrl);
    return { host: url.hostname.toLowerCase(), base: url.pathname.replace(/^\//, "").toLowerCase() };
  } catch {
    return null;
  }
}

const HOSTS_LOCALES = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "postgres", "db"]);

export function evaluarEntornoSeed(opciones: { databaseUrl: string | undefined; permiso: string | undefined }): ResultadoGuardia {
  if (!opciones.databaseUrl) return { permitido: false, motivo: "Falta DATABASE_URL." };
  const datos = datosDeUrl(opciones.databaseUrl);
  if (!datos) return { permitido: false, motivo: "DATABASE_URL no es una URL válida." };

  if (HOSTS_LOCALES.has(datos.host)) return { permitido: true, motivo: "base local" };
  if (/_(test|demo)$/.test(datos.base)) return { permitido: true, motivo: `base de prueba o demostración (${datos.base})` };

  if (opciones.permiso === "si") {
    return { permitido: true, motivo: "permiso explícito (PERMITIR_SEED_DEMO=si) sobre una base remota" };
  }
  return {
    permitido: false,
    motivo:
      "La base de datos no es local ni de prueba. El seed crea cuentas con una contraseña pública: " +
      "no se ejecuta sobre una base real. Si de verdad es una base de demostración, vuelve a correrlo con PERMITIR_SEED_DEMO=si.",
  };
}
