import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "@phosphor-icons/react";
import { useAuth } from "../context/AuthContext";
import { PieDePagina } from "../components/PieDePagina";

// Aviso de privacidad (Ley N.º 19.628 modificada por la Ley N.º 21.719, vigente desde el 1 de
// diciembre de 2026). Pagina publica, fuera de ProtectedRoute: la tiene que poder leer cualquiera,
// incluso antes de iniciar sesion o una visita que abre el link de su QR.
//
// El texto sirve para cualquier comunidad: no muestra datos de relleno. Con la sesion iniciada
// nombra el condominio de la persona. Los plazos de conservacion (PLAZOS) son una propuesta: cada
// comunidad debe confirmarlos, idealmente con alguien con formacion legal, antes de usar la app
// con residentes reales.
const REGION_SERVIDORES = "Estados Unidos";
const ULTIMA_ACTUALIZACION = "5 de octubre de 2026";

const DATOS: [string, string, string, string][] = [
  [
    "Identificación y cuenta",
    "Nombre, apellido, correo, rol y contraseña (guardada cifrada, nunca en texto legible)",
    "Residentes, conserjes y administración",
    "Los ingresa la administración al crear la cuenta",
  ],
  ["Contacto y perfil", "Teléfono y foto de perfil, ambos opcionales", "Usuarios", "Los agregas tú desde tu perfil"],
  ["Unidad", "Torre y departamento donde vives", "Residentes", "La administración"],
  [
    "Control de acceso (QR)",
    "Tu credencial QR, el nombre de tus visitas, la fecha y horario de cada invitación, cada ingreso autorizado o rechazado y qué conserje lo validó",
    "Residentes y sus visitas",
    "Se generan al usar el QR",
  ],
  [
    "Alertas SOS",
    "Quién activó la alerta, su unidad, el tipo de emergencia (Carabineros, Bomberos o Ambulancia), la hora, y quién la atendió, cuándo y qué se hizo",
    "Residentes",
    "Se generan al pulsar el botón SOS y al atender la alerta",
  ],
  [
    "Notificaciones push",
    "Identificador del navegador o dispositivo para enviarte avisos, y el historial de notificaciones",
    "Usuarios que las activan",
    "Se generan al aceptar las notificaciones",
  ],
  [
    "Vida en el condominio",
    "Reservas de espacios comunes, multas (motivo y monto), incidencias que reportas (texto, ubicación y foto opcional) y encomiendas recibidas (remitente, número de seguimiento, foto del paquete y quién la retiró)",
    "Residentes",
    "Los generas tú o la administración",
  ],
  [
    "Gastos comunes",
    "Monto mensual que corresponde a tu unidad, pagos registrados (monto, fecha, medio y número de comprobante) y saldo pendiente",
    "Residentes, por unidad",
    "Los registra la administración",
  ],
  [
    "Registro de acciones",
    "Qué acción administrativa hizo cada usuario y cuándo",
    "Administración y conserjería",
    "Se genera automáticamente",
  ],
];

const FINALIDADES: [string, string, string][] = [
  [
    "Darte acceso a la app y mantener tu cuenta segura",
    "Identificación, cuenta y unidad",
    "Tu relación con la comunidad como residente o trabajador, y la Ley N.º 21.442 de Copropiedad Inmobiliaria",
  ],
  ["Controlar el ingreso al condominio con QR", "Control de acceso", "Interés legítimo de la comunidad en la seguridad del edificio"],
  ["Avisar a conserjería y administración de una emergencia", "Alertas SOS", "Interés vital tuyo o de otras personas"],
  [
    "Enviarte avisos del condominio al celular o navegador",
    "Notificaciones push",
    "Tu consentimiento: las activas tú y puedes desactivarlas cuando quieras",
  ],
  [
    "Gestionar reservas, multas, incidencias, encomiendas y comunicados",
    "Vida en el condominio",
    "Administración de la copropiedad según la Ley N.º 21.442 y el reglamento de copropiedad",
  ],
  [
    "Cobrar los gastos comunes y llevar el estado de cuenta de cada unidad",
    "Gastos comunes y unidad",
    "Obligación de pagar los gastos comunes según la Ley N.º 21.442 y el reglamento de copropiedad",
  ],
  ["Dejar constancia de quién hizo cada acción administrativa", "Registro de acciones", "Interés legítimo en la transparencia y seguridad de la gestión"],
  ["Mostrar tu teléfono y foto a la administración", "Contacto y perfil", "Tu consentimiento, al agregarlos"],
];

