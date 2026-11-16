# ADR 0004 — Modo demostración del SOS separado de las cuentas demo

- **Estado:** aceptada (Fase 1, reforzada en Fase 2)

## Contexto

En operación real el botón SOS abre la llamada a Carabineros (133), Bomberos (132) o SAMU (131). En
una defensa o demostración, un toque accidental llamaría de verdad a un servicio de emergencia.

## Decisión

- Variable **`SOS_MODO_DEMO`**, independiente de `MOSTRAR_CUENTAS_DEMO`: facilitar el ingreso y
  decidir si se llama de verdad son cosas distintas. La fija **solo el servidor** y la publica en
  `/api/config`; el cliente no puede pedirla.
- Tres modos en el cliente:
  - **demo:** nunca abre `tel:`; envía el aviso, espera la respuesta y muestra éxito o error reales.
  - **real:** abre la llamada **de inmediato**; el aviso es mejor esfuerzo (`fetch keepalive`), nunca
    se afirma que llegó.
  - **indeterminado** (config no cargó o cargando): confirmación explícita antes de llamar.
- Señales visibles: aviso en el login, franja ámbar en toda la app, texto en el diálogo; los avisos a
  conserjería llevan `[DEMO]`.
- Doble clic y reintentos: candado en el cliente + idempotencia de 60 s en el servidor + límite por
  usuario.
- La única función que navega a `tel:` es `abrirLlamada` (`lib/sos.ts`), lo que permite comprobar
  automáticamente que en demo nunca se llama.

## Consecuencias

- 👤 Antes de la defensa hay que poner `SOS_MODO_DEMO=true` en Render, y quitarlo antes de operar
  con un condominio real (mientras esté activo, ningún residente puede llamar desde el botón).
- Pruebas en tres capas: frontend (tres modos y doble clic), integración (idempotencia, `[DEMO]`) y
  E2E (ningún intento de `tel:` en el navegador).
