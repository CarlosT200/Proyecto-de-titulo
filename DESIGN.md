---
name: HabitaSmart
description: Administración y convivencia de condominios, para administración, residentes y conserjería.
colors:
  portico-blue: "#2563eb"
  portico-blue-deep: "#1d4ed8"
  night-blue: "#1e3a8a"
  blue-mist: "#eff6ff"
  sunset-orange: "#ea580c"
  sunset-mist: "#fff7ed"
  ink: "#0f172a"
  ink-soft: "#475569"
  ink-muted: "#64748b"
  line: "#e2e8f0"
  field-line: "#cbd5e1"
  canvas: "#f8fafc"
  surface: "#ffffff"
  night-canvas: "#0b1120"
  night-surface: "#1e293b"
  success: "#059669"
  warning: "#d97706"
  danger: "#dc2626"
typography:
  display:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.33
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.43
  body:
    fontFamily: "Open Sans, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Open Sans, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.portico-blue}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    typography: "{typography.title}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
    typography: "{typography.body}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "20px"
  nav-item-active:
    backgroundColor: "{colors.portico-blue-deep}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  badge:
    rounded: "{rounded.full}"
    padding: "2px 10px"
    typography: "{typography.label}"
---

# Design System: HabitaSmart

## Overview

**Creative North Star: "La conserjería bien llevada"**

HabitaSmart debe sentirse como una buena portería: ordenada, atenta y confiable. Todo está en su lugar y a la vista. Lo urgente se nota primero, el resto espera tranquilo, y nadie tiene que adivinar qué hace un botón. La marca (azul de portería y naranja de atardecer) vive en los detalles precisos: el ícono del encabezado, la pastilla del menú activo, el botón principal. No se reparte por toda la pantalla.

Hay dos registros. Las **portadas** (login, inicio del residente, inicio de conserjería, saludo del panel) pueden ser expresivas: degradé azul→naranja, grilla sutil, el edificio de marca de agua. Las **pantallas de trabajo** (tablas, formularios, listas, detalle) son sobrias: superficies planas, bordes finos, jerarquía tipográfica clara y el color reservado para el estado y la acción. La densidad es media: compacta en escritorio para la administración, holgada en celular, donde manda el dedo y no el cursor.

Rechazos confirmados: la paleta teal / "lujo inmobiliario" con tipografías decorativas; los íconos que cambian de significado (un único ícono sol/luna); las acciones que solo aparecen al pasar el mouse; lo flotante que tapa contenido.

**Key Characteristics:**
- Azul para actuar y navegar; naranja como firma de marca, no como botón.
- Superficies planas con borde en las pantallas de trabajo; expresión solo en las portadas.
- Estados con color y texto a la vez (insignias con palabra, nunca solo un punto de color).
- Celular primero para residentes y conserjería: 44 px táctiles, campos a 16 px.
- Modo claro y oscuro completos, con los mismos roles de color.

## Colors

Un azul confiable que hace el trabajo, un naranja cálido que firma la marca y una escala de grises pizarra para todo lo demás.

