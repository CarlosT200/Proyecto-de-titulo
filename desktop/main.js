// Cascaron de escritorio de HabitaSmart (Electron).
//
// En vez de abrir el navegador e ir a la pagina, el conserje o el administrador
// abren esta aplicacion instalada en su computador. Por dentro es una ventana
// que carga el sitio en vivo (https://habitasmart.onrender.com): asi la app
// SIEMPRE muestra la ultima version publicada en Render y no hay que volver a
// generar ni reinstalar el .exe cada vez que cambia la web.
//
// Decisiones de seguridad: la ventana carga un sitio remoto, por lo tanto
// nodeIntegration queda desactivado y contextIsolation activado (el sitio no
// tiene acceso a Node ni al sistema). Solo se conceden los permisos que la app
// realmente usa: camara/microfono (escaneo de QR y foto de encomiendas) y
// notificaciones.

const { app, BrowserWindow, Menu, shell, session } = require("electron");
const path = require("path");
const fs = require("fs");

// El dominio se puede sobreescribir con una variable de entorno (util para
// apuntar a un entorno de prueba), pero por defecto es la produccion en Render.
const APP_URL = process.env.HABITASMART_URL || "https://habitasmart.onrender.com";
const APP_ORIGIN = new URL(APP_URL).origin;

let ventana = null;

// --- Recordar el tamano y la posicion de la ventana entre sesiones ---
const estadoPath = () => path.join(app.getPath("userData"), "ventana.json");
function leerEstado() {
  try {
    return JSON.parse(fs.readFileSync(estadoPath(), "utf8"));
  } catch {
    return {};
  }
}
function guardarEstado() {
  if (!ventana) return;
  try {
    const b = ventana.getBounds();
    fs.writeFileSync(estadoPath(), JSON.stringify({ ...b, maximized: ventana.isMaximized() }));
  } catch {
    // si no se puede guardar, no es critico
  }
}

function paginaLocal(nombre) {
  return `file://${path.join(__dirname, nombre).replace(/\\/g, "/")}`;
}

function crearVentana() {
  const estado = leerEstado();
  ventana = new BrowserWindow({
    width: estado.width || 1280,
    height: estado.height || 820,
    x: estado.x,
    y: estado.y,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#0f172a",
    icon: path.join(__dirname, "assets", "icon.ico"),
    title: "HabitaSmart",
    show: false,
    autoHideMenuBar: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  });

  if (estado.maximized) ventana.maximize();
  ventana.once("ready-to-show", () => ventana.show());

  // Pantalla de carga local mientras responde el sitio, y luego el sitio en vivo.
  ventana.loadFile(path.join(__dirname, "loading.html"));
  ventana.loadURL(APP_URL);

  // Si no hay internet o el sitio no responde -> pantalla "sin conexion".
  ventana.webContents.on("did-fail-load", (_e, codigo, _desc, _url, esMainFrame) => {
    // -3 = ERR_ABORTED: una navegacion cancelo a otra (normal), se ignora.
    if (!esMainFrame || codigo === -3) return;
    ventana.loadURL(`${paginaLocal("offline.html")}?u=${encodeURIComponent(APP_URL)}`);
  });

  // Enlaces a otros dominios (o mailto/tel) se abren en el navegador del sistema,
  // no dentro de la app. La navegacion dentro del propio sitio se queda adentro.
  ventana.webContents.setWindowOpenHandler(({ url }) => {
    try {
      if (url.startsWith("http") && new URL(url).origin === APP_ORIGIN) return { action: "allow" };
    } catch {
      /* url rara: se trata como externa */
    }
    shell.openExternal(url);
    return { action: "deny" };
  });
  ventana.webContents.on("will-navigate", (e, url) => {
    try {
      const u = new URL(url);
      if (u.protocol === "file:") return; // loading.html / offline.html locales
      if (u.origin !== APP_ORIGIN) {
        e.preventDefault();
        shell.openExternal(url);
      }
    } catch {
      /* ignorar */
    }
  });

  ventana.on("resize", guardarEstado);
  ventana.on("move", guardarEstado);
  ventana.on("close", guardarEstado);
  ventana.on("closed", () => {
    ventana = null;
  });
}

function irAlInicio() {
  if (ventana) ventana.loadURL(APP_URL);
}

function crearMenu() {
  const plantilla = [
    {
      label: "HabitaSmart",
      submenu: [
        { label: "Ir al inicio", click: irAlInicio },
        { label: "Recargar", accelerator: "CmdOrCtrl+R", click: irAlInicio },
        { type: "separator" },
        { role: "quit", label: "Salir" },
      ],
    },
    {
      label: "Editar",
      submenu: [
        { role: "undo", label: "Deshacer" },
        { role: "redo", label: "Rehacer" },
        { type: "separator" },
        { role: "cut", label: "Cortar" },
        { role: "copy", label: "Copiar" },
        { role: "paste", label: "Pegar" },
        { role: "selectAll", label: "Seleccionar todo" },
      ],
    },
    {
      label: "Ver",
      submenu: [
        { role: "zoomIn", label: "Acercar" },
        { role: "zoomOut", label: "Alejar" },
        { role: "resetZoom", label: "Tamano normal" },
        { type: "separator" },
        { role: "togglefullscreen", label: "Pantalla completa" },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(plantilla));
}

// Una sola instancia: si se abre otra vez, se enfoca la ventana existente.
const lock = app.requestSingleInstanceLock();
if (!lock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (ventana) {
      if (ventana.isMinimized()) ventana.restore();
      ventana.focus();
    }
  });

  app.whenReady().then(() => {
    // Permisos: solo camara/microfono y notificaciones (lo que usa el sitio).
    const permitidos = ["media", "notifications", "clipboard-sanitized-write", "fullscreen", "pointerLock"];
    session.defaultSession.setPermissionRequestHandler((_wc, permiso, cb) => cb(permitidos.includes(permiso)));
    session.defaultSession.setPermissionCheckHandler((_wc, permiso) =>
      ["media", "notifications", "fullscreen"].includes(permiso)
    );

    crearMenu();
    crearVentana();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) crearVentana();
  });
}
