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

Los resultados, decisiones y riesgos residuales están a continuación.


## 5. Resultados (antes → después)

Medido en local sobre la rama al cierre de la fase. CI remoto del PR #5: los 5 checks en verde (verificación, integración + E2E, gitleaks, análisis CodeQL y resultado de CodeQL sin alertas).

| Verificación | Antes (`cb72487`) | Después |
|---|---|---|
| Lint (frontend) | 0 errores, 13 warnings | **0 errores, 0 warnings** (sin desactivar reglas) |
| Pruebas unitarias backend | 230 | **276** |
| Pruebas de integración HTTP (PostgreSQL real) | no existían | **148** |
| Pruebas de frontend | no existían | **42** |
| Pruebas E2E (Playwright, incluye accesibilidad) | no existían | **17** |
| **Total** | **230** | **483** |
| Build frontend / backend | correcto | correcto |
| `prisma validate` | correcto | correcto (18 migraciones) |
| `npm audit` (todo) | 14 (12 moderadas, 2 altas) | **0 vulnerabilidades** |
| `npm audit --omit=dev` | 7 (6 moderadas, 1 alta: `zod`) | **0 vulnerabilidades** |
| Accesibilidad | sin pruebas | axe WCAG 2.2 AA en 30 pantallas + login: 0 violaciones graves; sin desborde en 6 tamaños |
| Bundle: chunk principal | 534 kB (163 kB gzip) | **138 kB (43 kB gzip)** + `react` 181 kB, `animaciones` 129 kB, `iconos` 250 kB cacheables 1 año |
| Bundle: `dist` | 1,6 MB, 67 archivos | 1,6 MB, 58 archivos |

## 6. Qué se hizo por bloque

| Bloque | Commit | Resultado |
|---|---|---|
| 2A SOS | `4e15bf3` | Idempotencia de 60 s en el servidor, marca `[DEMO]`, candado de doble clic y progreso, banner global, configuración pública con reintentos, pruebas de los 3 modos |
| 2B Sesiones | `d4b9fd4` | Cookie `HttpOnly` + tabla `sesiones` (hash), revocación en 7 situaciones, CSRF de dos capas, límite de login por IP+correo, sin tokens en el navegador |
| 2C Autorización | `eb42736` | Matriz automatizada de 84 rutas × 3 roles + sin sesión, aislamiento entre condominios; no se encontró ningún IDOR |
| 2D Dependencias | `c6a80c0` | Zod 4, React Router 7, Vite 7, Vitest 5.1, sin `uuid`; auditoría 0/0 |
| 2E Archivos y validación | `4d33c27` | Descargas con sesión (sin token en URL), `/uploads` no público, cabeceras seguras, límites de texto, contraseñas 8–128 |
| 2G Confiabilidad | `36921e9` | Logs JSON redactados, `X-Request-Id`, `/ready`, 503 reintentable, cierre ordenado, índices, topes, caché, bundle |
| 2F Pruebas | `eb42736`, `1610f4c`, `6e97b9b` | Cuatro capas; Fast Refresh sin warnings; guardia del seed |
| 2H Accesibilidad | `6a76b25`, campana | axe + desborde en 6 tamaños; corrección WCAG 2.5.3 en incidencias |
| 2J Demostración | `bbad780` | Seed con SOS y notificaciones, guion, checklists, plan de emergencia, preguntas |
| 2K CI | `0fa1ab7` | Job de integración + E2E con PostgreSQL, CodeQL, Dependabot, gate de auditoría en «altas» |
| 2I/2L Documentación | (último commit) | Arquitectura, operación, privacidad, 6 ADR, README |
| Revisión del CI | `f898452`, `bff1f6a`, `82f4986` | Gitleaks: contraseña ficticia de prueba en la excepción por valor exacto. CodeQL: CSRF aplicado a todas las rutas, la sesión nueva se crea fuera de `cambiarPassword`, y el middleware CSRF legible para el análisis. Sin desactivar reglas |

## 7. Decisiones

