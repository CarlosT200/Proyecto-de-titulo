# Operación de HabitaSmart

Despliegue, migraciones, rollback, respaldos, restauración, monitoreo, incidentes y continuidad.
Complementa [`PUESTA_EN_MARCHA.md`](PUESTA_EN_MARCHA.md) (preparar un condominio real).

> **Lo que NO está automatizado y depende de una persona** está marcado con 👤. No se afirma que
> exista nada que no esté configurado y comprobado.

## 1. Despliegue

- `main` se despliega solo en Render (blueprint `render.yaml`): `npm install --include=dev && npm run
  build`, y al arrancar `npm run start`, que ejecuta **`prisma migrate deploy`** y luego el servidor.
- Render espera a que `/health` responda antes de dirigir tráfico a la nueva versión.
- `/ready` (no lo usa Render) responde 200 solo si la base contesta: útil para el monitoreo externo.

### Antes de cada merge a `main` (👤)

1. CI verde en el PR (lint, unitarias, frontend, integración, E2E, build, auditoría, gitleaks, CodeQL).
2. Si el PR trae migraciones, leer el SQL y su sección de rollback (ver §3).
3. Respaldo de producción (§4) si hay migraciones.
4. Merge **squash** desde GitHub.

### Después del merge (👤)

1. Render → servicio → *Events*: esperar «Deploy live».
2. `curl -s https://habitasmart.onrender.com/health` → `{"status":"ok"}`.
3. `curl -s https://habitasmart.onrender.com/ready` → `{"status":"ok"}`.
4. `curl -s https://habitasmart.onrender.com/api/config` → revisar `sosModoDemo` (ver `DEMOSTRACION.md`).
5. Pruebas de humo: entrar con un usuario de cada rol, abrir el QR, ver encomiendas y reservas.
   **No probar el SOS si `sosModoDemo` es `false`.**
6. Después de esta Fase 2 en particular: todas las personas deben **volver a iniciar sesión** una vez
   (las sesiones antiguas eran JWT en el navegador; la app las borra sola y muestra el login).

## 2. Rollback

| Situación | Acción |
|---|---|
| El deploy falla al compilar o arrancar | Render mantiene la versión anterior: no hay que hacer nada. Revisar *Logs* |
| La versión nueva arrancó pero algo falla | Render → *Events* → deploy anterior → **Rollback**. Luego revertir el commit en GitHub con un PR (`git revert`) para que el siguiente deploy no lo repita |
| La migración ya se aplicó | Las migraciones de la Fase 2 solo **agregan** (tabla `sesiones`, índices): el código anterior funciona con ellas, así que basta el rollback del deploy. No es necesario deshacer la migración |

Rollback manual de las migraciones de la Fase 2 (solo si se quiere dejar la base exactamente como
antes; **no hace falta** para volver a la versión anterior):

```sql
-- 20261116010000_indices_listados
DROP INDEX IF EXISTS "documentos_condominioId_createdAt_idx", "encomiendas_usuarioId_fechaRecepcion_idx",
  "incidencias_usuarioId_createdAt_idx", "multas_usuarioId_fecha_idx", "qr_tokens_usuarioId_tipo_revocado_idx",
  "reservas_usuarioId_fecha_idx", "visitas_residenteId_createdAt_idx";
-- 20261116000000_add_sesiones (borra las sesiones abiertas: todos vuelven a iniciar sesión)
DROP TABLE IF EXISTS "sesiones";
DELETE FROM "_prisma_migrations" WHERE migration_name IN ('20261116010000_indices_listados', '20261116000000_add_sesiones');
```

## 3. Migraciones

- Se crean en local con `npm run prisma:migrate` y se revisan antes del PR. **Nunca** se ejecutan a
  mano en producción: las aplica `prisma migrate deploy` al arrancar.
- Regla: **solo cambios compatibles hacia atrás** en un mismo deploy (agregar tablas, columnas
  opcionales, índices). Borrar o renombrar se hace en dos deploys (primero dejar de usarlo, después
  quitarlo), con respaldo previo.
- Índices en tablas grandes: `CREATE INDEX` bloquea escrituras mientras dura; en un condominio son
  milisegundos. Si una tabla supera el millón de filas, crearlo aparte con `CREATE INDEX CONCURRENTLY`.
- Recuperación si una migración falla a medias: Render no arranca la versión nueva (queda la
  anterior). Revisar el error, corregir la migración en un PR nuevo, y si quedó marcada como fallida:
  `npx prisma migrate resolve --rolled-back <nombre>` contra la base (👤, con respaldo previo).

## 4. Respaldos

**Estado real hoy:** existe el respaldo **manual** `npm run respaldo` (archivo `.json.gz` con todas
las tablas, en una sola transacción de lectura) y `npm run restaurar` (solo sobre una base vacía,
compara conteos al final). **No hay respaldos automáticos configurados por este proyecto.** Supabase
ofrece respaldos diarios según su plan: 👤 verificar en *Project Settings → Database → Backups* qué
incluye el plan contratado antes del piloto.

