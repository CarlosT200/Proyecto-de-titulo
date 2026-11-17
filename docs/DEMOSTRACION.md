# Guía de demostración (defensa de título)

Cómo presentar HabitaSmart de forma segura y repetible: datos ficticios, el botón SOS **sin llamar a
ningún número de emergencia real**, un guion de 10 minutos, checklists, plan de emergencia y
respuestas a preguntas difíciles.

> ⚠️ **Regla de oro:** no tocar los botones de emergencia si `/api/config` dice
> `"sosModoDemo":false`. En ese estado el teléfono abre la llamada real.

## 1. Botón SOS en modo demostración

### Cómo funciona

| Modo | Lo decide | Qué hace el botón SOS |
|---|---|---|
| **Real** (`SOS_MODO_DEMO` ausente o distinto de `true`) | el servidor | Abre la llamada al número real (133/132/131) **de inmediato** y, en paralelo, envía un aviso a conserjería/administración como *mejor esfuerzo* (nunca se afirma que llegó). |
| **Demostración** (`SOS_MODO_DEMO=true`) | el servidor | **No abre ninguna llamada.** Envía el aviso, espera la respuesta del servidor y muestra el éxito o el error reales. Los avisos llegan marcados como `[DEMO]`. |
| **Indeterminado** (no se pudo cargar `/api/config`) | — | No llama sin **confirmación explícita**: muestra un diálogo con el número antes de abrirlo. |

Decisiones de diseño que conviene poder explicar:

- El modo lo fija **solo el servidor** (`SOS_MODO_DEMO`); el cliente no puede pedirlo. Es una
  variable **separada** de `MOSTRAR_CUENTAS_DEMO` (botones de cuentas de demostración en el login):
  una cosa es facilitar el ingreso y otra es decidir si se llama de verdad.
- **Idempotencia en el servidor:** si el mismo residente vuelve a pedir el mismo tipo de emergencia
  dentro de 60 s y esa alerta sigue activa, se devuelve la misma alerta (HTTP 200 en vez de 201)
  y **no se vuelve a avisar** a nadie. Cubre doble clic, reintento del navegador y la petición
  `keepalive` repetida.
- **Bloqueo en el cliente:** mientras se envía, el botón tocado muestra «Enviando aviso…» y los
  demás quedan deshabilitados; tras abrir una llamada real los botones quedan bloqueados 4 s.
- Un límite por usuario (5 alertas cada 5 minutos) evita saturar a conserjería por error o mal uso.

### Antes de la defensa (acción humana, no la hace el código)

1. En Render → servicio `habitasmart` → *Environment*, definir `SOS_MODO_DEMO` = `true` y guardar
   (Render redespliega solo). **No cambiar ninguna otra variable.**
2. Esperar a que el despliegue termine (estado *Live*).

### Cómo verificar que el modo demo está activo

**Por la API** (desde cualquier navegador o terminal, sin iniciar sesión):

```bash
curl -s https://habitasmart.onrender.com/api/config
```

Debe responder exactamente `{"cuentasDemo":…,"sosModoDemo":true}`. Si dice `"sosModoDemo":false`,
el SOS está en modo **real**.

**Visualmente** (tres señales, en este orden):

1. En la pantalla de **login**, bajo el formulario, aparece la línea ámbar «Modo demostración: el
   botón SOS no llama a números reales».
2. Dentro de la app (cualquier rol), hay una **franja ámbar arriba del todo**: «Modo demostración:
   el botón SOS avisa a conserjería pero **no llama** a números de emergencia reales».
3. Al tocar el botón rojo SOS como residente, el diálogo empieza con «**Modo demostración.** Se
   avisará a conserjería y administración, pero **no se llamará** a ningún número de emergencia
   real».

Si falta cualquiera de las tres señales, **no tocar los botones de emergencia**.

### Durante la demostración

- Entrar como residente, tocar el botón rojo SOS y elegir un tipo (por ejemplo, Bomberos).
- El botón muestra «Enviando aviso…» y luego el mensaje «Modo demostración: el aviso se envió a
  conserjería y administración. No se llamó a ningún número real».
- En otra pestaña o dispositivo, entrar como conserje o administrador: la alerta aparece en
  **Alertas SOS** y en la campana de notificaciones con el título `[DEMO] 🚨 Alerta SOS: Bomberos`.
  Si el dispositivo tiene las notificaciones activadas, también llega el push con esa marca.
- Marcarla como atendida: el residente recibe «Tu alerta SOS fue atendida».

### ⚠️ Advertencia

> **No probar el botón SOS mientras `/api/config` indique `"sosModoDemo":false`.** En ese estado
> el teléfono abre la llamada real a Carabineros, Bomberos o SAMU. Hoy (noviembre de 2026) el
> servicio en producción está en modo **real**; la activación del modo demo es una acción previa a
> la defensa que debe hacer una persona en Render.

