# ADR 0001 — Sesiones en cookie HttpOnly con registro en base de datos

- **Estado:** aceptada (Fase 2, noviembre de 2026)
- **Reemplaza:** JWT guardado en `localStorage` y enviado como `Authorization: Bearer`

## Contexto

El JWT en `localStorage` es legible por cualquier script de la página: un XSS o una dependencia
comprometida podía robar la sesión. Además, un JWT no se puede revocar uno a uno (solo por fecha de
cambio de contraseña), así que «cerrar sesión» no cerraba nada en el servidor.

## Decisión

- Token aleatorio de 32 bytes en la cookie `habitasmart_sesion`: `HttpOnly`, `Secure` en
  producción, `SameSite=Lax`, `Path=/`, con vencimiento (8 h personal, 30 días residentes).
- Tabla `sesiones` con **solo el hash SHA-256** del token, vencimiento, revocación, último uso
  (actualizado como mucho cada 5 min) y User-Agent recortado.
- Cada pedido busca la sesión por hash y valida: no revocada, no vencida, cuenta activa, contraseña
  no cambiada después de abrirla. Rol y condominio salen de la base.
- Revocan: salir, «cerrar todas», cerrar una sesión desde Mi perfil, cambio y restablecimiento de
  contraseña, deshabilitar la cuenta. Limpieza diaria de sesiones viejas.
- Se elimina el soporte de `Authorization: Bearer` (nadie más consume la API).

## Por qué `SameSite=Lax` y no `Strict`

El QR codifica `https://…/acceso/<token>` y el conserje lo abre desde la cámara del celular: es una
navegación desde fuera de la app. Con `Strict` la cookie no viaja y el conserje aparece sin sesión.
`Lax` la envía solo en navegaciones GET de nivel superior y la bloquea en POST/PUT/PATCH/DELETE de
otros sitios; el CSRF se cubre además con [ADR 0002](0002-proteccion-csrf.md).

## Alternativas descartadas

- **JWT en cookie HttpOnly sin tabla:** resuelve el robo por XSS pero no la revocación individual.
- **Refresh token + access token corto:** más piezas y más superficie para un único cliente del
  mismo origen; no aporta frente a una sesión opaca consultada en la base.
- **Librería de sesiones (`express-session` + store):** válido, pero la implementación propia es
  ~150 líneas, con hash del token y pruebas, sin dependencias nuevas.

## Consecuencias

- Una consulta por pedido a la base (índice único por hash): costo despreciable para un condominio.
- Tras el deploy, todas las personas inician sesión una vez (la app borra el token antiguo).
- La app de escritorio (Electron) y Android cargan la web del mismo origen: funcionan igual.
