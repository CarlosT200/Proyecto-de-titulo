# Guía de demostración (defensa de título)

Cómo presentar HabitaSmart sin riesgo: el botón SOS **no debe llamar a ningún número de emergencia
real** durante la defensa. Esta guía se completa en la Fase 2 (datos de demostración, guion,
checklists y preguntas de la comisión); la sección del SOS ya está vigente.

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
