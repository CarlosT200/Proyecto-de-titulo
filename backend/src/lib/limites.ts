// Tope de filas en los listados que crecen con el uso (multas, incidencias, encomiendas, reservas,
// comunicados, visitas, documentos). Un condominio real tarda años en acercarse a este numero en
// una sola persona o en los registros "vigentes"; el tope evita que una respuesta crezca sin
// limite (memoria del servidor, datos moviles). Los listados se ordenan del mas reciente al mas
// antiguo, asi que lo que queda fuera es lo mas viejo. Paginacion completa: ver docs/FASE_2.md.
export const LIMITE_LISTADO = 500;

// Listados de personas del condominio (residentes, personal): un condominio grande puede tener
// varios cientos de unidades con mas de una persona cada una.
export const LIMITE_PERSONAS = 2000;