const QUIEN_VE: [string, string, string][] = [
  ["Administración", "Todos los datos de la sección 2", "Gestionar el condominio"],
  [
    "Conserjería",
    "Tu nombre y unidad al validar un QR, las alertas SOS y las encomiendas",
    "Controlar accesos, atender emergencias y entregar paquetes",
  ],
  ["Tus visitas", "Tu nombre y unidad, cuando el conserje valida su invitación", "Confirmar a quién vienen a ver"],
];

const PLAZOS: [string, string, string][] = [
  ["Cuenta y perfil", "Mientras seas residente o trabajador, más 6 meses", "Se eliminan o anonimizan"],
  ["Registro de accesos QR e invitaciones", "12 meses desde el ingreso", "Se eliminan"],
  ["Alertas SOS", "12 meses desde la alerta", "Se eliminan"],
  ["Suscripción push", "Hasta que desactives las notificaciones o el navegador la invalide", "Se elimina de inmediato"],
  ["Notificaciones", "Hasta que las borres, o 6 meses", "Se eliminan"],
  ["Multas y reservas", "5 años, por posibles reclamos o cobros", "Se eliminan"],
  ["Gastos comunes y pagos", "5 años, por posibles reclamos o cobros", "Se eliminan"],
  ["Incidencias y sus fotos", "2 años desde su cierre", "Se eliminan"],
  ["Registro de acciones administrativas", "5 años", "Se elimina"],
];

const DERECHOS: [string, string][] = [
  ["Acceso", "Saber qué datos tuyos tenemos, para qué y a quién se los entregamos."],
  ["Rectificación", "Corregir datos inexactos o incompletos. Tu nombre, teléfono y foto los puedes cambiar tú en Mi perfil."],
  ["Supresión", "Que eliminemos tus datos cuando ya no sean necesarios o retires tu consentimiento."],
  ["Oposición", "Que dejemos de usar tus datos para un fin basado en interés legítimo."],
  ["Portabilidad", "Recibir tus datos en un formato estructurado y de uso común."],
  ["Bloqueo", "Que suspendamos temporalmente el uso de tus datos mientras se resuelve una solicitud."],
];

function Seccion({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 space-y-3">
      <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">{titulo}</h2>
      {children}
    </section>
  );
}

