import { describe, expect, it } from "vitest";
import { PrioridadIncidencia } from "@prisma/client";
import { sugerirClasificacion } from "./clasificador-ia";

// HU-25 / RNF-14: es un motor de reglas; estas pruebas fijan los falsos positivos que tenia al
// buscar por subcadena (sin limites de palabra).
describe("sugerirClasificacion", () => {
  it("una fuga de gas es prioridad alta", () => {
    const r = sugerirClasificacion("Olor a gas", "Hay olor a gas en el pasillo del piso 3", "Pasillo");
    expect(r.prioridad).toBe(PrioridadIncidencia.ALTA);
  });

  it("gasfiter y gastos comunes no se confunden con gas", () => {
    expect(sugerirClasificacion("Necesito un gasfiter", "Para revisar la llave del lavamanos", "Depto 101").prioridad).toBe(
      PrioridadIncidencia.MEDIA
    );
    expect(sugerirClasificacion("Consulta por gastos comunes", "No me llego el aviso de este mes", "Depto 101").prioridad).toBe(
      PrioridadIncidencia.MEDIA
    );
  });

  it("reconoce plurales", () => {
    const r = sugerirClasificacion("Grietas en el muro", "Aparecieron grietas en los muros del hall", "Hall");
    expect(r.categoria).toBe("Estructural");
    expect(r.confianza).toBe("alta");
  });

  it("porton con y sin tilde cuenta como una sola coincidencia (no infla la confianza)", () => {
    const r = sugerirClasificacion("Portón roto", "El porton no cierra", "Estacionamiento");
    expect(r.categoria).toBe("Seguridad");
    expect(r.confianza).toBe("media");
  });

  it("no encuentra palabras dentro de otras (rata en pirata, robo en robot)", () => {
    expect(sugerirClasificacion("Fiesta de pirata", "Los ninos juegan a los piratas", "Salon").categoria).toBe("Ruido");
    expect(sugerirClasificacion("El robot aspirador", "Esta descompuesto", "Hall").categoria).toBe("Otro");
  });

  it("detecta la ubicacion que escribio la persona antes que otras mencionadas en el texto", () => {
    const r = sugerirClasificacion("Humedad", "Se nota desde el subterraneo hasta arriba", "Bodega 12");
    expect(r.ubicacionDetectada).toBe("Bodega");
  });

  it("si la ubicacion escrita no se reconoce, usa la que aparece primero en el texto", () => {
    const r = sugerirClasificacion("Luz quemada", "Primero en la terraza y despues en el subterraneo", "Piso 4");
    expect(r.ubicacionDetectada).toBe("Terraza");
  });

  it("sin coincidencias devuelve categoria Otro, prioridad media y confianza baja", () => {
    const r = sugerirClasificacion("Consulta", "Quisiera saber algo", "Oficina");
    expect(r).toEqual({ categoria: "Otro", prioridad: PrioridadIncidencia.MEDIA, ubicacionDetectada: "Oficina", confianza: "baja" });
  });

  it("la prioridad alta gana sobre la baja cuando aparecen las dos", () => {
    const r = sugerirClasificacion("Problema leve pero urgente", "Un detalle que hay que ver ya", "Hall");
    expect(r.prioridad).toBe(PrioridadIncidencia.ALTA);
  });
});
