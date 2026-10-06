# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Residentes:** usan HabitaSmart desde el celular (sobre todo iPhone con Safari, a veces instalada con "Agregar a inicio"). Entre ellos hay adultos mayores y personas que no manejan mucho la tecnología. Entran para algo puntual: ver si llegó una encomienda, reservar un espacio, reportar un problema, invitar a una visita, revisar su gasto común o pedir ayuda con el botón SOS.
- **Conserjería:** trabaja en la portería, con el celular o una tableta en la mano y con interrupciones constantes. Sus tareas son cortas y repetidas: validar códigos QR de visitas, registrar y entregar encomiendas, atender alertas SOS y consultar el historial de accesos.
- **Administración:** trabaja en escritorio. Gestiona residentes y unidades, emite cobros de gastos comunes, registra multas, revisa incidencias, publica comunicados y documentos, y necesita ver de un vistazo lo que requiere atención.

## Product Purpose

Plataforma web para la administración y la convivencia de un condominio: reúne en un solo lugar lo que hoy se hace por papel, cuaderno de portería y mensajes sueltos. Cada perfil ve solo lo suyo y las acciones de uno llegan al otro (una encomienda registrada en portería avisa al residente; un QR generado por el residente lo valida la conserjería; una incidencia reportada la sigue la administración).

Éxito: que cada perfil resuelva su tarea en pocos toques, sin dudar qué hacer, y que nada importante (una emergencia, una encomienda atrasada, una deuda vencida) pase inadvertido.

## Positioning

Tres perfiles conectados en una misma aplicación pensada para el contexto chileno (pesos, hora de Chile, Ley N.º 21.442 de Copropiedad Inmobiliaria y Ley N.º 21.719 de datos personales), con el celular como dispositivo principal de residentes y conserjería.

## Operating Context

- Proyecto de título de Ingeniería en Informática (INACAP), desarrollado por un equipo de 3 personas con Scrum. Se defiende ante una comisión con cuentas de demostración (administración, residente y conserjería).
- Publicada en https://habitasmart.onrender.com (Render). Hay una prueba piloto prevista en un condominio real.
- El conserje valida los QR con la cámara del celular. Los avisos llegan como notificaciones del sistema (Web Push, también en iPhone con la app agregada a inicio).
- Idioma: español de Chile, con tildes y ñ, sin tecnicismos ni códigos internos en pantalla.

## Capabilities and Constraints

- **Funciones:** reservas de espacios comunes, incidencias con seguimiento y comentarios, multas, encomiendas (con foto, ubicación y entrega), comunicados, documentos, control de acceso con QR (credencial del residente y visitas), alertas SOS con estado, gastos comunes (cobro mensual por unidad, pagos y morosidad), registro de actividad y avisos.
- **Clasificación de incidencias:** es una **sugerencia automática** basada en reglas de palabras clave que propone categoría y prioridad; la administración la revisa. **No es inteligencia artificial** y no debe presentarse como tal.
- **Stack:** React + Vite + TypeScript + Tailwind CSS en el frontend; Node.js + Express + TypeScript + Prisma en el backend; PostgreSQL.
- **Límites actuales:** no hay pagos en línea ni intereses por atraso; los pagos los registra la administración. Las fotos y documentos se guardan dentro de la base de datos. En el plan gratuito el servidor se duerme y tarda en despertar.

## Brand Commitments

- Nombre: **HabitaSmart**. Identidad azul + naranja ya aprobada por el usuario; no se reemplaza (la paleta teal de "lujo inmobiliario" se descartó a propósito).
- Voz: cercana, clara y directa, en español correcto. Mensajes que dicen qué pasó y qué hacer ("Revocar visita", "Hay una versión nueva de HabitaSmart"), nunca valores internos.
- Íconos de la familia Phosphor; nunca emoji como ícono.

## Evidence on Hand

- Datos de demostración del condominio "Los Alerces" (seed) y tres cuentas de demostración.
- 173 pruebas automáticas del backend y una prueba de carga local (~1.400 consultas por segundo en lecturas).
- No hay testimonios, clientes, cifras de uso real ni logos de terceros: no inventarlos.

## Product Principles

1. **Claridad antes que elegancia:** el estado actual y las opciones se ven de un vistazo; si algo "más pro" es menos claro para una persona no técnica, gana lo claro.
2. **El celular primero** para residentes y conserjería; el escritorio, para la administración.
3. **Lo urgente arriba:** emergencias y pendientes que requieren acción aparecen primero, con enlaces directos a la lista ya filtrada.
4. **Nada se pierde sin rastro:** las acciones quedan registradas y lo que se corrige se anula con motivo en vez de borrarse.
5. **Honestidad del producto:** no prometer lo que el sistema no hace (por ejemplo, llamar IA a un motor de reglas).

## Accessibility & Inclusion

- Contraste WCAG AA en texto y botones (por eso el botón principal usa los tonos 600–700 del azul).
- Controles táctiles de al menos 44 px en celular; campos de formulario a 16 px en celular para que Safari no haga zoom.
- Nada que dependa solo de pasar el mouse; nada flotante que tape contenido (el botón SOS ocupa la esquina inferior derecha).
- Respeto de "reducir movimiento" del sistema; modo claro y oscuro.
