# Seguridad

Registro de las decisiones de seguridad del proyecto: qué se hizo, por qué, y qué riesgos quedan.
Lo que ya existía y es correcto no se repite aquí. El detalle de cada fase está en `docs/FASE_2.md`
(y la Fase 1 en el historial del PR #4).

## Sesiones (Fase 2)

La sesión vive en una **cookie `HttpOnly`** (`habitasmart_sesion`) con un token aleatorio de 32
bytes; JavaScript no puede leerla, así que un XSS no puede robarla. En la base de datos (tabla
`sesiones`) se guarda **solo el hash SHA-256** del token, la fecha de vencimiento (personal 8 h,
residentes 30 días), la fecha de revocación y el User-Agent recortado.

Atributos de la cookie: `HttpOnly`, `Secure` en producción, `SameSite=Lax`, `Path=/`, `Expires`.
`Lax` y no `Strict` porque el QR codifica un enlace `https://…/acceso/<token>` que el conserje abre
desde la cámara del celular: es una navegación de nivel superior desde fuera de la app y con `Strict`
la cookie no viajaría. `Lax` la envía en esas navegaciones (GET) y la bloquea en los POST/PUT/PATCH/
DELETE iniciados por otro sitio.

Cada pedido comprueba: sesión existente, no revocada, no vencida, cuenta activa y contraseña no
cambiada después de abrirla. Revocan sesiones: salir, «cerrar todas», cerrar una concreta desde Mi
perfil, cambiar la contraseña (la sesión actual se rota), restablecer la contraseña o deshabilitar la
cuenta (administración) y el script `deshabilitar-demo`.

Ya **no hay ningún token en `localStorage` ni `sessionStorage`**; la app borra el antiguo
(`habitasmart_token`) al arrancar.

## CSRF (Fase 2)

Dos capas en todo método que modifica datos (`backend/src/middleware/csrf.ts`):

1. **Origen**: `Origin` (o `Referer`) debe ser el propio host, `APP_URL` o uno de `CORS_ORIGIN`.
   Aplica también al login.
2. **Token ligado a la sesión**: la cabecera `X-CSRF-Token` debe coincidir con la cookie legible
   `habitasmart_csrf` y con el token guardado en la sesión. Un sitio ajeno no puede leer esa cookie.

CORS solo acepta los orígenes configurados (nunca `*`), con credenciales.

## Límites de intentos

- Login: 10 fallos por IP + correo cada 15 min, y un tope alto de 100 fallos por IP (una red
  compartida no se bloquea por un vecino que se equivoca). Solo cuentan los fallos.
- Cambio de contraseña: 10 fallos por IP cada 15 min.
- Validación de QR: 60 por minuto por conserje. SOS: 5 cada 5 min por residente (además de la
  idempotencia de 60 s en el servidor).

## Dependencias (auditoría de `npm audit`)

Estado al cierre del bloque 2D de la Fase 2: **0 vulnerabilidades** tanto en `npm audit` como en
`npm audit --omit=dev`. Nunca se usó `npm audit fix --force`.

| Paquete | Antes → después | Severidad | Qué se hizo |
|---|---|---|---|
| `zod` | 3.25 → 4.6 | alta (DoS por colecciones grandes) | Migración controlada de todos los esquemas (`z.enum` con enums de Prisma, `z.uuid`/`z.email`/`z.url`/`z.iso.datetime`, `error` en vez de `required_error`/`errorMap`) y del mapa de mensajes en español (`z.config({ customError })`). Toda la suite (unitaria e integración) pasa |
| `react-router-dom` | 6.30 → 7.18 | moderada (open redirect por `\`; constructor injection en SSR) | Actualizado. La app usa solo la API compartida con v6 (`BrowserRouter`, `Routes`, `Link`, `useNavigate`, `useSearchParams`…); se verificó navegación, parámetros de búsqueda, comodín y pruebas de frontend |
| `uuid` | 9.0 (directa) → eliminada | moderada | El único uso (nombre de archivo del almacenamiento en disco heredado) pasó a `crypto.randomUUID()` |
| `@capacitor/cli` | `dependencies` → `devDependencies` | arrastraba `xcode`, `rimraf`, `minimatch` a la auditoría de producción | Es una herramienta de desarrollo (sincronizar el proyecto Android); no corre en el servidor |
| `vite` / `vitest` / `esbuild` / `tinypool` / `@vitest/mocker` | vite 5.4 → 7.3, vitest 3.2/5.0 → 5.1 | moderada a crítica (solo desarrollo) | Actualización de las herramientas de desarrollo del frontend y del backend. Vite 7 exige Node ≥ 20.19 (declarado en `engines`) |
| `minimatch` (vía `@typescript-eslint`) | — | moderada (solo desarrollo) | `npm audit fix` sin `--force` |

Dependencias que siguen una versión mayor por detrás a propósito (no vulnerables; se revisan en el
plan de mantenimiento): Prisma 5 (7 cambia la configuración del cliente), Express 4, React 18,
Tailwind 3, ESLint 8, multer 1.4 LTS. Cada una requiere su propia tarea con pruebas.

## Archivos y descargas

Ver el bloque 2E en `docs/FASE_2.md`: verificación por firma (magic bytes), límite de 8 MB,
descargas autenticadas con la sesión, `Content-Disposition` seguro y `X-Content-Type-Options: nosniff`.
