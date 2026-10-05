import { z } from "zod";
import { MedioPago, MetodoProrrateo } from "@prisma/client";
import { fechaCalendario } from "../../lib/fechas";
import { TOTAL_MAXIMO_MES } from "../../lib/gastosComunes";

const textoOpcional = (max: number, mensaje: string) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(max, mensaje).optional());

const montoEnPesos = z
  .number({ required_error: "Indica el monto.", invalid_type_error: "El monto debe ser un número." })
  .int("El monto debe ser un número entero de pesos.")
  .positive("El monto debe ser mayor a cero.")
  .max(TOTAL_MAXIMO_MES, "El monto es demasiado alto.");

export const crearPeriodoSchema = z
  .object({
    anio: z
      .number({ required_error: "Indica el año.", invalid_type_error: "Indica el año." })
      .int("Indica el año.")
      .min(2020, "Indica un año válido.")
      .max(2100, "Indica un año válido."),
    mes: z
      .number({ required_error: "Indica el mes.", invalid_type_error: "Indica el mes." })
      .int("Indica el mes.")
      .min(1, "Indica el mes.")
      .max(12, "Indica el mes."),
    fechaVencimiento: fechaCalendario,
    metodoProrrateo: z.nativeEnum(MetodoProrrateo, { errorMap: () => ({ message: "Elige cómo repartir el gasto." }) }),
    porcentajeFondoReserva: z
      .number({ required_error: "Indica el porcentaje del fondo de reserva.", invalid_type_error: "Indica el porcentaje del fondo de reserva." })
      .int("Usa un porcentaje entero.")
      .min(0, "El porcentaje no puede ser negativo.")
      .max(100, "El porcentaje puede ser hasta 100."),
    partidas: z
      .array(
        z.object({
          concepto: z
            .string({ required_error: "Describe cada gasto." })
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
  medio: z.nativeEnum(MedioPago, { errorMap: () => ({ message: "Elige el medio de pago." }) }),
  referencia: textoOpcional(60, "El número de comprobante puede tener hasta 60 caracteres."),
});

export const anularPagoSchema = z.object({
  motivo: z
    .string({ required_error: "Indica por qué se anula el pago." })
    .trim()
    .min(5, "Explica en pocas palabras por qué se anula el pago.")
    .max(300, "El motivo puede tener hasta 300 caracteres."),
});

export const guardarAlicuotasSchema = z.object({
  alicuotas: z
    .array(
      z.object({
        departamentoId: z.string().uuid("Una de las unidades no es válida."),
        alicuota: z
          .number({ invalid_type_error: "Cada alícuota debe ser un número." })
          .positive("Cada alícuota debe ser mayor a cero.")
          .max(100, "Una alícuota no puede superar el 100 %.")
          .nullable(),
      })
    )
    .min(1, "No hay unidades para actualizar.")
    .max(5000, "Hay demasiadas unidades en un solo envío."),
});
