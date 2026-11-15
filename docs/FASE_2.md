# Fase 2 — Seguridad, calidad y preparación para la defensa

Documento de trabajo de la Fase 2. Registra el punto de partida, los hallazgos de la auditoría, las
decisiones tomadas y los resultados antes/después. Los detalles de cada tema viven en su propio
documento (ver el índice al final).

- **Rama:** `mejoras-seguridad-calidad-fase-2`
- **Commit base:** `cb72487` (`main` después de la Fase 1, PR #4)
- **Regla de trabajo:** nada de esta fase toca producción, Render ni Supabase. Las migraciones se
  entregan preparadas y **no se ejecutan** en producción sin autorización.

## 1. Objetivo

Dejar HabitaSmart técnicamente preparada para la defensa de título y para un piloto controlado:
sesión segura (sin tokens en `localStorage`), SOS sin llamadas accidentales, dependencias con
vulnerabilidades importantes corregidas o justificadas, pruebas en cuatro capas (unitarias,
integración HTTP, frontend y E2E), operación documentada (respaldo, restauración, rollback) y una
demostración repetible para los tres roles.

"Lista" no significa "sin errores posibles": significa que se cumplen criterios verificables, que no
quedan riesgos críticos conocidos sin tratar y que existe un procedimiento seguro ante fallos.

## 2. Baseline (antes de modificar, sobre `cb72487`)

| Verificación | Resultado |
|---|---|
| Lint (frontend) | 0 errores, 13 warnings (`react-refresh/only-export-components`) |
| Pruebas backend (Vitest) | 230 pruebas en 35 archivos, todas pasan |
| Pruebas de integración HTTP | no existen |
| Pruebas de frontend | no existen |
| Pruebas E2E | no existen |
| Build frontend | correcto |
| Build backend | correcto |
| `prisma validate` | correcto |
| `npm audit` (todo) | 14 vulnerabilidades (12 moderadas, 2 altas) |
| `npm audit --omit=dev` (producción) | 7 vulnerabilidades (6 moderadas, 1 alta: `zod`) |
| Gitleaks | verde en CI (PR #4, corrida 2) |
| Bundle | chunk principal `index` 534 kB (163 kB gzip); `ConserjeValidarQR` 339 kB (102 kB gzip); CSS 84 kB; `dist` 1,6 MB en 67 archivos |

Nota: el conteo de `npm audit` cambió respecto del informe de la Fase 1 (23 / 8) sin que cambiara el
código, porque la base de avisos de npm se actualiza con el tiempo.

## 3. Hallazgos de la auditoría previa

Prioridades: **P0** obligatorio antes de la defensa · **P1** muy recomendable antes de la defensa ·
**P2** necesario antes de un piloto real · **P3** evolución futura.

No se encontró ninguna vulnerabilidad crítica explotable. El aislamiento entre condominios ya estaba
bien resuelto: todas las consultas Prisma revisadas filtran por `condominioId` o por el usuario dueño
del dato, y las actualizaciones usan `updateMany` con condición o verifican pertenencia antes.

| # | Prioridad | Hallazgo | Tratamiento en esta fase |
|---|---|---|---|
| H1 | P0 | El JWT de sesión se guarda en `localStorage` (legible por cualquier script; no se puede revocar una sesión puntual) | Cookie `HttpOnly` + sesiones en base de datos, revocables (2B) |
| H2 | P0 | Sin protección CSRF (no hacía falta con `Authorization`, sí con cookies) | Validación de `Origin` + token CSRF por sesión (2B) |
| H3 | P0 | SOS sin protección de doble clic ni idempotencia; sin aviso global de modo demostración; sin pruebas automáticas de los tres modos | Bloqueo, idempotencia en servidor, banner y pruebas (2A) |
| H4 | P0 | `zod` 3 con vulnerabilidad alta en producción | Migración a Zod 4 (2D) |
| H5 | P0 | No hay pruebas de integración HTTP, de frontend ni E2E | Cuatro capas de pruebas (2F) |
| H6 | P1 | Los enlaces de descarga de documentos y comprobantes llevan un token firmado **en la URL** (queda en historial y logs) | Descarga autenticada con la cookie de sesión (2E) |
| H7 | P1 | `/uploads` se sirve como carpeta estática pública, sin autorización (legado: hoy nada escribe ahí) | Se elimina la exposición pública (2E) |
| H8 | P1 | Varios esquemas de validación no limitan el largo de los textos | Límites en todos los esquemas (2E) |
| H9 | P1 | El límite de intentos de login es solo por IP: una red compartida podría bloquearse entre sí | Límite por IP + correo, y un tope alto por IP (2B) |
| H10 | P1 | `react-router` 6 con avisos de seguridad | Migración a v7 si es verificable (2D) |
| H11 | P1 | `uuid` como dependencia directa innecesaria; `@capacitor/cli` en `dependencies` arrastra `xcode → uuid` a la auditoría de producción | Se reemplaza por `crypto.randomUUID` y se mueve la CLI a `devDependencies` (2D) |
| H12 | P1 | Sin identificador de solicitud, logs estructurados, `/ready`, cierre ordenado ni manejo de promesas rechazadas | Confiabilidad (2G) |
| H13 | P1 | El seed de demostración no tiene guardia contra producción | Guardia por variable de entorno y confirmación (2J) |
| H14 | P1 | 13 warnings de Fast Refresh | Se corrigen separando hooks/constantes de componentes (2K) |
| H15 | P1 | Los recursos estáticos con hash se sirven con `max-age=0` | Caché inmutable para `/assets` (2G) |
| H16 | P2 | Listados que crecen sin tope (incidencias, multas, reservas, encomiendas, comunicados) | Tope y paginación opcional (2G) |
| H17 | P2 | Faltan índices para filtros reales (visitas por residente, QR por usuario, reservas por usuario, etc.) | Migración de índices, no destructiva (2G) |
| H18 | P2 | **Las cuentas de demostración (contraseña pública en el repositorio) están activas en producción** | Acción humana antes del piloto: `npm run deshabilitar-demo`. Documentado en el checklist |
| H19 | P2 | Fotos y documentos se guardan en la base de datos (base64) | Se refuerza lo actual y se documenta la migración a almacenamiento de objetos (ADR) |
| H20 | P3 | `capacitor.config.ts` apunta a una IP local por HTTP (solo para pruebas en celular) | Documentado como limitación; no afecta la web |
| H21 | P3 | El OCR de etiquetas (tesseract.js) descarga su motor desde un CDN; conviene verificarlo contra la CSP en dispositivo real | Documentado |

## 4. Plan de bloques

| Bloque | Contenido |
|---|---|
| 2A | SOS: modo demo, idempotencia, doble clic, pruebas |
| 2B | Sesión por cookie `HttpOnly`, sesiones revocables, CSRF |
| 2C | Matriz automatizada de permisos y aislamiento entre condominios |
| 2D | Zod 4, React Router 7, limpieza de `uuid`, auditoría |
| 2E | Validación de entradas, archivos y descargas |
| 2F | Pruebas: integración HTTP, frontend, E2E |
| 2G | Logs, `/ready`, cierre ordenado, paginación, índices, bundle |
| 2H | Accesibilidad y móvil |
| 2I | Privacidad, respaldo y continuidad |
| 2J | Entorno y guion de demostración |
| 2K | CI, Dependabot, CodeQL |
| 2L | Documentación técnica y de defensa |

Los resultados finales (antes/después), las decisiones y los riesgos residuales se completan al
cierre de la fase, más abajo.
