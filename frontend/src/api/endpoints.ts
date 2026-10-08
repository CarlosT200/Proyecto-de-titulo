import { api } from "./client";
import type {
  AlicuotasGastoComun,
  CobroGastoComunDetalle,
  MedioPago,
  MetodoProrrateo,
  MiCuentaGastoComun,
  PeriodoGastoComun,
  PeriodoGastoComunDetalle,
  UnidadMorosa,
  AlertaSos,
  Comunicado,
  Condominio,
  Departamento,
  Documento,
  Encomienda,
  EspacioComun,
  Incidencia,
  Indicadores,
  RegistroAuditoria,
  Multa,
  Notificacion,
  Reserva,
  Rol,
  TipoEmergenciaSos,
  Torre,
  Usuario,
  Visita,
} from "../types";
import type { DetalleAccesoData } from "../components/DetalleAcceso";

// --- Auth ---
export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ token: string; usuario: Usuario }>("/auth/login", { email, password }).then((r) => r.data),
  me: () => api.get<Usuario>("/auth/me").then((r) => r.data),
  actualizarPerfil: (data: { nombre?: string; apellido?: string; telefono?: string | null }) =>
    api.patch<Usuario>("/auth/me", data).then((r) => r.data),
  subirFoto: (foto: File) => {
    const formData = new FormData();
    formData.append("foto", foto);
    return api.patch<Usuario>("/auth/me/foto", formData, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
  },
  // devuelve una sesion nueva: al cambiar la contraseña se cierran las sesiones anteriores
  cambiarPassword: (actual: string, nueva: string) =>
    api.patch<{ token: string; usuario: Usuario }>("/auth/me/password", { actual, nueva }).then((r) => r.data),
};

// --- Usuarios (HU-02) ---
export const usuariosApi = {
  listar: (params?: { rol?: Rol; activo?: boolean }) =>
    api.get<Usuario[]>("/usuarios", { params }).then((r) => r.data),
  crear: (data: {
    nombre: string;
    apellido: string;
    email: string;
    password: string;
    rol: Rol;
    telefono?: string;
    departamentoId?: string | null;
  }) => api.post<Usuario>("/usuarios", data).then((r) => r.data),
  actualizar: (id: string, data: Partial<Pick<Usuario, "nombre" | "apellido" | "telefono" | "departamentoId" | "activo">>) =>
    api.patch<Usuario>(`/usuarios/${id}`, data).then((r) => r.data),
  restablecerPassword: (id: string, password: string) =>
    api.post(`/usuarios/${id}/restablecer-password`, { password }).then(() => undefined),
};

// --- Condominio (HU-03) ---
export const condominioApi = {
  obtener: () => api.get<Condominio>("/condominio").then((r) => r.data),
  actualizar: (data: Partial<Pick<Condominio, "nombre" | "direccion" | "comuna">>) =>
    api.patch<Condominio>("/condominio", data).then((r) => r.data),
  listarTorres: () => api.get<Torre[]>("/condominio/torres").then((r) => r.data),
  crearTorre: (nombre: string) => api.post<Torre>("/condominio/torres", { nombre }).then((r) => r.data),
  listarDepartamentos: () => api.get<Departamento[]>("/condominio/departamentos").then((r) => r.data),
  crearDepartamento: (data: { numero: string; torreId?: string | null }) =>
    api.post<Departamento>("/condominio/departamentos", data).then((r) => r.data),
  listarEspacios: (soloActivos = false) =>
    api.get<EspacioComun[]>("/condominio/espacios-comunes", { params: { activos: soloActivos } }).then((r) => r.data),
  crearEspacio: (data: {
    nombre: string;
    descripcion?: string;
    capacidad?: number;
    horarioInicio: string;
    horarioFin: string;
  }) => api.post<EspacioComun>("/condominio/espacios-comunes", data).then((r) => r.data),
  actualizarEspacio: (id: string, data: Partial<EspacioComun>) =>
    api.patch<EspacioComun>(`/condominio/espacios-comunes/${id}`, data).then((r) => r.data),
};

// --- Reservas (HU-04, HU-05) ---
export const reservasApi = {
  disponibilidad: (espacioComunId: string, fecha: string) =>
    api
      .get<{ espacio: EspacioComun; horariosOcupados: { horaInicio: string; horaFin: string }[] }>(
        "/reservas/disponibilidad",
        { params: { espacioComunId, fecha } }
      )
      .then((r) => r.data),
  crear: (data: { espacioComunId: string; fecha: string; horaInicio: string; horaFin: string }) =>
    api.post<Reserva>("/reservas", data).then((r) => r.data),
  mias: () => api.get<Reserva[]>("/reservas/mias").then((r) => r.data),
  listarTodas: () => api.get<Reserva[]>("/reservas").then((r) => r.data),
  cancelar: (id: string) => api.patch<Reserva>(`/reservas/${id}/cancelar`).then((r) => r.data),
};

