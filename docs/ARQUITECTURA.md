# Arquitectura de HabitaSmart

Estado al cierre de la Fase 2 (noviembre de 2026). Las decisiones importantes tienen su ADR en
[`docs/adr/`](adr/).

## 1. Vista general

Una sola aplicación Node.js (monolito modular) sirve la API y el frontend compilado desde el mismo
origen. No hay microservicios: un condominio genera poca carga y un solo proceso es más simple de
operar, respaldar y explicar.

```
                     ┌──────────────────────────── Render (plan web) ────────────────────────────┐
 Navegador / PWA     │  Node 22 · Express 4                                                      │
 App Android         │  ┌──────────────┐   ┌───────────────────────────────────────────────┐    │
 App escritorio  ───►│  │ Frontend     │   │ API /api/*                                    │    │
 (Electron)  HTTPS   │  │ React 18     │   │  request-id → logs redactados → helmet → CORS │    │
      cookie         │  │ (dist/ con   │   │  → JSON 2 MB → cookies → CSRF → rutas         │    │
   HttpOnly ─────────│  │  caché       │   │  → requireAuth (sesión en BD) → requireRole   │    │
                     │  │  inmutable)  │   │  → Zod → servicio (filtra por condominio)     │    │
                     │  └──────────────┘   └──────────────┬────────────────────────────────┘    │
                     │  /health (proceso) · /ready (base) │ Prisma 5                            │
                     └────────────────────────────────────┼─────────────────────────────────────┘
                                                          │ TLS
                                           ┌──────────────▼──────────────┐
                                           │ PostgreSQL (Supabase)        │
                                           │ datos, sesiones (hash),      │
                                           │ fotos y archivos en base64   │
                                           └──────────────────────────────┘
   Web Push (FCM/Mozilla/Apple) ◄── notificaciones (incluido SOS, urgencia alta)
   GitHub Actions ── POST /api/tareas/recordatorios (cada hora, clave TAREAS_TOKEN)
```

## 2. Componentes

| Componente | Ubicación | Responsabilidad |
|---|---|---|
| Frontend | `frontend/` | React + Vite + Tailwind. Una ruta por pantalla, cargada bajo demanda. Sin tokens en el navegador |
| API | `backend/src/modules/*` | Un módulo por dominio: rutas → controlador (valida con Zod) → servicio (Prisma) |
| Sesiones | `backend/src/lib/sesiones.ts`, `middleware/auth.ts` | Cookie `HttpOnly` + tabla `sesiones` (solo hash), revocación |
| CSRF | `backend/src/middleware/csrf.ts` | Origen permitido + token ligado a la sesión |
| Logs | `backend/src/lib/logger.ts`, `middleware/solicitud.ts` | JSON por línea, redacción, `X-Request-Id` |
| Archivos | `backend/src/lib/archivos.ts` | Firma (magic bytes), 8 MB, entrega con `nosniff` y sesión |
| Base | `backend/prisma/` | Esquema, 18 migraciones, seed de demostración con guardia |
| Escritorio | `desktop/` | Electron que abre la web (no es workspace npm) |
| Pruebas | `backend/src/**/*.test.ts`, `backend/src/test/integracion`, `frontend/src/**/*.test.tsx`, `e2e/` | Cuatro capas (ver `docs/FASE_2.md`) |

## 3. Matriz de roles (autorización en el backend)

La matriz completa de 84 rutas está automatizada en
[`backend/src/test/integracion/permisos.int.test.ts`](../backend/src/test/integracion/permisos.int.test.ts):
para cada ruta y cada rol comprueba que los permitidos pasan y los demás reciben 403, que sin sesión
todo responde 401, y que ninguna ruta nueva queda sin declarar. Resumen:

| Módulo | ADMIN | RESIDENTE | CONSERJE |
|---|---|---|---|
| Usuarios | crear, editar, deshabilitar, restablecer contraseña, listar | — | listar (sin correo ni teléfono) |
| Condominio (torres, unidades, espacios) | todo | ver datos y espacios | ver datos y espacios |
| Reservas | ver todas, cancelar | crear, ver las suyas, cancelar las suyas | consultar disponibilidad |
| Multas | crear, editar, eliminar, resolver apelación | ver las suyas, apelar | — |
| Incidencias | ver todas, gestionar | crear, ver las suyas | — |
| Encomiendas | ver todas | ver las suyas | registrar, entregar, devolver |
| Comunicados / documentos | publicar, eliminar | ver | ver |
| QR y visitas | ver accesos | QR propio, visitas | validar QR, ver accesos |
| Gastos comunes | emitir, pagos, comprobantes, morosidad | su cuenta, informar pago | — |
| SOS | ver y atender alertas | activar | ver y atender alertas |
| Auditoría | ver | — | — |
| Sesiones propias, perfil, notificaciones | sí | sí | sí |

**Aislamiento entre condominios:** cada consulta filtra por el `condominioId` de la sesión (tomado
de la base, nunca del cliente) o por el dueño del dato. Un ID real de otro condominio responde 404
(no 403, para no confirmar que existe). Comprobado en
[`aislamiento.int.test.ts`](../backend/src/test/integracion/aislamiento.int.test.ts).

## 4. Variables de entorno

Nunca se publican valores reales. Los secretos viven solo en Render.

