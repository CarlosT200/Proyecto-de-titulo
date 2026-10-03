# Puesta en marcha de HabitaSmart con un condominio real

Guía para pasar de la versión de demostración a un uso real. Los comandos son para **PowerShell**, ejecutados desde la carpeta `backend` del proyecto. Si `npm` no se reconoce, usar `npm.cmd`.

## Resumen: qué hacer y en qué orden

| # | Qué | Cuándo |
|---|-----|--------|
| 1 | Hacer un **respaldo** de la base de datos de Render | Hoy, antes de tocar nada |
| 2 | Resolver el **vencimiento de la base de datos gratuita** de Render | Antes del 24 de octubre de 2026 |
| 3 | Dejar el servicio **siempre encendido** (si habrá SOS reales) | Antes de entregarla al condominio |
| 4 | Preparar la base con el **condominio real** y deshabilitar las cuentas demo | Al empezar el piloto |
| 5 | Rutina de respaldos | Semanal y antes de cada cambio grande |

---

## 1. Respaldo de la base de datos (RNF-12)

El respaldo se guarda en un archivo comprimido (`.json.gz`) con **todo**: usuarios, reservas, multas, fotos, documentos, etc. No depende de `pg_dump`.

1. En Render, abrir la base `habitasmart-db` y copiar la **External Database URL**.
2. En PowerShell:

```powershell
cd "C:\Users\toroc\Desktop\Proyecto\Proyecto de Titulo\backend"
$env:DATABASE_URL = "PEGA_AQUI_LA_EXTERNAL_DATABASE_URL"
npm run respaldo
```

3. Queda en `backend\respaldos\respaldo-AAAAMMDD-HHMM.json.gz` y el comando muestra cuántos registros guardó por tabla.

> **El archivo contiene datos personales y contraseñas cifradas.** Guardarlo en un lugar privado (no en GitHub, ni compartido por correo). La carpeta `respaldos/` ya está excluida de git.

Para comprobar que un respaldo sirve de verdad, restaurarlo en una base **vacía y recién migrada** (nunca encima de una que se esté usando; el comando se niega a hacerlo):

```powershell
$env:DATABASE_URL = "URL_DE_LA_BASE_NUEVA"
npm run prisma:migrate:deploy
npm run restaurar -- respaldos\respaldo-AAAAMMDD-HHMM.json.gz
```

Al terminar compara los conteos con los del respaldo y avisa si algo no coincide. Se probó con la base local: 19 tablas, 237 registros, sin diferencias.

---

## 2. La base de datos gratuita de Render vence

