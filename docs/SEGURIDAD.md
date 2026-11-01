# Seguridad — Fase 1

Registro de las mejoras de seguridad de la Fase 1 y de las decisiones sobre dependencias
vulnerables. Lo que ya existía y es correcto no se repite aquí; esto documenta los cambios y los
riesgos pendientes.

## Dependencias (auditoría de `npm audit`)

Se aplicaron **solo los arreglos que no cambian versiones mayores** (`npm audit fix`, sin `--force`):
el total de vulnerabilidades bajó de 29 a 23 (sobre todo deduplicando `qs`, con un DoS en
`qs.stringify`). No se modificó ninguna versión declarada en `package.json`; solo `package-lock.json`.

Las siguientes requieren **cambios mayores** (con riesgo real de regresión) y se difieren a una tarea
dedicada con su propia batería de pruebas. Cada una tiene una mitigación vigente:

| Paquete | Actual → corregido | Severidad | Por qué se difiere | Mitigación vigente |
|---|---|---|---|---|
| `zod` | 3.25.76 → 4.x | **alta** (GHSA-mrhx-c7xc-m3w5: DoS por colecciones grandes) | zod 4 cambia API en todo el backend (validación de cada endpoint) | `express.json({ limit: "2mb" })` acota el cuerpo; la validación corre **después** de la autenticación en casi todas las rutas, así que no es alcanzable sin sesión |
| `react-router` / `react-router-dom` | 6.30.6 → 7.x | moderada (open redirect por `\` en `<Link>`/`useNavigate`; constructor injection en hidratación SSR) | migración v6→v7 (cambios de API de rutas) | la app es **SPA sin SSR** → el vector de hidratación no aplica; los destinos de navegación con entrada del usuario se validan en código (p. ej. el `volverA` del login solo acepta rutas `/acceso/...`) |
| `uuid` | 9.0.1 → 14.x | moderada (falta de bounds check en v3/v5/v6 cuando se pasa `buf`) | las versiones corregidas son **solo ESM**, incompatibles con el backend CommonJS/ts-node | la app genera IDs con `crypto.randomUUID` nativo; `uuid` entra solo de forma transitiva por tooling de Android (`xcode`) y el vector (v3/v5/v6 con `buf`) no se usa |

**Plan:** abordar `zod` 4 primero (es la única alta) en una rama propia, migrando los esquemas y
corriendo toda la suite; luego `react-router` 7. `uuid` queda como riesgo bajo aceptado mientras el
backend sea CommonJS.