| Variable | Propósito | Obligatoria | Entorno | Formato | ¿Secreto? |
|---|---|---|---|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL | Sí | todos | `postgresql://usuario:clave@host:puerto/base` | **Sí** |
| `JWT_SECRET` | Reservada (desde la Fase 2 no firma nada); se exige para no romper despliegues | Sí | todos | ≥ 32 caracteres en producción | **Sí** |
| `QR_TOKEN_SECRET` | Firma de los QR antiguos (formato JWT) | Sí | todos | ≥ 32 caracteres en producción | **Sí** |
| `NODE_ENV` | `production` activa cookie `Secure`, `trust proxy` y logs JSON | Sí en Render | prod | `production` | No |
| `PORT` | Puerto HTTP | No (4000) | todos | número | No |
| `APP_URL` | URL pública (QR y origen permitido) | Sí en prod | prod | `https://…` | No |
| `CORS_ORIGIN` | Orígenes extra permitidos | No | dev | lista separada por comas | No |
| `SESION_PERSONAL_HORAS` | Duración sesión admin/conserje | No (8) | todos | número | No |
| `SESION_RESIDENTE_DIAS` | Duración sesión residente | No (30) | todos | número | No |
| `SOS_MODO_DEMO` | `true`: el SOS no llama, solo avisa | No (falso) | defensa/demo | `true` | No |
| `MOSTRAR_CUENTAS_DEMO` | Botones de cuentas demo en el login | No (oculto en prod) | defensa/demo | `true`/`false` | No |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web Push | No (sin ellas no hay push) | prod | claves EC / `mailto:` | **Sí** (privada) |
| `TAREAS_TOKEN` | Clave de la tarea horaria de recordatorios | No | prod | ≥ 24 caracteres | **Sí** |
| `LOG_LEVEL` | Nivel mínimo de log | No (`info`) | todos | `debug`/`info`/`warn`/`error` | No |
| `PERMITIR_SEED_DEMO` | Permite el seed demo sobre una base remota | No | solo demo | `si` | No |
| `DATABASE_URL_TEST` | Base de pruebas de integración y E2E | Solo pruebas | local/CI | nombre terminado en `_test` | Sí (local) |

> Nota: desde la Fase 2 `JWT_EXPIRES_IN` / `JWT_EXPIRES_IN_RESIDENTE` ya no se usan (reemplazadas por
> `SESION_*`). Si siguen definidas en Render no hacen daño; se pueden borrar después del merge.

## 5. Modelo de amenazas (resumen STRIDE)

| Amenaza | Ejemplo | Control | Riesgo residual |
|---|---|---|---|
| Suplantación | Robo de sesión por XSS | Cookie `HttpOnly`; CSP de helmet; React escapa el contenido | Bajo |
| Suplantación | Fuerza bruta de contraseñas | bcrypt 12; límite por IP+correo y por IP; mensajes genéricos | Bajo |
| Suplantación | Sesión robada en un equipo compartido | Expiración, «Cerrar todas», revocación al cambiar contraseña o deshabilitar | Bajo |
| Manipulación | CSRF desde otro sitio | `SameSite=Lax` + Origin + token por sesión | Bajo |
| Manipulación | Subir HTML/SVG disfrazado | Firma del archivo, lista blanca, `nosniff` | Bajo |
| Repudio | «Yo no hice ese cambio» | Registro de auditoría por usuario | Bajo |
| Divulgación | IDOR / ver datos de otro condominio | Filtro por condominio en cada consulta; matriz y pruebas de aislamiento | Bajo |
| Divulgación | Token o datos en logs | Logs redactados; sin tokens en URL | Bajo |
| Divulgación | Respaldos con datos personales | Carpeta ignorada por git; procedimiento de custodia (`OPERACION.md`) | Medio (depende de quien custodia) |
| Denegación | Cuerpos o listas enormes | 2 MB, 8 MB por archivo, topes de filas, Zod 4 | Bajo |
| Denegación | Plan gratuito que duerme | `/health`, recordatorios por GitHub Actions; plan pagado para piloto | Medio |
| Elevación | Residente usando rutas de admin | `requireRole` en cada ruta; matriz automatizada | Bajo |
| Seguridad física | Llamada accidental al 133/131/132 en una demo | `SOS_MODO_DEMO`, confirmación si el modo es desconocido, pruebas | Bajo si se sigue el checklist |

## 6. Limitaciones conocidas

- Fotos y documentos en base64 dentro de PostgreSQL (simple y respaldado junto con todo, pero hace
  crecer la base). Plan de migración en [ADR 0003](adr/0003-almacenamiento-de-archivos.md).
- Plan gratuito de Render: el servidor se duerme y el primer acceso tarda ~1 min.
- La idempotencia del SOS es por ventana de 60 s, no una restricción única: dos pedidos en el mismo
  milisegundo pueden crear dos alertas (nunca más; ver la prueba de concurrencia).
- Sin paginación con cursor: los listados tienen topes (500 filas; personas 2000). Suficiente para un
  condominio; para un administrador de muchas comunidades habría que paginar.
- `capacitor.config.ts` apunta a una IP local (solo pruebas en celular); la app Android para
  distribución requiere cambiarla por la URL pública.
- El OCR de etiquetas descarga su motor desde un CDN; si la CSP o la red lo bloquean, la lectura
  automática no funciona (el registro manual sí).
