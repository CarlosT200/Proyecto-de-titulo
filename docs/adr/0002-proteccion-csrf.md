# ADR 0002 — Protección CSRF: origen + token ligado a la sesión

- **Estado:** aceptada (Fase 2)

## Contexto

Con la sesión en una cookie ([ADR 0001](0001-sesiones-en-cookie-httponly.md)), el navegador la adjunta
sola a cualquier pedido hacia la API, incluso si lo inicia otro sitio. `SameSite=Lax` bloquea la
mayoría de los casos, pero no conviene depender de una sola capa (navegadores antiguos, subdominios).

## Decisión

En todo método que modifica datos (POST, PUT, PATCH, DELETE):

1. **Origen:** `Origin` (o `Referer` si falta) debe ser el propio host, `APP_URL` o `CORS_ORIGIN`.
   También se aplica al login (evita el «login CSRF»).
2. **Token ligado a la sesión:** la cookie legible `habitasmart_csrf` lleva un token aleatorio guardado
   en la fila de la sesión; el cliente lo repite en `X-CSRF-Token`. El servidor exige que la cabecera
   coincida con la cookie **y** con el token de esa sesión. Un sitio ajeno no puede leer la cookie.

Los GET no modifican nada y no se exige el token. Las tareas externas sin cookie (recordatorios)
usan su propia clave.

## Alternativas descartadas

- **Solo `SameSite`:** una sola capa.
- **`csurf`:** paquete deprecado.
- **Token sincronizado en el HTML:** la app es una SPA servida estática; la cookie legible es más simple.

## Consecuencias

- `api/client.ts` agrega la cabecera automáticamente; el SOS (que usa `fetch keepalive`) también.
- Pruebas: sin cabecera, cabecera de otra sesión, origen ajeno y login desde otro origen → 403.
