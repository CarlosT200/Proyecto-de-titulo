export type Rol = "ADMIN" | "RESIDENTE" | "CONSERJE";

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: Rol;
  condominioId: string;
  departamentoId: string | null;
  telefono?: string | null;
  activo?: boolean;
  fotoUrl?: string | null;
  debeCambiarPassword?: boolean;
  departamento?: { id: string; numero: string; torre: { nombre: string } | null } | null;
  condominio?: { id: string; nombre: string } | null;
}

export interface Condominio {
  id: string;
  nombre: string;
  direccion: string | null;
  comuna: string | null;
  torres: Torre[];
  espaciosComunes: EspacioComun[];
}

export interface Torre {
  id: string;
  nombre: string;
}

export interface Departamento {
  id: string;
  numero: string;
  torre: Torre | null;
  residentes: { id: string; nombre: string; apellido: string }[];
}

export interface EspacioComun {
  id: string;
  nombre: string;
  descripcion?: string | null;
  capacidad?: number | null;
  horarioInicio: string;
  horarioFin: string;
  activo: boolean;
}

export type EstadoReserva = "CONFIRMADA" | "CANCELADA";

export interface Reserva {
  id: string;
  espacioComunId: string;
  espacioComun: EspacioComun;
  usuarioId: string;
  usuario?: Usuario;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  estado: EstadoReserva;
}

export type EstadoMulta = "PENDIENTE" | "PAGADA" | "APELADA" | "ANULADA";

export interface Multa {
  id: string;
  usuarioId: string;
  usuario?: Usuario;
  motivo: string;
  fecha: string;
  monto: number;
  estado: EstadoMulta;
  observaciones?: string | null;
  apelacion?: string | null;
  apeladaEn?: string | null;
}

export type EstadoIncidencia = "REPORTADA" | "EN_REVISION" | "EN_PROCESO" | "RESUELTA";
export type PrioridadIncidencia = "BAJA" | "MEDIA" | "ALTA";

export interface SugerenciaIA {
  categoria: string;
  prioridad: PrioridadIncidencia;
  ubicacionDetectada: string | null;
  confianza: "baja" | "media" | "alta";
}

export interface IncidenciaHistorialItem {
  id: string;
  estadoAnterior: string | null;
  estadoNuevo: string;
  observacion?: string | null;
  usuario: { id: string; nombre: string; apellido: string };
  createdAt: string;
}

export interface Incidencia {
  id: string;
  titulo: string;
  descripcion: string;
  ubicacion: string;
  fotoUrl?: string | null;
  tieneFoto?: boolean;
  usuarioId?: string;
  categoria?: string | null;
  prioridad?: PrioridadIncidencia | null;
  estado: EstadoIncidencia;
  responsableId?: string | null;
  responsable?: { id: string; nombre: string; apellido: string } | null;
  usuario?: Usuario;
  sugerenciaIA?: SugerenciaIA | null;
  historial?: IncidenciaHistorialItem[];
  createdAt: string;
  updatedAt?: string;
}

export type EstadoEncomienda = "NOTIFICADA" | "RETIRADA" | "DEVUELTA";

export interface PersonaBreve {
  id: string;
  nombre: string;
  apellido: string;
}

export interface Encomienda {
  id: string;
  usuarioId: string;
  usuario?: PersonaBreve & { departamento: { numero: string; torre: { nombre: string } | null } | null };
  registradaPor?: PersonaBreve;
  cerradaPor?: PersonaBreve | null;
  remitente?: string | null;
  numeroSeguimiento?: string | null;
  ubicacion?: string | null;
  observaciones?: string | null;
  estado: EstadoEncomienda;
  fechaRecepcion: string;
  fechaRetiro?: string | null;
  retiradaPor?: string | null;
  fechaDevolucion?: string | null;
  motivoDevolucion?: string | null;
  tieneFoto: boolean;
  fotoUrl?: string | null;
}

export type TipoComunicado =
  | "CORTE_AGUA"
  | "CORTE_ELECTRICO"
  | "MANTENCION"
  | "REUNION"
  | "EMERGENCIA"
  | "CAMBIO_HORARIO"
  | "GENERAL";

export interface Comunicado {
  id: string;
  titulo: string;
  contenido: string;
  tipo: TipoComunicado;
  autor: { id: string; nombre: string; apellido: string };
  createdAt: string;
}

export type EstadoVisita = "VIGENTE" | "USADA" | "EXPIRADA" | "REVOCADA";

export interface Visita {
  id: string;
  nombreVisita: string;
  fecha: string;
  periodoInicio: string;
  periodoFin: string;
  observaciones?: string | null;
  soloUnUso: boolean;
  estado: EstadoVisita;
  qrToken?: { expiraEn: string; revocado: boolean; usosRealizados: number } | null;
}

export interface Documento {
  id: string;
  titulo: string;
  categoria?: string | null;
  createdAt: string;
}

export type TipoEmergenciaSos = "CARABINEROS" | "BOMBEROS" | "AMBULANCIA";
export type EstadoAlertaSos = "ACTIVA" | "ATENDIDA";

export interface AlertaSos {
  id: string;
  tipo: TipoEmergenciaSos;
  estado: EstadoAlertaSos;
  atendidaEn?: string | null;
  observacion?: string | null;
  atendidaPor?: (PersonaBreve & { rol: Rol }) | null;
  createdAt: string;
  usuario: {
    id: string;
    nombre: string;
    apellido: string;
    departamento: { numero: string; torre: Torre | null } | null;
  };
}