// --- Multas (HU-06, HU-07) ---
export const multasApi = {
  crear: (data: { usuarioId: string; motivo: string; fecha: string; monto: number; observaciones?: string }) =>
    api.post<Multa>("/multas", data).then((r) => r.data),
  mias: () => api.get<Multa[]>("/multas/mias").then((r) => r.data),
  listarTodas: (params?: { estado?: string; usuarioId?: string }) =>
    api.get<Multa[]>("/multas", { params }).then((r) => r.data),
  actualizar: (id: string, data: { estado?: string; observaciones?: string }) =>
    api.patch<Multa>(`/multas/${id}`, data).then((r) => r.data),
  eliminar: (id: string) => api.delete(`/multas/${id}`),
  // el residente apela una multa suya que sigue pendiente
  apelar: (id: string, motivo: string) => api.patch(`/multas/${id}/apelar`, { motivo }).then((r) => r.data),
};

// --- Incidencias (HU-08 a HU-11, HU-25) ---
export const incidenciasApi = {
  crear: (data: FormData) =>
    api.post<Incidencia>("/incidencias", data, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data),
  mias: () => api.get<Incidencia[]>("/incidencias/mias").then((r) => r.data),
  listarTodas: (params?: { estado?: string; prioridad?: string }) =>
    api.get<Incidencia[]>("/incidencias", { params }).then((r) => r.data),
  obtener: (id: string) => api.get<Incidencia>(`/incidencias/${id}`).then((r) => r.data),
  actualizar: (
    id: string,
    data: Partial<{
      estado: string;
      prioridad: string;
      categoria: string;
      responsableId: string | null;
      observacion: string;
    }>
  ) => api.patch<Incidencia>(`/incidencias/${id}`, data).then((r) => r.data),
};

// --- Encomiendas (HU-12 a HU-14) ---
export const encomiendasApi = {
  // multipart: puede llevar una foto
  crear: (data: FormData) =>
    api.post<Encomienda>("/encomiendas", data, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data),
  mias: () => api.get<Encomienda[]>("/encomiendas/mias").then((r) => r.data),
  listarTodas: (params?: { estado?: string }) =>
    api.get<Encomienda[]>("/encomiendas", { params }).then((r) => r.data),
  // detalle con la foto
  obtener: (id: string) => api.get<Encomienda>(`/encomiendas/${id}`).then((r) => r.data),
  entregar: (id: string, retiradaPor?: string) =>
    api.patch<Encomienda>(`/encomiendas/${id}/retirar`, { retiradaPor }).then((r) => r.data),
  devolver: (id: string, motivo: string) =>
    api.patch<Encomienda>(`/encomiendas/${id}/devolver`, { motivo }).then((r) => r.data),
};

// --- Comunicados (HU-15, HU-16) ---
export const comunicadosApi = {
  crear: (data: { titulo: string; contenido: string; tipo: string }) =>
    api.post<Comunicado>("/comunicados", data).then((r) => r.data),
  listar: () => api.get<Comunicado[]>("/comunicados").then((r) => r.data),
  eliminar: (id: string) => api.delete(`/comunicados/${id}`),
};

// --- QR / Visitas (HU-17 a HU-21) ---
export const qrApi = {
  generarQrResidente: () => api.post<{ qrDataUrl: string; expiraEn: string }>("/qr/residente").then((r) => r.data),
  crearVisita: (data: {
    nombreVisita: string;
    fecha: string;
    periodoInicio: string;
    periodoFin: string;
    observaciones?: string;
    soloUnUso: boolean;
  }) => api.post<Visita>("/qr/visitas", data).then((r) => r.data),
  misVisitas: () => api.get<Visita[]>("/qr/visitas/mias").then((r) => r.data),
  generarQrVisita: (visitaId: string) =>
    api.post<{ qrDataUrl: string; expiraEn: string }>(`/qr/visitas/${visitaId}/qr`).then((r) => r.data),
  crearVisitaRapida: (nombreVisita?: string) =>
    api
      .post<{ visitaId: string; nombreVisita: string; qrDataUrl: string; expiraEn: string }>("/qr/visitas/rapida", {
        nombreVisita,
      })
      .then((r) => r.data),
  revocarVisita: (visitaId: string) => api.patch(`/qr/visitas/${visitaId}/revocar`).then((r) => r.data),
  validar: (token: string) =>
    api
      .post<{ resultado: "AUTORIZADO" | "RECHAZADO"; motivo: string; detalle?: DetalleAccesoData }>("/qr/validar", {
        token,
      })
      .then((r) => r.data),
  accesos: () => api.get<AccesoLog[]>("/qr/accesos").then((r) => r.data),
};

export interface AccesoLog {
  id: string;
  resultado: "AUTORIZADO" | "RECHAZADO";
  motivo: string;
  createdAt: string;
  validadoPor: { id: string; nombre: string; apellido: string };
  detalle?: DetalleAccesoData;
}

