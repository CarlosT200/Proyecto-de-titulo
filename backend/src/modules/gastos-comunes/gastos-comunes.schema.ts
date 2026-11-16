import { z } from "zod";
import { MedioPago, MetodoProrrateo } from "@prisma/client";
import { fechaCalendario } from "../../lib/fechas";
import { TOTAL_MAXIMO_MES } from "../../lib/gastosComunes";

const textoOpcional = (max: number, mensaje: string) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(max, mensaje).optional());

// Mensaje distinto segun falte el dato o venga con otro tipo (Zod 4: una sola funcion "error").
const numeroObligatorio = (faltante: string, tipoInvalido: string) =>
  z.number({
    error: (issue) => (issue.code === "invalid_type" ? (issue.input === undefined ? faltante : tipoInvalido) : undefined),
  });

const montoEnPesos = numeroObligatorio("Indica el monto.", "El monto debe ser un número.")
  .int("El monto debe ser un número entero de pesos.")
  .positive("El monto debe ser mayor a cero.")
  .max(TOTAL_MAXIMO_MES, "El monto es demasiado alto.");

export const crearPeriodoSchema = z
  .object({
    anio: numeroObligatorio("Indica el año.", "Indica el año.")
      .int("Indica el año.")
      .min(2020, "Indica un año válido.")
      .max(2100, "Indica un año válido."),
    mes: numeroObligatorio("Indica el mes.", "Indica el mes.").int("Indica el mes.").min(1, "Indica el mes.").max(12, "Indica el mes."),
    fechaVencimiento: fechaCalendario,
    metodoProrrateo: z.enum(MetodoProrrateo, { error: "Elige cómo repartir el gasto." }),
    porcentajeFondoReserva: numeroObligatorio("Indica el porcentaje del fondo de reserva.", "Indica el porcentaje del fondo de reserva.")
      .int("Usa un porcentaje entero.")
      .min(0, "El porcentaje no puede ser negativo.")
      .max(100, "El porcentaje puede ser hasta 100."),
    partidas: z
      .array(
        z.object({
          concepto: z
            .string({ error: "Describe cada gasto." })
            .trim()
            .min(2, "Describe cada gasto.")
            .max(80, "La descripción de un gasto puede tener hasta 80 caracteres."),
          monto: montoEnPesos,
        })
      )
      .min(1, "Agrega al menos un gasto del mes.")
      .max(40, "Puedes ingresar hasta 40 gastos."),
    instruccionesPago: textoOpcional(500, "Las instrucciones de pago pueden tener hasta 500 caracteres."),
  })
  .refine((d) => d.partidas.reduce((s, p) => s + p.monto, 0) <= TOTAL_MAXIMO_MES, {
    message: "El total del mes es demasiado alto.",
    path: ["partidas"],
  });

export const registrarPagoSchema = z.object({
  monto: montoEnPesos,
  fechaPago: fechaCalendario,
  medio: z.enum(MedioPago, { error: "Elige el medio de pago." }),
  referencia: textoOpcional(60, "El número de comprobante puede tener hasta 60 caracteres."),
});

export const anularPagoSchema = z.object({
  motivo: z
    .string({ error: "Indica por qué se anula el pago." })
    .trim()
    .min(5, "Explica en pocas palabras por qué se anula el pago.")
    .max(300, "El motivo puede tener hasta 300 caracteres."),
});

export const guardarAlicuotasSchema = z.object({
  alicuotas: z
    .array(
      z.object({
        departamentoId: z.uuid("Una de las unidades no es válida."),
        alicuota: z
          .number({ error: (issue) => (issue.code === "invalid_type" ? "Cada alícuota debe ser un número." : undefined) })
          .positive("Cada alícuota debe ser mayor a cero.")
          .max(100, "Una alícuota no puede superar el 100 %.")
          .nullable(),
      })
    )
    .min(1, "No hay unidades para actualizar.")
    .max(5000, "Hay demasiadas unidades en un solo envío."),
});

// Llega como formulario (con el archivo), asi que el monto viene como texto.
export const informarPagoSchema = z.object({
  monto: z.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : v), montoEnPesos),
  fechaPago: fechaCalendario,
  medio: z.enum(MedioPago, { error: "Elige el medio de pago." }),
  referencia: textoOpcional(60, "El número de comprobante puede tener hasta 60 caracteres."),
});

export const aprobarComprobanteSchema = z.object({
  // La administracion puede aprobar por un monto menor (por ejemplo, si la transferencia fue parcial).
  monto: montoEnPesos.optional(),
});

export const rechazarComprobanteSchema = z.object({
  motivo: z
    .string({ error: "Indica por qué se rechaza el comprobante." })
    .trim()
    .min(5, "Explica en pocas palabras por qué se rechaza (el residente lo verá).")
    .max(300, "El motivo puede tener hasta 300 caracteres."),
});