Procedimiento (👤, semanal y antes de cada cambio con migraciones):

```bash
# desde backend/, sin guardar la URL en ningún archivo
DATABASE_URL="<URL de Supabase>" npm run respaldo
```

- El archivo contiene datos personales y hashes de contraseñas: guardarlo **cifrado** (por ejemplo, en
  una carpeta de un disco cifrado o un archivo 7-Zip con AES-256 y contraseña larga) y fuera del
  computador (al menos 3 copias, una fuera del lugar). Nunca en GitHub (la carpeta está ignorada).
- Retención propuesta: 4 respaldos semanales + 3 mensuales. Borrar los más antiguos de forma segura.

### Verificación de restauración (👤, al menos una vez al mes)

1. Crear una base vacía de prueba (local o en Supabase, nombre terminado en `_demo`).
2. `DATABASE_URL=<base vacía> npm run prisma:migrate:deploy`
3. `DATABASE_URL=<base vacía> npm run restaurar -- respaldos/<archivo>.json.gz`
4. El script compara los conteos por tabla; deben coincidir. Anotar fecha y resultado.
5. Borrar la base de prueba.

### RPO y RTO (objetivos propuestos para el piloto)

| Indicador | Objetivo | Con qué se logra |
|---|---|---|
| RPO (datos que se pueden perder) | ≤ 24 h | Respaldo diario de Supabase (verificar plan) + respaldo manual semanal |
| RTO (tiempo para volver a operar) | ≤ 4 h | Nueva base + `migrate deploy` + `restaurar` + cambiar `DATABASE_URL` en Render |

## 5. Escenarios de falla

| Escenario | Qué se nota | Qué hacer (👤) |
|---|---|---|
| Render caído | La app no carga | Esperar estado en status.render.com. Alternativa para la defensa: correr local (`DEMOSTRACION.md` §6) |
| Servidor dormido (plan gratis) | Primer acceso tarda ~1 min | Abrir la app 5 min antes; para el piloto, plan pagado |
| Supabase caído | Errores 503 «servicio no disponible», `/ready` en 503 | Esperar (status.supabase.com); si se prolonga, restaurar el último respaldo en otra base y cambiar `DATABASE_URL` |
| Se perdieron las variables de Render | La app no arranca («Falta la variable…») | Volver a cargarlas desde el gestor de contraseñas del responsable (§6) |
| Secreto filtrado | — | Rotarlo (§6) y revisar `Auditoría` y logs por el periodo |
| Cuenta comprometida | Acciones extrañas | Administración: deshabilitar la cuenta (cierra sus sesiones al instante) y restablecer contraseña |

## 6. Secretos y rotación (👤)

- Los valores reales solo en Render (*Environment*) y en el gestor de contraseñas del responsable.
- Rotar `QR_TOKEN_SECRET`: invalida solo los QR antiguos en formato JWT (los actuales son opacos).
- Rotar `JWT_SECRET`: hoy no invalida nada (reservada).
- Cerrar todas las sesiones de todos (por ejemplo, tras un incidente): en la base,
  `UPDATE sesiones SET "revocadaEn" = now() WHERE "revocadaEn" IS NULL;` (con respaldo previo).
- Rotar la contraseña de la base: en Supabase → *Database → Reset password*, actualizar
  `DATABASE_URL` en Render (redepliega solo).
- Rotar VAPID: generar par nuevo; las suscripciones push existentes dejan de funcionar y cada persona
  debe reactivarlas en *Mi perfil*.

## 7. Monitoreo e incidentes

- **Logs:** Render → *Logs*. En producción cada línea es JSON con `requestId`; un error que ve una
  persona trae un «código» corto (los 8 primeros caracteres del `requestId`) para buscarlo.
- **Salud:** 👤 configurar un monitor gratuito (por ejemplo UptimeRobot) contra `/ready` cada 5 min
  con aviso por correo. No está configurado hoy.
- **Seguridad:** pestaña *Security* de GitHub (CodeQL, Dependabot, alertas de secretos).

Plan de incidente: 1) contener (deshabilitar cuenta, rollback o modo mantenimiento), 2) preservar
logs y respaldo del momento, 3) corregir con un PR con prueba de regresión, 4) informar a la
administración del condominio; si hubo datos personales expuestos, evaluar con asesoría la
notificación que exige la ley.

## 8. Protección recomendada de `main` (👤, en GitHub → Settings → Branches)

No se configuró desde el repositorio (requiere autorización). Recomendado:

- Exigir Pull Request antes de mezclar (sin push directo).
- Exigir que pasen los checks: «Lint, pruebas unitarias y de frontend, build y auditoría»,
  «Integración HTTP y E2E», «Detección de secretos» y «Analizar JavaScript/TypeScript».
- Exigir la rama al día con `main` antes de mezclar.
- Bloquear *force push* y la eliminación de la rama.
- Exigir que las conversaciones estén resueltas.
- Al menos 1 aprobación cuando haya otra persona en el equipo.