// --- Documentos (HU-22, HU-23) ---
export const documentosApi = {
  crear: (data: FormData) =>
    api.post<Documento>("/documentos", data, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data),
  listar: () => api.get<Documento[]>("/documentos").then((r) => r.data),
  eliminar: (id: string) => api.delete(`/documentos/${id}`),
  // enlace temporal (2 minutos) para abrir el archivo en una pestaña nueva
  crearEnlace: (id: string) => api.post<{ url: string }>(`/documentos/${id}/enlace`).then((r) => r.data),
};

// --- Dashboard (HU-24) ---
export const dashboardApi = {
  indicadores: () => api.get<Indicadores>("/dashboard").then((r) => r.data),
  conserjeria: () => api.get<PanelConserjeria>("/dashboard/conserjeria").then((r) => r.data),
};

export interface PanelConserjeria {
  encomiendas: { pendientes: number; atrasadas: number };
  sos: { activas: number; alertas: AlertaSos[] };
  accesos: { hoyAutorizados: number; hoyRechazados: number; recientes: AccesoLog[] };
}

// --- Registro de actividad (RNF-06) ---
export const auditoriaApi = {
  listar: (entidad?: string) =>
    api.get<RegistroAuditoria[]>("/auditoria", { params: entidad ? { entidad } : {} }).then((r) => r.data),
};

// --- Notificaciones ---
export const notificacionesApi = {
  listar: () => api.get<Notificacion[]>("/notificaciones").then((r) => r.data),
  leerTodas: () => api.patch("/notificaciones/leer-todas"),
  leer: (id: string) => api.patch(`/notificaciones/${id}/leer`),
  eliminar: (id: string) => api.delete(`/notificaciones/${id}`),
  eliminarTodas: () => api.delete("/notificaciones"),
};

// --- SOS ---
export const sosApi = {
  crear: (tipo: TipoEmergenciaSos) => api.post<AlertaSos>("/sos", { tipo }).then((r) => r.data),
  listar: () => api.get<AlertaSos[]>("/sos").then((r) => r.data),
  atender: (id: string, observacion?: string) =>
    api.patch<AlertaSos>(`/sos/${id}/atender`, { observacion }).then((r) => r.data),
};

// --- Web Push ---
export const pushApi = {
  vapidPublicKey: () => api.get<{ publicKey: string | null }>("/push/vapid-public-key").then((r) => r.data),
  suscribir: (suscripcion: { endpoint: string; keys: { p256dh: string; auth: string } }) =>
    api.post("/push/suscribir", suscripcion),
  eliminar: (endpoint: string) => api.delete("/push/suscribir", { data: { endpoint } }),
};

// --- Gastos comunes ---
export const gastosComunesApi = {
  periodos: () => api.get<PeriodoGastoComun[]>("/gastos-comunes/periodos").then((r) => r.data),
  periodo: (id: string) => api.get<PeriodoGastoComunDetalle>(`/gastos-comunes/periodos/${id}`).then((r) => r.data),
  emitir: (data: {
    anio: number;
    mes: number;
    fechaVencimiento: string;
    metodoProrrateo: MetodoProrrateo;
    porcentajeFondoReserva: number;
    partidas: { concepto: string; monto: number }[];
    instruccionesPago?: string;
  }) =>
    api
      .post<{ id: string; nombre: string; unidades: number; totalCobrado: number }>("/gastos-comunes/periodos", data)
      .then((r) => r.data),
  eliminarPeriodo: (id: string) => api.delete(`/gastos-comunes/periodos/${id}`).then(() => undefined),
  morosidad: () => api.get<UnidadMorosa[]>("/gastos-comunes/morosidad").then((r) => r.data),
  cobro: (id: string) => api.get<CobroGastoComunDetalle>(`/gastos-comunes/cobros/${id}`).then((r) => r.data),
  registrarPago: (cobroId: string, data: { monto: number; fechaPago: string; medio: MedioPago; referencia?: string }) =>
    api
      .post<{ unidad: string; periodo: string; saldo: number; pagado: boolean }>(`/gastos-comunes/cobros/${cobroId}/pagos`, data)
      .then((r) => r.data),
  anularPago: (pagoId: string, motivo: string) =>
    api.patch(`/gastos-comunes/pagos/${pagoId}/anular`, { motivo }).then((r) => r.data),
  alicuotas: () => api.get<AlicuotasGastoComun>("/gastos-comunes/alicuotas").then((r) => r.data),
  guardarAlicuotas: (alicuotas: { departamentoId: string; alicuota: number | null }[]) =>
    api.put<AlicuotasGastoComun>("/gastos-comunes/alicuotas", { alicuotas }).then((r) => r.data),
  miCuenta: () => api.get<MiCuentaGastoComun>("/gastos-comunes/mi-cuenta").then((r) => r.data),
};
