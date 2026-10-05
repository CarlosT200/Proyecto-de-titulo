import { describe, expect, it } from "vitest";
import { PrioridadIncidencia } from "@prisma/client";
import { sugerirClasificacion } from "./clasificador-ia";
import { CODIGOS_CATEGORIA } from "../../lib/categorias";

// HU-25 / RNF-14: es un motor de reglas; estas pruebas fijan su comportamiento y los falsos
// positivos que tenia al buscar por subcadena (sin limites de palabra).
describe("sugerirClasificacion", () => {
  it("ejemplo del requerimiento: agua desde el techo es Agua y filtraciones, prioridad alta", () => {
    const r = sugerirClasificacion("Agua en el baño", "Está saliendo agua desde el techo del baño.", "Depto 504");
    expect(r.categoria).toBe("AGUA");
    expect(r.prioridad).toBe(PrioridadIncidencia.ALTA);
  });

  it("una fuga de gas es prioridad alta", () => {
    const r = sugerirClasificacion("Olor a gas", "Hay olor a gas en el pasillo del piso 3", "Pasillo");
    expect(r.prioridad).toBe(PrioridadIncidencia.ALTA);
  });

  it("gasfiter y gastos comunes no se confunden con gas", () => {
    expect(sugerirClasificacion("Necesito un gasfiter", "Para revisar la llave del lavamanos", "Depto 101").prioridad).toBe(
      PrioridadIncidencia.MEDIA
    );
    expect(sugerirClasificacion("Consulta por gastos comunes", "No me llegó el aviso de este mes", "Depto 101").prioridad).toBe(
      PrioridadIncidencia.MEDIA
    );
  });

  it("reconoce plurales", () => {
    const r = sugerirClasificacion("Grietas en el muro", "Aparecieron grietas en los muros del hall", "Hall");
    expect(r.categoria).toBe("INFRAESTRUCTURA");
    expect(r.confianza).toBe("alta");
  });

  it("portón con y sin tilde cuenta como una sola coincidencia (no infla la confianza)", () => {
    const r = sugerirClasificacion("Portón roto", "El porton no cierra", "Estacionamiento");
    expect(r.categoria).toBe("PUERTAS_ACCESOS");
  });

  it("no encuentra palabras dentro de otras (rata en pirata, robo en robot)", () => {
    expect(sugerirClasificacion("Fiesta de pirata", "Los niños juegan a los piratas", "Salón").categoria).toBe("RUIDOS");
    expect(sugerirClasificacion("El robot aspirador", "Está descompuesto", "Hall").categoria).toBe("OTROS");
  });

  it("clasifica las categorias nuevas", () => {
    expect(sugerirClasificacion("Perro ladrando", "El perro del 302 ladra toda la noche", "Torre B").categoria).toBe("MASCOTAS");
    expect(sugerirClasificacion("Auto mal estacionado", "Un auto ocupa mi estacionamiento", "Subterráneo").categoria).toBe(
      "ESTACIONAMIENTO"
    );
    expect(sugerirClasificacion("Pasto seco", "No están regando el pasto del jardín", "Jardín").categoria).toBe("AREAS_VERDES");
    expect(sugerirClasificacion("Citófono malo", "El citófono de la entrada no funciona", "Entrada").categoria).toBe(
      "PUERTAS_ACCESOS"
    );
    expect(sugerirClasificacion("Luces apagadas", "Las luces del pasillo no encienden", "Piso 2").categoria).toBe("ELECTRICIDAD");
  });

  it("un ascensor detenido o una persona atrapada es prioridad alta", () => {
    expect(sugerirClasificacion("Ascensor detenido", "El ascensor está detenido entre pisos", "Torre A").prioridad).toBe(
      PrioridadIncidencia.ALTA
    );
    const r = sugerirClasificacion("Persona atrapada", "Hay una persona atrapada en el ascensor", "Torre A");
    expect(r.prioridad).toBe(PrioridadIncidencia.ALTA);
    expect(r.categoria).toBe("ASCENSOR");
  });

  it("'no es urgente' no cuenta como urgente: baja la prioridad", () => {
    const r = sugerirClasificacion("Detalle en la pintura", "La pared del hall está rayada, no es urgente", "Hall");
    expect(r.prioridad).toBe(PrioridadIncidencia.BAJA);
  });

  it("la prioridad alta gana sobre la baja cuando aparecen las dos", () => {
    const r = sugerirClasificacion("Problema leve pero urgente", "Un detalle que hay que ver ya", "Hall");
    expect(r.prioridad).toBe(PrioridadIncidencia.ALTA);
  });

  it("detecta la ubicación que escribió la persona antes que otras mencionadas en el texto", () => {
    const r = sugerirClasificacion("Humedad", "Se nota desde el subterraneo hasta arriba", "Bodega 12");
    expect(r.ubicacionDetectada).toBe("Bodega");
  });

  it("si la ubicación escrita no se reconoce, usa la que aparece primero en el texto", () => {
    const r = sugerirClasificacion("Luz quemada", "Primero en la terraza y despues en el subterraneo", "Piso 4");
    expect(r.ubicacionDetectada).toBe("Terraza");
  });

  it("sin coincidencias devuelve Otros, prioridad media y confianza baja (nunca falla)", () => {
    const r = sugerirClasificacion("Consulta", "Quisiera saber algo", "Oficina");
    expect(r).toEqual({ categoria: "OTROS", prioridad: PrioridadIncidencia.MEDIA, ubicacionDetectada: "Oficina", confianza: "baja" });
    expect(() => sugerirClasificacion("", "", "")).not.toThrow();
  });

  it("siempre devuelve una categoría de la lista oficial", () => {
    const textos = ["fuga de agua", "robo de bicicleta", "cucarachas en la sala", "música fuerte", "basura", "xyz"];
    for (const texto of textos) {
      expect(CODIGOS_CATEGORIA).toContain(sugerirClasificacion(texto, texto, "").categoria);
    }
  });
});
