// Contraseña temporal para entregar a otra persona. Sin caracteres que se confunden al leerlos o
// dictarlos por telefono (0/O, 1/l/I) y con un guion al medio para decirla en dos partes.
const ALFABETO = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generarPasswordTemporal(largoPorParte = 5): string {
  const bytes = new Uint32Array(largoPorParte * 2);
  crypto.getRandomValues(bytes);
  const letras = Array.from(bytes, (n) => ALFABETO[n % ALFABETO.length]);
  return `${letras.slice(0, largoPorParte).join("")}-${letras.slice(largoPorParte).join("")}`;
}
