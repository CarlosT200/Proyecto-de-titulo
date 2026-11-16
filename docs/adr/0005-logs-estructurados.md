# ADR 0005 — Logs estructurados propios con redacción

- **Estado:** aceptada (Fase 2)

## Contexto

`morgan` escribía la URL completa de cada pedido, incluido `/acceso/<token>` del QR, y los servicios
usaban `console.error` con objetos que podían contener datos personales o la URL de la base.

## Decisión

- Logger propio de ~100 líneas (`backend/src/lib/logger.ts`), sin dependencias: JSON por línea en
  producción (Render lo muestra y se puede filtrar), legible en desarrollo, nivel configurable
  (`LOG_LEVEL`).
- **Redacción** por nombre de campo (contraseñas, tokens, cookies, Authorization, CSRF, códigos QR,
  archivos) y por patrón dentro de cualquier texto (credenciales en URLs de base de datos, Bearer,
  cookies de sesión, `/acceso/<token>`, base64, JWT). Sin pila en producción.
- `X-Request-Id` por solicitud (se respeta el del proxy si tiene forma segura) y una línea por pedido
  a la API: método, ruta sin query, estado, duración, usuario. **Sin IP ni cuerpos.**
- Los errores 500 devuelven el `requestId` como «código de referencia» para soporte.

## Alternativas descartadas

`pino` (excelente, pero una dependencia más y su redacción por rutas no cubre patrones dentro de
textos libres); un servicio externo de logs (de pago o con datos fuera del control del proyecto).

## Consecuencias

Si el volumen crece, migrar a `pino` es directo (misma forma JSON). Probado en `logger.test.ts` y en
las pruebas de integración (`/ready` y 500 no muestran la contraseña de la base).
