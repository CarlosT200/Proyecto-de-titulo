# ADR 0006 — Pruebas en cuatro capas y E2E contra el build real

- **Estado:** aceptada (Fase 2)

## Contexto

Hasta la Fase 1 solo existían pruebas unitarias del backend con Prisma simulado: no probaban la
aplicación Express real, la base de datos, el frontend ni el navegador.

## Decisión

| Capa | Herramienta | Qué cubre | Dónde |
|---|---|---|---|
| Unitarias | Vitest (Prisma simulado) | Reglas de negocio, validaciones, sesiones, CSRF, logs | `backend/src/**/*.test.ts` |
| Integración HTTP | Vitest + supertest + PostgreSQL real | App Express completa: auth, CSRF, matriz de permisos, aislamiento, archivos, límites, `/ready`, SOS | `backend/src/test/integracion` |
| Frontend | Vitest + Testing Library + jsdom | Login, rutas protegidas, rol, SOS (3 modos), errores globales, cliente HTTP | `frontend/src/**/*.test.tsx` |
| E2E | Playwright | Flujos de los tres roles en navegador, contra el **build compilado** servido por el backend, y accesibilidad WCAG (axe) en 6 tamaños | `e2e/` |

Reglas:

- Las bases de integración y E2E **deben** llamarse `…_test`; las pruebas se niegan a correr en otra
  y la vacían al empezar. En CI es un PostgreSQL efímero del job. Nunca producción.
- Datos deterministas y ficticios (`@prueba.test`, seed demo).
- E2E con `SOS_MODO_DEMO=true` siempre; se vigila que no haya ningún intento de `tel:`.
- Un archivo de pruebas a la vez en integración y E2E (comparten base).

## Alternativas descartadas

- **Testcontainers:** requiere Docker en el equipo de desarrollo (no disponible); un PostgreSQL
  local o de servicio en CI cumple lo mismo.
- **Cypress:** Playwright es más rápido, multi-navegador y trae `@axe-core/playwright`.
- **E2E contra `vite dev`:** no prueba lo que se despliega; se prefiere el build real.

## Consecuencias

El CI tarda más (un job extra con PostgreSQL y Chromium), a cambio de detectar regresiones de
seguridad (permisos, aislamiento, CSRF) y de flujo antes del merge.
