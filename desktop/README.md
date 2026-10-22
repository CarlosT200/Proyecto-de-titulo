# HabitaSmart — Aplicación de escritorio (Windows)

Versión de escritorio de HabitaSmart para que el **conserje** y el **administrador**
abran la plataforma como una aplicación instalada en el computador, en vez de entrar
por el navegador. Por dentro es una ventana (Electron) que carga el sitio en vivo
**https://habitasmart.onrender.com**, así siempre muestra la última versión publicada
y la web no cambia en nada.

La app enciende la cámara (escaneo de QR y foto de encomiendas), abre los enlaces
externos en el navegador del sistema y muestra una pantalla propia cuando no hay
conexión.

## Requisitos
- Node.js (ya instalado en este equipo) y conexión a internet.

## Probar sin instalar nada (modo desarrollo)
```bash
cd desktop
npm install
npm run icono   # genera assets/icon.ico desde el logo del sitio
npm start       # abre la ventana de la app
```

## Generar el instalador .exe
```bash
cd desktop
npm run dist
```
El instalador queda en `desktop/release/HabitaSmart-Instalador-<versión>.exe`.
Ese archivo es el que se le pasa al conserje/administrador: lo ejecutan, se instala
HabitaSmart, y queda un acceso directo en el escritorio y en el menú inicio.

> Nota: el instalador no está firmado digitalmente, así que la primera vez Windows
> puede mostrar un aviso de SmartScreen ("Más información" → "Ejecutar de todas
> formas"). Es normal para apps internas sin certificado de firma de código.

## Apuntar a otro servidor (opcional)
Por defecto carga la producción. Para apuntar a otro entorno:
```bash
set HABITASMART_URL=https://mi-entorno.ejemplo.com
npm start
```
