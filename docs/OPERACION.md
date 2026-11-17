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
3. Si hay migraciones: respaldo de producción **con el código de `main`, no con el de la rama**
   (§4.3), o con `pg_dump` (§4.4). Comprobar que terminó sin error y guardar los conteos.
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
compara conteos al final). **No hay respaldos automáticos configurados por este proyecto.** Según
la página de precios de Supabase, el plan **Free no incluye respaldos automáticos** (los diarios
son de los planes pagados): 👤 confirmar en *Database → Backups* del proyecto antes de contar con
ellos.

### 4.1 Regla: el código y la base deben estar en la misma versión de migraciones

`npm run respaldo` respalda **todas las tablas del esquema de Prisma del código que lo ejecuta**.
Si ese código es más nuevo que la base (trae migraciones que la base aún no tiene), el script **se
detiene antes de leer nada**, sin crear archivo, con un mensaje como:

```
No se pudo crear el respaldo: La base de datos no tiene la tabla sesiones, que este código sí espera. …
```

Nunca salta la tabla ni deja un respaldo incompleto. `npm run restaurar` hace la misma comprobación
antes de escribir. Verificado el 2026-11-16 con bases locales (esquema de `main` frente al de la
Fase 2).

| Momento | ¿La base de producción tiene `sesiones`? | Cómo respaldar |
|---|---|---|
| **Antes del merge de la Fase 2** (o de cualquier PR con migraciones) | No | Con el código de **`main`** (§4.3, recomendado) o con **`pg_dump`** (§4.4). **No** con el de la rama |
| **Después** de que el deploy aplicó las migraciones | Sí | Con el código de `main`, que ya es la Fase 2. El archivo incluye `sesiones` (solo hashes de tokens) |

### 4.2 Cadena de conexión de producción (sin guardarla en ningún lado)

- Origen: **Supabase** → proyecto → **Connect** → *Session pooler* (puerto **5432**, funciona con
  IPv4). No usar el *Transaction pooler* (puerto 6543) para respaldos. Reemplazar
  `[YOUR-PASSWORD]` por la contraseña de la base (está en el gestor de contraseñas del responsable).
- La base ya **no está en Render**: no buscar ninguna «External Database URL» en Render.
- Se escribe en una variable **de la sesión de la terminal**, pedida con un campo oculto: no queda en
  archivos, ni en `.env`, ni en el historial de comandos. Al terminar se borra.

PowerShell:

```powershell
$env:DATABASE_URL = Read-Host "Cadena de Supabase (session pooler)" -MaskInput   # PowerShell 7
# En Windows PowerShell 5.1 (no tiene -MaskInput):
#   $s = Read-Host "Cadena de Supabase (session pooler)" -AsSecureString
#   $env:DATABASE_URL = [System.Net.NetworkCredential]::new("", $s).Password; Remove-Variable s
npm run respaldo -- "$HOME\RespaldosHabitaSmart\respaldo-AAAAMMDD.json.gz"
Remove-Item Env:DATABASE_URL
```

Bash:

```bash
read -rsp "Cadena de Supabase (session pooler): " DATABASE_URL; echo; export DATABASE_URL
npm run respaldo -- ~/RespaldosHabitaSmart/respaldo-AAAAMMDD.json.gz
unset DATABASE_URL
```

Una variable de entorno ya definida tiene prioridad sobre `backend/.env` (que apunta a la base
local): el comando usa Supabase solo mientras exista la variable.

### 4.3 Respaldo previo al merge con el código de `main` (recomendado)

Por qué: produce el mismo formato que carga `npm run restaurar`, y el cliente de Prisma de `main` no
incluye `Sesion`, igual que la base actual. Se usa una carpeta aparte (`git worktree`) para no
tocar la rama de trabajo.

PowerShell (desde la carpeta del repositorio, `Proyecto de Titulo`):

```powershell
git fetch origin
git worktree add --detach ..\habitasmart-main origin/main
cd ..\habitasmart-main
npm ci -w backend --include-workspace-root=false
cd backend
npx prisma generate
# definir $env:DATABASE_URL como en §4.2 y luego:
npm run respaldo -- "$HOME\RespaldosHabitaSmart\respaldo-antes-fase2.json.gz"
Remove-Item Env:DATABASE_URL
cd "..\..\Proyecto de Titulo"
git worktree remove ..\habitasmart-main
```

Bash:

```bash
git fetch origin
git worktree add --detach ../habitasmart-main origin/main
cd ../habitasmart-main && npm ci -w backend --include-workspace-root=false && cd backend && npx prisma generate
# definir DATABASE_URL como en §4.2 y luego:
npm run respaldo -- ~/RespaldosHabitaSmart/respaldo-antes-fase2.json.gz
unset DATABASE_URL
cd "../../Proyecto de Titulo" && git worktree remove ../habitasmart-main
```