### Primary
- **Azul Portería** (#2563eb): color de acción y navegación. Botón principal (en degradé hacia el Azul Portería Profundo), foco de los campos, enlaces e íconos de encabezado de página.
- **Azul Portería Profundo** (#1d4ed8): lado oscuro del botón principal y de la pastilla del menú activo; mantiene el blanco encima con contraste AA.
- **Azul Noche** (#1e3a8a): cielo del login y fondos de marca oscuros.
- **Bruma Azul** (#eff6ff): fondo de selección suave (opción elegida, ícono de lista, pastilla del perfil).

### Secondary
- **Naranja Atardecer** (#ea580c): firma de la marca. El punto del encabezado de cada página, el final del degradé de las portadas y los acentos de "Requiere atención". No se usa para botones de acción ni para errores.
- **Bruma Naranja** (#fff7ed): fondos cálidos puntuales del degradé de las portadas.

### Neutral
- **Tinta** (#0f172a): títulos y texto principal en modo claro.
- **Tinta Suave** (#475569): texto secundario, etiquetas de campos y botones secundarios.
- **Tinta Tenue** (#64748b): subtítulos, ayudas y metadatos. Es el gris más claro permitido para texto sobre blanco.
- **Línea** (#e2e8f0): bordes de tarjetas y divisores.
- **Línea de Campo** (#cbd5e1): borde de inputs y selects (un paso más marcado que la Línea, para que el campo se vea tocable).
- **Lienzo** (#f8fafc) y **Superficie** (#ffffff): fondo de la aplicación y de tarjetas en modo claro.
- **Lienzo Nocturno** (#0b1120) y **Superficie Nocturna** (#1e293b): sus equivalentes en modo oscuro.

### Semánticos
- **Éxito** (#059669): pagado, autorizado, resuelto, "Todo en orden".
- **Advertencia** (#d97706): por pagar, atrasado de 48 h, pendiente de revisión.
- **Peligro** (#dc2626): vencido, rechazado, urgente, SOS y acciones destructivas.

### Named Rules
**The Blue Works, Orange Signs Rule.** El azul es el único color de acción (botones, enlaces, foco, selección). El naranja firma la marca y señala atención; nunca es el color de un botón.

**The Word-With-Color Rule.** Ningún estado se comunica solo con color: cada insignia lleva su palabra ("Vencido", "Por retirar", "Atendida").

## Typography

**Display Font:** Poppins (con system-ui, sans-serif)
**Body Font:** Open Sans (con system-ui, sans-serif)

**Character:** Poppins, geométrica y redonda, da a títulos y cifras un tono amable y firme. Open Sans, abierta y muy legible en tamaños chicos, carga todo el texto de uso diario.

### Hierarchy
- **Display** (700, 1.875rem / 30px, interlineado 1.2, tracking −0.025em): saludo de las portadas y cifras grandes de las tarjetas de resumen. En celular los montos largos se achican según el ancho de la tarjeta.
- **Headline** (700, 1.5rem / 24px; 1.25rem / 20px en celular): título de cada página, junto a su ícono.
- **Title** (600, 0.875rem / 14px): títulos de tarjeta y de ventana (h3 en Poppins).
- **Body** (400, 0.875rem / 14px; 1rem / 16px dentro de campos en celular): texto, celdas de tabla y mensajes.
- **Label** (500, 0.75rem / 12px): etiquetas de campos, insignias y metadatos. Los encabezados de tabla van en mayúsculas en Tinta Tenue.

### Named Rules
**The Two Families Rule.** Solo Poppins y Open Sans. Las cifras y los títulos van en Poppins; todo lo que se lee de corrido va en Open Sans.

**The Sixteen On Phones Rule.** Todo campo editable mide 16 px en celular; con menos, Safari del iPhone hace zoom al tocarlo.

## Layout

- **Estructura:** menú lateral de 256 px (plegable en escritorio, cajón deslizante en celular) + encabezado fijo + columna de contenido con `min-w-0` para que las tablas anchas se desplacen por dentro sin empujar la página. El residente parte con el menú oculto; administración y conserjería, con el menú visible.
- **Ritmo:** 24 px entre bloques de una página; 20 px de relleno dentro de tarjetas; 12–16 px entre tarjetas de una grilla.
- **Grillas:** resúmenes en 2 columnas en celular y 3–4 en escritorio; formularios con texto libre en 1 columna en celular y 2 desde 640 px (solo fechas, horas y números pueden ir de a dos en celular).
- **Tablas en celular:** bajo 640 px cada fila se convierte en una tarjeta "Etiqueta · valor"; la primera celda es el título y las celdas sin etiqueta son los botones.
- **Zona del SOS:** el botón SOS ocupa los últimos 88 px de la esquina inferior derecha; el contenido del residente reserva ese espacio para que nada quede debajo.
- **Avisos (toasts):** bajo el encabezado, nunca abajo.

## Elevation & Depth

Las pantallas de trabajo son **planas con borde**: la superficie se separa del lienzo con una línea fina (Línea) y, como mucho, una sombra mínima. La profundidad real (sombra amplia) se reserva para lo que está por encima del contenido: ventanas, menús desplegables, el panel de avisos y el botón SOS. En las portadas se permite el lenguaje expresivo de la marca (degradés, grilla, brillos difusos).

Estado actual: las tarjetas todavía son translúcidas con desenfoque y suben al pasar el mouse. Pasarlas a planas es la dirección acordada y se hará pantalla por pantalla.

### Shadow Vocabulary
- **Reposo** (`box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05)`): tarjetas y tablas en reposo, si se necesita.
- **Acción** (`box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25)`): el botón principal, que es la única superficie de trabajo con sombra de color.
- **Capa superior** (`box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.25)`): ventanas y menús.

### Named Rules
**The Flat-At-Work Rule.** En tablas, formularios y listas, nada se eleva al pasar el mouse ni flota sobre el lienzo; la jerarquía la dan el borde, el espacio y la tipografía.

## Shapes

Esquinas suaves y consistentes por tamaño: 8 px en controles (botones, campos, selects), 12 px en piezas medianas (ítems del menú, ventanas, bloques internos) y 16 px en tarjetas y paneles. Insignias, avatares y el botón SOS son totalmente redondos. Los bordes son de 1 px; no se usan bordes gruesos ni contornos decorativos.

## Components

### Buttons
- **Carácter:** firmes y explícitos; siempre con texto (o con `aria-label` si son solo ícono).
- **Shape:** esquinas de 8 px; 44 px de alto mínimo en celular.
- **Primary:** degradé de Azul Portería a Azul Portería Profundo con texto blanco y sombra de Acción; al pasar el mouse, un poco más brillante.
- **Secondary:** Superficie con borde Línea de Campo y texto Tinta Suave.
- **Danger:** Peligro sólido con texto blanco, solo para acciones destructivas confirmadas.
- **Ghost:** sin fondo, para acciones terciarias dentro de filas y ventanas.

### Chips (insignias de estado)
- **Style:** píldora (radio completo), fondo tenue del color semántico y texto del mismo color en tono oscuro; en modo oscuro, fondo translúcido y texto claro.
- **State:** siempre con palabra; una por estado (Por pagar, Vencido, Pagado; Por retirar, Retirada, Devuelta…).

### Cards / Containers
- **Corner Style:** 16 px.
- **Background:** Superficie (modo claro) / Superficie Nocturna (modo oscuro).
- **Shadow Strategy:** plana con borde (ver Elevation & Depth).
- **Border:** 1 px en Línea.
- **Internal Padding:** 20 px; el encabezado de tarjeta lleva título en Title, subtítulo en Tinta Tenue y una línea divisoria abajo.

### Inputs / Fields
- **Style:** Superficie, borde de 1 px en Línea de Campo, esquinas de 8 px, 16 px de texto en celular y 14 px en escritorio.
- **Focus:** el borde pasa a Azul Portería con un halo de Bruma Azul de 2 px.
- **Etiquetas:** siempre visibles arriba del campo (Label en Tinta Suave), enlazadas con `htmlFor`.

### Navigation
- **Menú lateral:** ítems con ícono y texto en Body 500, esquinas de 12 px. El activo es una pastilla en degradé de Azul Portería Profundo a Azul Portería, con texto blanco (oscuro del lado del texto para mantener contraste). Hover en gris muy tenue.
- **Celular:** cajón deslizante con el mismo listado; encabezado con logo, avisos, tema y foto de perfil.

### Encabezado de página (componente distintivo)
Ícono en un cuadro de 48 px con degradé azul y el **punto naranja** en la esquina, título en Headline y subtítulo en Tinta Tenue; la acción principal de la página va a la derecha (debajo en celular).

### Requiere atención (componente distintivo)
Lista de pendientes urgentes con número grande, texto y enlace a la lista ya filtrada; solo muestra los que no están en cero y, si no hay ninguno, dice "Todo en orden".

## Do's and Don'ts

### Do:
- **Do** usar el azul (#2563eb → #1d4ed8) para toda acción y el naranja (#ea580c) solo como firma o señal de atención.
- **Do** acompañar cada color de estado con su palabra.
- **Do** mantener 44 px táctiles y campos de 16 px en celular, y probar cada pantalla en 375 px y en escritorio, en modo claro y oscuro.
- **Do** dejar las tarjetas de las pantallas de trabajo planas con borde de 1 px (#e2e8f0).
- **Do** poner lo urgente primero y enlazarlo a la lista ya filtrada.

### Don't:
- **Don't** usar la paleta teal ni tipografías decorativas de "lujo inmobiliario".
- **Don't** usar un ícono que cambia de significado para alternar estados (por ejemplo, un único sol/luna en escritorio).
- **Don't** esconder acciones detrás del hover ni usar diálogos nativos del navegador.
- **Don't** poner nada fijo o flotante sobre la zona del botón SOS (88 px abajo a la derecha) ni avisos en la parte inferior.
- **Don't** usar texto más claro que #64748b sobre fondo blanco.
- **Don't** usar emoji como íconos.