### Después de la defensa

Si el condominio va a operar de verdad, volver a dejar `SOS_MODO_DEMO` sin definir (o en `false`)
en Render y comprobar `/api/config` de nuevo. Mientras esté en `true`, **ningún residente podrá
llamar desde el botón**: solo se avisará a conserjería.

### Comprobación automática

Las pruebas que respaldan este comportamiento (se ejecutan en CI):

- `frontend/src/components/BotonSOS.test.tsx`: en modo demo nunca se llama a `abrirLlamada`
  (la única función que navega a `tel:`); en modo real se llama de inmediato; en modo indeterminado
  solo tras confirmar; un doble clic envía un solo aviso.
- `frontend/src/components/BannerModoDemo.test.tsx`: la franja aparece solo con confirmación del
  servidor.
- `frontend/src/context/ConfigContext.test.tsx`: si `/api/config` falla, el estado queda en
  «error» (nunca se asume un modo) y se reintenta.
- `backend/src/modules/sos/sos.service.test.ts`: idempotencia (misma alerta, sin segundo aviso) y
  marca `[DEMO]` en los avisos.


## 2. Datos de demostración

Todos ficticios (seed `backend/prisma/seed.ts`, idempotente: correrlo dos veces no duplica nada).

| Elemento | Contenido |
|---|---|
| Condominio | «Condominio Los Alerces», Torre A y Torre B |
| Cuentas | `admin@habitasmart.cl` (Ana Administradora), `residente@habitasmart.cl` (Roberto Residente, Torre A 101), `conserje@habitasmart.cl` (Carlos Conserje); además Valentina (A 102) y Matías (B 201). Contraseña de demostración: la que muestra el login con `MOSTRAR_CUENTAS_DEMO=true` |
| Espacios | Quincho y Sala de eventos |
| Datos | Comunicados, reservas futuras y pasadas, multas (pendiente, pagada, apelada), incidencias en distintos estados, encomiendas pendientes y retiradas, visitas con QR y accesos, gastos comunes de dos meses (con una unidad morosa), un SOS atendido de ejemplo y notificaciones |

**Guardias:** el seed corre solo contra bases locales o terminadas en `_test`/`_demo`; contra
cualquier otra se niega salvo `PERMITIR_SEED_DEMO=si`. No hay contraseñas reales en Git: la de
demostración es pública a propósito y solo existe en bases de demostración.

### Volver al estado inicial (👤)

```bash
# desde backend/, contra la base de DEMOSTRACIÓN (nunca la de un condominio real)
npm run respaldo                         # por si acaso
npm run vaciar-demo                      # muestra cuánto se borraría (no borra)
npm run vaciar-demo -- --confirmar       # borra SOLO el condominio demo
npm run prisma:seed                      # lo vuelve a crear
```

## 3. Guion de presentación (10 minutos)

| Min | Rol | Qué mostrar | Qué decir |
|---|---|---|---|
| 0:00 | — | Login: aviso «Modo demostración» | Problema: cuadernos, WhatsApp y planillas. Una plataforma para los tres roles |
| 0:45 | ADMIN | Panel con indicadores, alertas y morosidad | Visión del condominio en una pantalla |
| 1:45 | ADMIN | Gastos comunes: un mes, la unidad morosa, registrar un pago | Cobranza trazable; la app registra pagos, no los procesa |
| 3:00 | ADMIN | Publicar un comunicado | Llega como notificación a los residentes |
| 3:30 | RESIDENTE (celular) | Inicio, credencial QR que rota, notificación del comunicado | QR sin datos personales, vence en ~90 s |
| 4:30 | RESIDENTE | «QR para un invitado» → código | Visita de un solo uso, 4 horas |
| 5:15 | CONSERJE | Validar QR (código manual) → autorizado; repetir → rechazado | Un solo uso, registro de cada acceso |
| 6:15 | CONSERJE | Registrar encomienda → el residente recibe aviso → entregar | Sin papel, con trazabilidad |
| 7:15 | RESIDENTE | Reservar el quincho; intentar el mismo horario → conflicto | Evita dobles reservas, incluso simultáneas |
| 8:00 | RESIDENTE | **SOS (solo con el modo demo verificado)** → Bomberos | Avisa a conserjería; en operación real abre la llamada al 132 |
| 8:45 | CONSERJE/ADMIN | Alerta `[DEMO]` en Alertas SOS → atender | El residente recibe «tu alerta fue atendida» |
| 9:15 | — | Mi perfil → Sesiones activas | Sesión en cookie protegida; se puede cerrar a distancia |
| 9:45 | — | Cierre | Pruebas automáticas, CI, próximos pasos (piloto) |

Tip: usar dos navegadores (o uno normal y uno privado) para tener dos roles abiertos a la vez.

