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
  categoria?: string | null;
  prioridad?: PrioridadIncidencia | null;
  estado: EstadoIncidencia;
  responsableId?: string | null;
  responsable?: { id: string; nombre: string; apellido: string } | null;
  usuario?: Usuario;
  sugerenciaIA?: SugerenciaIA | null;
  historial?: IncidenciaHistorialItem[];
  createdAt: string;
}

export type EstadoEncomienda = "NOTIFICADA" | "RETIRADA";

export interface Encomienda {
  id: string;
  usuarioId: string;
  usuario?: Usuario;
  remitente?: string | null;
  estado: EstadoEncomienda;
  fechaRecepcion: string;
  fechaRetiro?: string | null;
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
  archivoUrl: string;
  createdAt: string;
}

export type TipoEmergenciaSos = "CARABINEROS" | "BOMBEROS" | "AMBULANCIA";

export interface AlertaSos {
  id: string;
  tipo: TipoEmergenciaSos;
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
  incidencias: { pendientes: number; resueltas: number; porEstado: Record<EstadoIncidencia, number> };
  reservas: { proximas: number };
  multas: Record<EstadoMulta, number>;
  encomiendas: { pendientesDeRetiro: number };
  accesos: {
    recientes: { id: string; resultado: "AUTORIZADO" | "RECHAZADO"; motivo: string; createdAt: string; validadoPor: { nombre: string; apellido: string } }[];
    autorizadosUltimos10: number;
    totalAutorizados: number;
    totalRechazados: number;
  };
}