function Tabla({ columnas, filas }: { columnas: string[]; filas: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/40 dark:text-slate-400">
          <tr>
            {columnas.map((c) => (
              <th key={c} scope="col" className="px-3 py-2 font-semibold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
          {filas.map((fila) => (
            <tr key={fila[0]} className="align-top">
              {fila.map((celda, i) => (
                <td key={i} className={i === 0 ? "px-3 py-2 font-medium text-slate-800 dark:text-slate-100" : "px-3 py-2"}>
                  {celda}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Privacidad() {
  const { usuario } = useAuth();
  const comunidad = usuario?.condominio?.nombre;

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 via-slate-50 to-slate-100 px-4 py-8 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950">
      <article className="mx-auto w-full max-w-3xl space-y-8 rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-relaxed text-slate-600 shadow-xl shadow-brand-900/5 sm:p-10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
        <Link
          to={usuario ? "/" : "/login"}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:underline max-sm:min-h-11 dark:text-brand-400"
        >
          <ArrowLeft size={14} /> {usuario ? "Volver a HabitaSmart" : "Volver al inicio de sesión"}
        </Link>

        <header className="space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-600/30">
            <ShieldCheck size={26} weight="duotone" />
          </div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Aviso de privacidad</h1>
          <p>
            Este aviso explica qué datos personales trata HabitaSmart, para qué, quién los ve y cómo ejercer tus derechos,
            según la Ley N.º 19.628 sobre Protección de Datos Personales, modificada por la Ley N.º 21.719. Última
            actualización: {ULTIMA_ACTUALIZACION}.
          </p>
        </header>

        <Seccion id="responsable" titulo="1. Quién es responsable de tus datos">
          <p>
            El responsable del tratamiento es la comunidad de copropietarios de tu condominio
            {comunidad ? (
              <>
                {" "}
                (<strong>{comunidad}</strong>)
              </>
            ) : null}
            , representada por su administración. La comunidad decide para qué y cómo se usan tus datos.
          </p>
          <p>
            HabitaSmart es la plataforma que la comunidad usa para gestionar el condominio. Actúa como encargado del
            tratamiento: trata los datos solo por cuenta de la comunidad y según sus instrucciones.
          </p>
          <p>
            <strong>Contacto para temas de privacidad:</strong> la administración de tu condominio, por los canales que
            informe en sus comunicados, o en conserjería.
          </p>
        </Seccion>

        <Seccion id="datos" titulo="2. Qué datos tratamos">
          <p>
            Solo tratamos los datos que la app necesita para funcionar. No usamos tu ubicación, no tenemos herramientas de
            analítica ni publicidad, y no vendemos tus datos.
          </p>
          <Tabla columnas={["Categoría", "Datos", "De quién", "De dónde salen"]} filas={DATOS} />
          <p>En tu dispositivo, la app guarda tu sesión y tu preferencia de tema claro u oscuro. No usa cookies de terceros.</p>
          <p>
            <strong>Datos de visitas:</strong> cuando invitas a alguien, nos entregas su nombre. Avísale que registrarás ese
            dato para su ingreso al condominio.
          </p>
        </Seccion>

        <Seccion id="finalidades" titulo="3. Para qué usamos tus datos y con qué base legal">
          <p>Cada uso tiene una base de licitud reconocida por la ley. No usamos tus datos para fines distintos a estos.</p>
          <Tabla columnas={["Finalidad", "Datos usados", "Base de licitud"]} filas={FINALIDADES} />
          <p>
            <strong>Clasificación de incidencias:</strong> la app sugiere una prioridad, y una categoría si no eliges una,
            usando reglas fijas de palabras clave. Una persona de la administración revisa cada incidencia y puede
            cambiarlas, así que no se toman decisiones automatizadas sobre ti.
          </p>
        </Seccion>

        <Seccion id="destinatarios" titulo="4. Quién puede ver tus datos">
          <p>Dentro del condominio, cada persona ve solo lo que su rol necesita. Otros residentes no ven tus datos.</p>
          <Tabla columnas={["Quién", "Qué ve", "Para qué"]} filas={QUIEN_VE} />
          <p>
            <strong>Proveedores que tratan datos por cuenta de la comunidad:</strong>
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Render Services, Inc. aloja la app y la base de datos en servidores ubicados en {REGION_SERVIDORES}.
              Esto es una transferencia internacional de datos.
            </li>
            <li>
              Los servicios de notificación de cada navegador (Google para Chrome y Android, Mozilla para Firefox, Apple para
              Safari) transportan los avisos push. El contenido viaja cifrado y estos servicios no pueden leerlo.
            </li>
          </ul>
          <p>Solo entregaremos tus datos a autoridades cuando una ley o una resolución judicial lo exija.</p>
        </Seccion>

        <Seccion id="conservacion" titulo="5. Cuánto tiempo guardamos tus datos">
          <p>
            Guardamos tus datos mientras vivas o trabajes en el condominio y, después, solo el tiempo que indica esta tabla.
          </p>
          <Tabla columnas={["Datos", "Plazo", "Después"]} filas={PLAZOS} />
        </Seccion>

        <Seccion id="derechos" titulo="6. Tus derechos y cómo ejercerlos">
          <p>
            Puedes ejercer gratis estos derechos pidiéndolo a la administración de tu condominio o en conserjería.
            Responderemos en un máximo de 30 días corridos, prorrogables una vez por otros 30 si lo justificamos.
          </p>
          <Tabla columnas={["Derecho", "Qué puedes pedir"]} filas={DERECHOS} />
          <p>
            Antes de responder verificaremos tu identidad. Puedes retirar tu consentimiento a las notificaciones push en
            cualquier momento desde Mi perfil o desde la configuración del navegador.
          </p>
          <p>
            Si no estás conforme con nuestra respuesta, puedes reclamar ante la Agencia de Protección de Datos Personales.
          </p>
        </Seccion>

        <Seccion id="seguridad" titulo="7. Seguridad, datos sensibles, menores y cambios">
          <p>
            <strong>Seguridad.</strong> Las contraseñas se guardan cifradas, la conexión viaja por HTTPS, las sesiones
            expiran y se invalidan al cambiar la contraseña, y los códigos QR van firmados y caducan. Si ocurre una
            vulneración que ponga en riesgo tus datos, la informaremos a la Agencia y, cuando corresponda, a ti.
          </p>
          <p>
            <strong>Datos sensibles.</strong> Una alerta SOS de tipo Ambulancia puede revelar que alguien necesitó atención
            de salud. Esa información solo la ven administración y conserjería, y solo se usa para atender la emergencia.
          </p>
          <p>
            <strong>Menores de edad.</strong> Las cuentas son para personas adultas. Si invitas a un menor de 14 años,
            registra solo el nombre necesario para su ingreso.
          </p>
          <p>
            <strong>Cambios a este aviso.</strong> Si lo cambiamos, te lo informaremos en la app antes de que el cambio rija.
          </p>
        </Seccion>
      </article>
      <PieDePagina className="mt-6" />
    </div>
  );
}