## 4. Checklist del día anterior (👤)

- [ ] En Render: `SOS_MODO_DEMO=true` y `MOSTRAR_CUENTAS_DEMO=true`; deploy «Live».
- [ ] `curl -s https://habitasmart.onrender.com/api/config` → `"sosModoDemo":true`.
- [ ] Datos demo en orden (si se ensuciaron: §2, «Volver al estado inicial»).
- [ ] Probar el guion completo una vez, cronometrado.
- [ ] Grabar un **video de respaldo** del guion completo y tomar capturas de cada paso.
- [ ] Preparar la alternativa local (§6) y probarla una vez sin internet.
- [ ] Cargar el celular y el computador; cable HDMI o adaptador.

## 5. Checklist de 30 minutos antes (👤)

- [ ] Abrir la app (el plan gratis duerme el servidor: el primer acceso tarda ~1 min).
- [ ] `/api/config` → `"sosModoDemo":true`. **Si dice `false`, no tocar el SOS.**
- [ ] Ver las tres señales del modo demo (login, franja, diálogo SOS).
- [ ] Iniciar sesión en los tres roles, cada uno en su navegador.
- [ ] Silenciar notificaciones ajenas a la demo («no molestar»).
- [ ] Tener el video de respaldo abierto en otra pestaña.

## 6. Plan de emergencia

| Falla | Plan |
|---|---|
| Render no responde | Pasar a la alternativa local |
| Sin internet en la sala | Alternativa local (todo corre en el computador) |
| Cualquier otra falla | Mostrar el video de respaldo y las capturas; explicar la arquitectura (`ARQUITECTURA.md`) |

**Alternativa local (👤):** PostgreSQL instalado en el computador, una base `habitasmart_demo`, y en
`backend/.env`: `DATABASE_URL` apuntando a esa base, `SOS_MODO_DEMO="true"` y
`MOSTRAR_CUENTAS_DEMO="true"`. Luego, desde la raíz del proyecto:

```bash
npm ci
npm run prisma:migrate:deploy --workspace backend
npm run prisma:seed
npm run build
npm run start --workspace backend
```

y abrir `http://localhost:4000`.

## 7. Preguntas difíciles de la comisión (respuestas basadas en el proyecto)

**¿Qué pasa si alguien roba la sesión?** La sesión es un token aleatorio en una cookie `HttpOnly`
(JavaScript no la puede leer, así que un XSS no la roba); en la base solo está su hash. Se puede
cerrar desde *Mi perfil*, se cierra al cambiar la contraseña o al deshabilitar la cuenta, y vence (8 h
el personal, 30 días los residentes).

**¿Y CSRF, si usan cookies?** `SameSite=Lax`, verificación de `Origin` y un token por sesión en una
cabecera. Hay pruebas automáticas de los tres casos.

**¿Un residente puede ver datos de otro condominio o de un vecino?** No: cada consulta filtra por el
condominio de la sesión (tomado de la base) o por el dueño del dato. Hay una matriz automatizada de 84
rutas × 3 roles y pruebas de aislamiento con IDs reales de otro condominio.

**¿Qué pasa si se cae la base de datos?** La API responde 503 («intente nuevamente»), `/ready` lo
refleja y la restauración está documentada (RPO ≤ 24 h, RTO ≤ 4 h propuestos). Hoy el respaldo
propio es manual; el automático depende del plan de Supabase.

**¿El SOS puede fallar en una emergencia real?** La llamada al número real se abre **de inmediato**,
sin esperar al servidor; el aviso a conserjería es un complemento de mejor esfuerzo y nunca se afirma
que «llegó». Si la configuración no carga, se pide confirmación antes de llamar.

**¿Por qué guardan archivos en la base?** Simplicidad y respaldo en un solo lugar en el plan gratuito
(sin disco persistente). Está documentado el plan para pasar a almacenamiento de objetos con URLs
firmadas antes de crecer ([ADR 0003](adr/0003-almacenamiento-de-archivos.md)).

**¿Cómo saben que funciona?** 485 pruebas automáticas en cuatro capas (unitarias, integración
HTTP con PostgreSQL, frontend y E2E en navegador, incluida accesibilidad WCAG en 6 tamaños) que corren
en cada Pull Request, más CodeQL, auditoría de dependencias y detección de secretos.

**¿Cumple la ley de datos personales?** Se aplicó minimización, control de acceso por rol, aviso de
privacidad y plazos de conservación propuestos; los puntos legales están marcados para revisión
profesional antes del piloto (`PRIVACIDAD.md`).

**¿Escala?** Para un condominio sobra un solo proceso. Hay índices para los filtros reales, topes en
los listados y caché de recursos. Para muchos condominios: paginación con cursor, almacenamiento de
objetos y plan pagado.
