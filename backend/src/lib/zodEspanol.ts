import { z, ZodIssueCode } from "zod";

// Mensajes de validacion en español para los casos que un esquema no personaliza. Sin esto, Zod
// responde en ingles ("Required", "Invalid uuid"...) y esos textos llegaban a la pantalla.
// Los mensajes escritos en cada esquema siguen teniendo prioridad.
export const mapaDeErroresEnEspanol: z.ZodErrorMap = (issue) => {
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === "undefined" || issue.received === "null") return { message: "Falta un dato obligatorio." };
      return { message: "Uno de los datos no tiene el formato esperado." };
    case ZodIssueCode.invalid_string:
      if (issue.validation === "email") return { message: "Ingresa un correo válido." };
      if (issue.validation === "uuid") return { message: "El identificador enviado no es válido." };
      if (issue.validation === "datetime") return { message: "La fecha y hora no son válidas." };
      return { message: "El formato de un dato no es válido." };
    case ZodIssueCode.too_small:
      if (issue.type === "string") {
        return { message: issue.minimum === 1 ? "Falta un dato obligatorio." : `Debe tener al menos ${issue.minimum} caracteres.` };
      }
      if (issue.type === "number") return { message: `El valor debe ser mayor o igual a ${issue.minimum}.` };
      return { message: "Faltan datos." };
    case ZodIssueCode.too_big:
      if (issue.type === "string") return { message: `Puede tener hasta ${issue.maximum} caracteres.` };
      if (issue.type === "number") return { message: `El valor debe ser menor o igual a ${issue.maximum}.` };
      return { message: "Hay demasiados datos." };
    case ZodIssueCode.invalid_enum_value:
      return { message: "Elige una de las opciones disponibles." };
    case ZodIssueCode.invalid_date:
      return { message: "La fecha no es válida." };
    default:
      return { message: "Uno de los datos no es válido." };
  }
};

z.setErrorMap(mapaDeErroresEnEspanol);