- El archivo se guarda **fuera** de la carpeta temporal (en `RespaldosHabitaSmart`), así no se
  pierde al quitar el *worktree*.
- Si `npm ci` muestra un aviso de *allow-scripts*, es normal: `npx prisma generate` hace lo que
  faltaba.
- Comprobar que termina con «Respaldo creado: … (N registros)» y anotar los conteos por tabla.
  **No** debe aparecer `Sesion` (la base aún no la tiene).

### 4.4 Alternativa o complemento: `pg_dump`

Por qué: no depende del código de la aplicación y copia la base tal cual (estructura, datos y la
tabla `_prisma_migrations`). Requiere las herramientas cliente de PostgreSQL con versión **igual o
mayor** que la de Supabase (ver *Database → Settings*); en este equipo está PostgreSQL 17.
`--schema=public` deja fuera los esquemas internos de Supabase (`auth`, `storage`…), que la
aplicación no usa.

PowerShell:

```powershell
$pg = "C:\Program Files\PostgreSQL\17\bin"
$env:DATABASE_URL = Read-Host "Cadena de Supabase (session pooler)" -MaskInput   # o la variante 5.1 de §4.2
& "$pg\pg_dump.exe" --format=custom --schema=public --no-owner --no-privileges `
  --file "$HOME\RespaldosHabitaSmart\antes-fase2.dump" --dbname $env:DATABASE_URL
Remove-Item Env:DATABASE_URL
& "$pg\pg_restore.exe" --list "$HOME\RespaldosHabitaSmart\antes-fase2.dump" | Select-String "TABLE DATA"
```

Bash:

```bash
read -rsp "Cadena de Supabase (session pooler): " DATABASE_URL; echo; export DATABASE_URL
pg_dump --format=custom --schema=public --no-owner --no-privileges \
  --file ~/RespaldosHabitaSmart/antes-fase2.dump --dbname "$DATABASE_URL"
unset DATABASE_URL
pg_restore --list ~/RespaldosHabitaSmart/antes-fase2.dump | grep "TABLE DATA"
```

La lista debe mostrar los datos de todas las tablas (`usuarios`, `reservas`, …) y **no** `sesiones`.
Crear antes la carpeta `RespaldosHabitaSmart` (`pg_dump` no la crea; `npm run respaldo` sí).

### 4.5 Respaldo de Supabase (solo si el plan lo incluye)

Sirve como respaldo previo **solo si** 👤 en *Database → Backups* aparece un respaldo con fecha y
hora posteriores al último cambio de datos que importe. En el plan Free no existe: usar §4.3 o §4.4.

### 4.6 Compatibilidad al restaurar

- **Respaldo anterior a la Fase 2 → base nueva con la Fase 2:** funciona. Crear la base vacía,
  aplicar las migraciones del código actual y restaurar; `sesiones` queda **vacía** (cada persona
  inicia sesión de nuevo). Verificado el 2026-11-16 en local: 74 registros, todos los conteos
  iguales, `sesiones = 0`.
  - Desde `.json.gz`: `npm run prisma:migrate:deploy` y luego `npm run restaurar -- <archivo>.json.gz`.
  - Desde `.dump`: `pg_restore --clean --if-exists --no-owner --no-privileges --dbname <base vacía>
    <archivo>.dump` y luego `npm run prisma:migrate:deploy`, que aplica solo las 2 migraciones de la
    Fase 2 (también verificado).
- **Respaldo de la Fase 2 → base sin migrar:** no se puede. `restaurar` se detiene antes de escribir
  porque falta `sesiones`.

### 4.7 Custodia

- El archivo contiene datos personales y hashes de contraseñas: guardarlo **cifrado** (por ejemplo, en
  una carpeta de un disco cifrado o un archivo 7-Zip con AES-256 y contraseña larga) y fuera del
  computador (al menos 3 copias, una fuera del lugar). Nunca en GitHub (la carpeta `respaldos/` está
  ignorada).
- Frecuencia: semanal y **antes de cada merge con migraciones** (según §4.1).
- Retención propuesta: 4 respaldos semanales + 3 mensuales. Borrar los más antiguos de forma segura.

### Verificación de restauración (👤, al menos una vez al mes)

1. Crear una base vacía de prueba (local o en Supabase, nombre terminado en `_demo`).
2. Con `DATABASE_URL` apuntando a esa base (nunca a la de producción): `npm run prisma:migrate:deploy`
3. `npm run restaurar -- <archivo>.json.gz`
4. El script compara los conteos por tabla; deben coincidir. Anotar fecha y resultado.
5. Borrar la base de prueba.

### RPO y RTO (objetivos propuestos para el piloto)

| Indicador | Objetivo | Con qué se logra |
|---|---|---|
| RPO (datos que se pueden perder) | ≤ 24 h | Respaldo diario de Supabase (solo planes pagados; verificar) + respaldo manual semanal |
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