Según la documentación de Render ([render.com/docs/free](https://render.com/docs/free)), las bases Postgres gratuitas **vencen a los 30 días de creadas**, tienen **14 días de gracia** para pasarlas a un plan de pago y después **se borran con todos sus datos**. Tampoco tienen respaldos. La base `habitasmart-db` se creó el 24 de septiembre de 2026, así que vence alrededor del **24 de octubre** (confirmar la fecha exacta en el panel de Render).

**Primero el respaldo (sección 1).** La documentación de Render no aclara qué pasa con los datos al subir de plan una base gratuita, así que no hay que confiar en eso: con el respaldo en mano no se pierde nada pase lo que pase.

Hay dos caminos:

### Opción A: subir de plan en Render (la más simple)

En el panel de Render, abrir `habitasmart-db` y cambiar a un plan de pago (Basic). Todo sigue igual: misma URL, misma configuración. Los planes de pago incluyen respaldos diarios.

Costo aproximado (confirmar en el panel, los precios cambian): base Basic ~US$6 al mes más almacenamiento.

### Opción B: base gratuita permanente en otro proveedor (por ejemplo Neon)

Neon tiene un plan gratuito que no vence (1 GB por proyecto; la base se "duerme" tras 5 minutos sin uso y despierta sola). Hay que migrar los datos:

1. Crear un proyecto en [neon.com](https://neon.com) y copiar su cadena de conexión.
2. Aplicar la estructura y restaurar el respaldo:

```powershell
$env:DATABASE_URL = "CADENA_DE_NEON"
npm run prisma:migrate:deploy
npm run restaurar -- respaldos\respaldo-AAAAMMDD-HHMM.json.gz
```

3. En Render, en el servicio `habitasmart`, cambiar la variable `DATABASE_URL` por la de Neon. **Ojo:** `render.yaml` hoy la toma de `habitasmart-db`; si se cambia el valor a mano en el panel, hay que quitar `fromDatabase` de ese archivo para que no vuelva a pisarse.

Ventaja: sin costo. Desventaja: el plan gratuito de Neon solo guarda 6 horas de historial (no reemplaza a los respaldos propios) y las fotos y documentos se guardan dentro de la base, así que 1 GB se puede llenar con el tiempo.

## 3. Servicio siempre encendido

El servicio web gratuito de Render **se apaga tras 15 minutos sin visitas** y tarda alrededor de un minuto en despertar. Para una demostración no importa, pero **la alerta SOS tiene que llegar al instante**: con el servicio dormido, el aviso se demora hasta un minuto. Para un uso real conviene el plan **Starter** del servicio web (~US$7 al mes, confirmar en el panel), que no se apaga.

---

## 4. Preparar la base para el condominio real

Hoy la base de Render tiene los datos y las **cuentas de demostración** (`admin@`, `residente@`, `conserje@habitasmart.cl`), que comparten una contraseña pública. Con residentes reales hay dos caminos.

### Camino recomendado: base nueva y limpia

1. Crear una base nueva (o vaciar la actual restaurando sobre otra), aplicar la estructura y crear el condominio con su primera administradora:

```powershell
$env:DATABASE_URL = "URL_DE_LA_BASE_NUEVA"
npm run prisma:migrate:deploy
npm run crear-condominio -- --condominio "Condominio Los Robles" --comuna "Ñuñoa" --direccion "Av. Grecia 1234" --nombre "María" --apellido "Soto" --email admin@correo.cl --password "una-clave-segura"
```

El comando se niega a usar la contraseña de las cuentas de demostración. No crea ningún dato de ejemplo.

2. Entrar a la aplicación con esa cuenta y, desde **Condominio**, agregar torres, departamentos y espacios comunes; desde **Residentes**, crear las cuentas de residentes y conserjes.
   - Cada cuenta nueva sale con una **contraseña temporal** (el botón *Generar* arma una fácil de dictar). La persona **debe elegir la suya al entrar por primera vez**.
   - Si alguien olvida su contraseña: **Residentes → Restablecer clave**. Se define otra temporal y tendrá que cambiarla al entrar.

### Si se conserva la base actual

Deshabilitar las cuentas de demostración (reversible, efecto inmediato):

```powershell
$env:DATABASE_URL = "URL_DE_LA_BASE"
npm run deshabilitar-demo
```

Y crear la cuenta de administración real desde la aplicación (Residentes → Nuevo usuario → rol Administrador). Los datos de ejemplo (reservas, multas, comunicados de demostración) quedan en la base; algunos no se pueden eliminar desde la aplicación, por eso se recomienda la base limpia.

## 5. Variables de entorno en Render

| Variable | Qué hace |
|----------|----------|
| `DATABASE_URL` | Conexión a la base (viene de `habitasmart-db` o de Neon) |
| `JWT_SECRET`, `QR_TOKEN_SECRET` | Claves de sesión y de códigos QR (Render las genera) |
| `APP_URL` | Dirección pública de la aplicación (se usa en los códigos QR) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Notificaciones del sistema (incluida la alerta SOS) |
| `MOSTRAR_CUENTAS_DEMO` | `true` muestra en el login los botones de cuentas de demostración. **Por defecto están ocultos en producción.** Activar solo para una demostración o la defensa, y volver a quitar después |

## 6. Rutina de respaldos

- **Una vez por semana** y **antes de cada cambio grande** (subir de plan, cambiar de base, actualizar la aplicación): `npm run respaldo`.
- Guardar al menos los últimos 3 respaldos fuera del computador (por ejemplo en un disco externo o un almacenamiento privado).
- Cada cierto tiempo, probar la restauración en una base vacía (sección 1): un respaldo que nunca se probó no es un respaldo.

## 7. Qué revisar antes de entregarla

- [ ] Entrar con la cuenta de administración real y cargar torres, departamentos y espacios.
- [ ] Crear una cuenta de residente, entrar con ella desde el celular y cambiar la contraseña temporal.
- [ ] Generar un QR de visita y validarlo desde la cuenta de conserjería **con un celular real** (la cámara no se pudo probar en las pruebas automáticas).
- [ ] Activar notificaciones en el iPhone (Safari → *Compartir* → *Agregar a inicio*, luego activarlas en **Mi perfil**) y probar una alerta SOS.
- [ ] Comprobar que las cuentas de demostración ya no entran.
- [ ] Hacer un respaldo y restaurarlo en una base de prueba.

## 8. Pendiente fuera del código

- **Datos personales (Ley N.º 21.719, vigente desde el 1 de diciembre de 2026):** el condominio tendrá datos de residentes y visitas. Falta un aviso de privacidad y definir quién es responsable de los datos; conviene revisarlo con alguien con conocimiento legal.
- **Documento del proyecto de título:** el clasificador de incidencias es un **motor de reglas** (reconoce palabras clave), no un modelo de inteligencia artificial. La pantalla ya lo llama "Sugerencia automática"; el informe debería describirlo igual para no sobrestimarlo.
