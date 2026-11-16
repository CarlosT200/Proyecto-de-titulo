import axios from "axios";

// La sesion viaja en una cookie HttpOnly que escribe el servidor al iniciar sesion: este codigo
// nunca ve el token. Lo unico que lee es la cookie (legible a proposito) con el token anti-CSRF,
// que repite en una cabecera en cada pedido que modifica datos (ver backend/src/middleware/csrf.ts).
export const COOKIE_CSRF = "habitasmart_csrf";
export const CABECERA_CSRF = "X-CSRF-Token";

// Nombre con el que versiones anteriores guardaban el JWT en localStorage. Ya no se usa; se borra al
// arrancar para no dejar un token viejo al alcance de cualquier script.
const TOKEN_ANTIGUO = "habitasmart_token";

export const api = axios.create({
  baseURL: "/api",
  // La API vive en el mismo origen; "withCredentials" solo importa en desarrollo si el frontend se
  // sirviera desde otro puerto sin el proxy de Vite. Es explicito para que nunca se olvide.
  withCredentials: true,
});

export function leerCookie(nombre: string): string | null {
  if (typeof document === "undefined") return null;
  for (const parte of document.cookie.split(";")) {
    const [clave, ...resto] = parte.trim().split("=");
    if (clave === nombre) return decodeURIComponent(resto.join("="));
  }
  return null;
}

export function tokenCsrf(): string | null {
  return leerCookie(COOKIE_CSRF);
}

// La cookie de sesion no se puede leer (HttpOnly), pero la de CSRF se escribe y se borra junto con
// ella: si existe, hay una sesion que vale la pena comprobar con /auth/me.
export function haySesionLocal(): boolean {
  return tokenCsrf() !== null;
}

// Borra la copia local de la cookie CSRF (el servidor ya la invalido o la borro). Sin esto, tras un
// 401 la app seguiria creyendo que hay sesion hasta recargar.
export function olvidarSesionLocal(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_CSRF}=; Max-Age=0; path=/`;
}

export function limpiarTokenAntiguo(): void {
  try {
    localStorage.removeItem(TOKEN_ANTIGUO);
    sessionStorage.removeItem(TOKEN_ANTIGUO);
  } catch {
    // almacenamiento no disponible (modo privado estricto): no hay nada que limpiar
  }
}

const METODOS_SEGUROS = new Set(["get", "head", "options"]);

api.interceptors.request.use((config) => {
  const metodo = (config.method ?? "get").toLowerCase();
  if (!METODOS_SEGUROS.has(metodo)) {
    const csrf = tokenCsrf();
    if (csrf) config.headers[CABECERA_CSRF] = csrf;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      olvidarSesionLocal();
      const ruta = window.location.pathname;
      // Paginas publicas (login, QR abierto desde la camara, aviso de privacidad): no se redirige,
      // cada una decide que mostrar sin sesion.
      if (!ruta.startsWith("/login") && !ruta.startsWith("/acceso/") && !ruta.startsWith("/privacidad")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export function mensajeError(error: unknown, fallback = "Ocurrió un error. Intenta nuevamente."): string {
  if (axios.isAxiosError(error)) {
    // Sin respuesta del servidor (backend caido, sin conexion, etc.): nunca debe confundirse
    // con un error de negocio como "credenciales incorrectas".
    if (!error.response) {
      return "No se pudo conectar con el servidor. Revisa tu conexión a internet e intenta nuevamente.";
    }
    const data = error.response.data as { error?: string; detalles?: { campo: string; mensaje: string }[] };
    if (data?.detalles?.length) {
      return data.detalles.map((d) => d.mensaje).join(" ");
    }
    if (data?.error) return data.error;
  }
  // Errores que no vienen del backend (ej. permisos del navegador denegados,
  // notificaciones push no soportadas) -- su .message ya es un texto
  // pensado para mostrarse, no hace falta esconderlo detras del fallback.
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