export interface Notificacion {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  createdAt: string;
  entidadTipo?: string | null;
  entidadId?: string | null;
}

export type AccionAuditoria = "CREAR" | "ACTUALIZAR" | "ELIMINAR" | "CANCELAR";

export interface RegistroAuditoria {
  id: string;
  accion: AccionAuditoria;
  entidad: string;
  entidadId: string | null;
  descripcion: string;
  createdAt: string;
  usuario: { id: string; nombre: string; apellido: string; rol: string } | null;
}

export interface Indicadores {
  atencion: {
    sosActivas: number;
    incidenciasUrgentes: number;
    incidenciasSinRevisar: number;
    multasApeladas: number;
    encomiendasAtrasadas: number;
    unidadesMorosas: number;
  };
  incidencias: {
    pendientes: number;
    resueltas: number;
    porEstado: Record<EstadoIncidencia, number>;
    promedioHorasResolucion: number | null;
  };
  reservas: { proximas: number };
  multas: Record<EstadoMulta, number>;
  encomiendas: { pendientesDeRetiro: number; atrasadas: number };
  sos: { activas: number };
  gastosComunes: { deudaVencida: number; unidadesMorosas: number };
  accesos: {
    recientes: { id: string; resultado: "AUTORIZADO" | "RECHAZADO"; motivo: string; createdAt: string; validadoPor: { nombre: string; apellido: string } }[];
    autorizadosUltimos10: number;
    totalAutorizados: number;
    totalRechazados: number;
    hoyAutorizados: number;
    hoyRechazados: number;
  };
}

// --- Gastos comunes ---
export type MetodoProrrateo = "PARTES_IGUALES" | "ALICUOTA";
export type MedioPago = "TRANSFERENCIA" | "EFECTIVO" | "TARJETA" | "CHEQUE" | "OTRO";
export type EstadoCobro = "PAGADO" | "PENDIENTE" | "VENCIDO";

export interface PersonaBreve {
  id: string;
  nombre: string;
  apellido: string;
}

export interface UnidadGastoComun {
  id: string;
  numero: string;
  torre: { nombre: string } | null;
  // solo para la administracion
  residentes?: PersonaBreve[];
}

export interface PartidaGastoComun {
  id: string;
  concepto: string;
  monto: number;
}

export interface PeriodoGastoComun {
  id: string;
  anio: number;
  mes: number;
  fechaVencimiento: string;
  metodoProrrateo: MetodoProrrateo;
  porcentajeFondoReserva: number;
  totalGastos: number;
  instruccionesPago: string | null;
  createdAt: string;
  totalCobrado: number;
  totalPagado: number;
  unidades: number;
  unidadesPagadas: number;
  vencido: boolean;
}

export interface CobroGastoComunFila {
  id: string;
  departamento: UnidadGastoComun;
  montoGastoComun: number;
  montoFondoReserva: number;
  montoTotal: number;
  montoPagado: number;
  saldo: number;
  estado: EstadoCobro;
}

export interface PeriodoGastoComunDetalle {
  id: string;
  anio: number;
  mes: number;
  fechaVencimiento: string;
  metodoProrrateo: MetodoProrrateo;
  porcentajeFondoReserva: number;
  totalGastos: number;
  instruccionesPago: string | null;
  partidas: PartidaGastoComun[];
  cobros: CobroGastoComunFila[];
  puedeEliminar: boolean;
}

export interface PagoGastoComun {
  id: string;
  monto: number;
  fechaPago: string;
  medio: MedioPago;
  referencia: string | null;
  anuladoEn: string | null;
  motivoAnulacion: string | null;
  createdAt: string;
  // solo para la administracion
  registradoPor?: { nombre: string; apellido: string };
  anuladoPor?: { nombre: string; apellido: string } | null;
}

export interface CobroGastoComunDetalle {
  id: string;
  montoGastoComun: number;
  montoFondoReserva: number;
  montoTotal: number;
  montoPagado: number;
  saldo: number;
  estado: EstadoCobro;
  departamento: UnidadGastoComun;
  periodo: {
    id: string;
    anio: number;
    mes: number;
    fechaVencimiento: string;
    metodoProrrateo: MetodoProrrateo;
    porcentajeFondoReserva: number;
    totalGastos: number;
    instruccionesPago: string | null;
    partidas: PartidaGastoComun[];
  };
  pagos: PagoGastoComun[];
}

export interface UnidadMorosa {
  departamento: UnidadGastoComun;
  deuda: number;
  cobros: { id: string; periodo: { id: string; anio: number; mes: number; fechaVencimiento: string }; saldo: number }[];
}

export interface MiCuentaGastoComun {
  unidad: UnidadGastoComun | null;
  saldoPendiente: number;
  deudaVencida: number;
  cobrosVencidos: number;
  proximoVencimiento: string | null;
  instruccionesPago: string | null;
  cobros: {
    id: string;
    montoTotal: number;
    montoPagado: number;
    saldo: number;
    estado: EstadoCobro;
    periodo: { anio: number; mes: number; fechaVencimiento: string };
  }[];
}

export interface AlicuotasGastoComun {
  unidades: { id: string; numero: string; torre: { nombre: string } | null; alicuota: number | null }[];
  suma: number;
}