Ver los ADR en [`docs/adr/`](adr/): sesiones en cookie (0001), CSRF (0002), archivos (0003), modo
demo del SOS (0004), logs (0005) y estrategia de pruebas (0006).

## 8. Migraciones de esta fase

| Migración | Cambio | Compatibilidad | Rollback |
|---|---|---|---|
| `20261116000000_add_sesiones` | `CREATE TABLE sesiones` (+ índice único del hash, índice por usuario, FK con borrado en cascada) | Aditiva: el código anterior la ignora | `DROP TABLE sesiones` (todos vuelven a iniciar sesión) |
| `20261116010000_indices_listados` | 7 `CREATE INDEX` | Aditiva | `DROP INDEX` de cada uno (`OPERACION.md` §2) |

Ninguna borra ni modifica datos ni agrega restricciones que datos existentes puedan violar. Se
aplicaron solo en las bases locales de desarrollo y de prueba; **no en producción** (las aplicará
`prisma migrate deploy` al desplegar el merge).

## 9. Riesgos residuales

| Riesgo | Nivel | Mitigación / dueño |
|---|---|---|
| Cuentas demo con contraseña pública activas en producción | Medio (bajo durante la defensa) | 👤 `npm run deshabilitar-demo` antes del piloto |
| SOS en modo real en producción | Alto **solo si** alguien lo prueba | 👤 `SOS_MODO_DEMO=true` antes de la defensa; checklist |
| Respaldo automático no verificado (el plan Free de Supabase no lo incluye) | Medio | 👤 verificar plan de Supabase; respaldo manual semanal (`OPERACION.md` §4) |
| Plan gratuito (servidor dormido) | Medio para piloto | 👤 plan pagado para el piloto |
| Idempotencia del SOS por ventana (no única) | Bajo | Límite por usuario; documentado |
| Archivos en la base | Bajo para un condominio | ADR 0003 |
| Retención de datos no automatizada (salvo sesiones) | Medio para piloto | Tarea antes del piloto |
| Textos legales no revisados por profesional | Medio para piloto | 👤 revisión de `PRIVACIDAD.md` [R] |

## 10. Plan de piloto real

1. **Antes:** merge de esta fase; plan pagado de Render; verificar respaldos de Supabase y hacer un
   respaldo manual; `SOS_MODO_DEMO` sin definir; `npm run vaciar-demo -- --confirmar` y
   `npm run deshabilitar-demo`; `npm run crear-condominio`; revisión legal del aviso de privacidad;
   monitor externo de `/ready`; protección de `main`.
2. **Carga inicial:** torres, unidades, espacios, cuentas (contraseña temporal obligatoria de cambiar).
3. **Capacitación:** 30 min por rol (administración, conserjería) y una guía breve para residentes.
4. **Operación (4 a 8 semanas):** revisar logs y `Auditoría` semanalmente; respaldo semanal;
   formulario de comentarios; métricas: accesos validados, encomiendas, reservas, incidencias
   resueltas, tiempo de atención de SOS.
5. **Cierre:** encuesta de satisfacción, lista de mejoras priorizadas, decisión de continuidad.

## 11. Pendientes reales

- **Bloqueantes de defensa (acción humana):** respaldo de producción **antes** del merge con el
  código de `main` o con `pg_dump` (`OPERACION.md` §4.3/§4.4; no con el de esta rama); merge del PR; `SOS_MODO_DEMO=true` y
  `MOSTRAR_CUENTAS_DEMO=true` en Render; verificar `/api/config`; ensayo y video de respaldo.
- **Bloqueantes de piloto:** los del punto 10.1; automatizar la retención; definir el
  procedimiento de solicitudes de datos personales.
- **Mejoras futuras:** almacenamiento de objetos (ADR 0003); paginación con cursor; exportación de
  datos por persona; métricas y alertas; app Android apuntando a la URL pública; Prisma 7, Express 5,
  React 19 y Tailwind 4 en tareas propias.
- **Limitaciones aceptadas:** ver `ARQUITECTURA.md` §6.
