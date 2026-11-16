# Privacidad y datos personales

Describe lo que **realmente** hace HabitaSmart con los datos personales (estado de noviembre de
2026). El aviso que leen las personas usuarias está en la app (`/privacidad`,
`frontend/src/pages/Privacidad.tsx`) y es coherente con este documento.

> ⚖️ **No es asesoría legal.** Está escrito con la Ley N.º 19.628 (modificada por la Ley N.º 21.719)
> y la Ley N.º 21.442 de Copropiedad Inmobiliaria como marco, pero los puntos marcados con **[R]**
> deben revisarlos el profesor guía o un profesional chileno antes de un piloto con personas reales.

## 1. Datos que se recopilan, para qué y quién los ve

| Categoría | Datos | Finalidad | Quién accede |
|---|---|---|---|
| Cuenta | Nombre, apellido, correo, rol, contraseña (solo hash bcrypt) | Acceso a la app | Administración (no ve la contraseña) |
| Contacto | Teléfono y foto (opcionales) | Contacto de la administración | Administración. Conserjería **no** ve correo ni teléfono |
| Unidad | Torre y departamento | Gastos comunes, encomiendas, accesos | Administración; conserjería ve nombre y unidad |
| Sesiones | Tipo de navegador, fechas de inicio y último uso, vencimiento | Seguridad: que la persona vea y cierre sus sesiones | Solo la propia persona |
| Visitas y QR | Nombre de la visita, horario, cada validación y quién la hizo | Control de acceso | Residente que invita, conserjería, administración |
| Vehículos | **No se registran** (no existe ese dato en el sistema) | — | — |
| Emergencias (SOS) | Quién, unidad, tipo, hora, quién atendió y nota | Asistir una emergencia | Conserjería y administración |
| Encomiendas | Remitente, seguimiento, foto del paquete, quién retiró | Entrega de paquetes | Residente, conserjería, administración |
| Pagos registrados | Monto, fecha, medio, n.º de comprobante y archivo del comprobante | Estado de cuenta de gastos comunes | Residentes de la unidad y administración |
| Documentos | Reglamentos, actas (archivos del condominio) | Información a la comunidad | Toda la comunidad |
| Notificaciones push | Identificador del navegador/dispositivo | Avisos aunque la app esté cerrada | Nadie (uso técnico) |
| Auditoría | Qué acción administrativa hizo cada persona y cuándo | Trazabilidad | Administración |

**Pagos:** la app **no procesa pagos** ni guarda datos de tarjetas o cuentas bancarias. Solo registra
pagos ya hechos y el comprobante que sube la persona.

## 2. Proveedores (encargados de tratamiento)

| Proveedor | Qué hace | Dónde | Datos |
|---|---|---|---|
| Render | Ejecuta la aplicación | EE. UU. | Todos, en tránsito (no los almacena fuera de la memoria y logs) |
| Supabase | Base de datos PostgreSQL | Según el proyecto creado **[R: confirmar región]** | Todos |
| Servicios de push (Google, Mozilla, Apple) | Entregan las notificaciones | Global | Título y texto del aviso y el identificador del dispositivo |
| GitHub | Código fuente y CI | EE. UU. | **Ningún dato personal real** (solo datos ficticios de prueba) |

Transferencia internacional **[R]**: los servidores están fuera de Chile; el aviso lo informa.

## 3. Retención propuesta **[R]**

| Dato | Plazo propuesto | Estado de implementación |
|---|---|---|
| Sesiones | Hasta vencer o cerrarse + 30 días | **Automático** (limpieza diaria) |
| Accesos QR e invitaciones | 12 meses | Manual (pendiente de automatizar antes del piloto) |
| Alertas SOS | 12 meses | Manual |
| Notificaciones | Hasta que se borren, o 6 meses | Manual |
| Multas, reservas, gastos y pagos | 5 años | Manual |
| Incidencias y fotos | 2 años desde su cierre | Manual |
| Cuenta | Mientras la persona sea residente o trabajador + 6 meses | Manual (deshabilitar cuenta) |

## 4. Derechos (acceso, rectificación, supresión, oposición, portabilidad, bloqueo)

- **Rectificación:** nombre, teléfono y foto, en *Mi perfil*; el resto, la administración.
- **Supresión:** la administración deshabilita la cuenta (corta el acceso al instante y cierra sus
  sesiones). La eliminación física de datos históricos se hace por solicitud **[R: definir el
  procedimiento y plazo de respuesta]**.
- **Acceso y portabilidad:** hoy por solicitud a la administración (exportación manual desde la
  base). Automatizarlo es una mejora futura.

## 5. Minimización y seguridad aplicadas

- Conserjería no ve correos ni teléfonos; otros residentes no ven datos ajenos.
- El QR es un código aleatorio **sin datos personales** y caduca en ~90 s (credencial) o al usarse.
- Las contraseñas solo se guardan como hash; las sesiones, como hash del token.
- Los logs no guardan IP, cuerpos de solicitud, tokens ni códigos QR (redacción automática).
- Archivos verificados por su contenido y entregados solo a quien corresponde.

## 6. Datos de demostración vs. producción

- El **seed de demostración** usa personas, direcciones y montos **ficticios** («Condominio Los
  Alerces», correos `@habitasmart.cl`) con una contraseña pública. Nunca deben convivir con datos
  reales: antes de un piloto, `npm run vaciar-demo -- --confirmar` y `npm run deshabilitar-demo`.
- El seed se niega a correr sobre una base remota sin `PERMITIR_SEED_DEMO=si`.
- Las pruebas automáticas usan solo datos inventados (`@prueba.test`) en bases `_test`.
- **Hoy (noviembre de 2026) las cuentas demo siguen activas en producción** (se usan para la defensa).
  Acción 👤 antes del piloto: deshabilitarlas.

## 7. Datos de visitantes **[R]**

La visita no tiene cuenta: el residente ingresa su nombre. El aviso pide al residente informar a su
visita. Revisar si se requiere un aviso visible en portería.
