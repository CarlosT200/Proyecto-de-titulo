import { z } from "zod";

// Mensajes de validacion en español para los casos que un esquema no personaliza. Sin esto, Zod
// responde en ingles ("Invalid input", "Invalid UUID"...) y esos textos llegaban a la pantalla.
// Los mensajes escritos en cada esquema siguen teniendo prioridad (Zod 4: esquema > parse > global).
export const mapaDeErroresEnEspanol: z.core.$ZodErrorMap = (issue) => {
  switch (issue.code) {
    case "invalid_type":
      if (issue.input === undefined || issue.input === null) return "Falta un dato obligatorio.";
      return "Uno de los datos no tiene el formato esperado.";
    case "invalid_format":
      if (issue.format === "email") return "Ingresa un correo válido.";
      if (issue.format === "uuid" || issue.format === "guid") return "El identificador enviado no es válido.";
      if (issue.format === "datetime") return "La fecha y hora no son válidas.";
      return "El formato de un dato no es válido.";
    case "too_small":
      if (issue.origin === "string") {
        return issue.minimum === 1 ? "Falta un dato obligatorio." : `Debe tener al menos ${issue.minimum} caracteres.`;
      }
      if (issue.origin === "number") return `El valor debe ser mayor o igual a ${issue.minimum}.`;
      return "Faltan datos.";
    case "too_big":
      if (issue.origin === "string") return `Puede tener hasta ${issue.maximum} caracteres.`;
      if (issue.origin === "number") return `El valor debe ser menor o igual a ${issue.maximum}.`;
      return "Hay demasiados datos.";
    case "invalid_value":
      return "Elige una de las opciones disponibles.";
    default:
      return "Uno de los datos no es válido.";
  }
};

z.config({ customError: mapaDeErroresEnEspanol });
