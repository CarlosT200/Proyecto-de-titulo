import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
});

const TOKEN_KEY = "habitasmart_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearToken();
      if (!window.location.pathname.startsWith("/login")) {
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
