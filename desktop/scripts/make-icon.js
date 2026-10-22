// Genera assets/icon.ico (multi-resolucion) a partir de los PNG del sitio, para
// que el instalador y el acceso directo usen el logo de HabitaSmart.
const pngToIco = require("png-to-ico");
const fs = require("fs");
const path = require("path");

// Tamanos 96, 192 y 256. El .ico de Windows no puede representar lados mayores a
// 256 px (un frame de 512 hace que NSIS falle con "invalid icon file size"),
// pero electron-builder exige que exista al menos un frame de 256x256. Por eso
// usamos un 256 generado aparte (assets/icon-256.png) ademas de los del sitio.
const publico = path.join(__dirname, "..", "..", "frontend", "public");
const assets = path.join(__dirname, "..", "assets");
const fuentes = [
  path.join(publico, "icon-96.png"),
  path.join(publico, "icon-192.png"),
  path.join(assets, "icon-256.png"),
];
const destinoDir = path.join(__dirname, "..", "assets");
const destino = path.join(destinoDir, "icon.ico");

pngToIco(fuentes)
  .then((buf) => {
    fs.mkdirSync(destinoDir, { recursive: true });
    fs.writeFileSync(destino, buf);
    console.log("icon.ico creado en", destino);
  })
  .catch((err) => {
    console.error("No se pudo crear el icono:", err);
    process.exit(1);
  });
