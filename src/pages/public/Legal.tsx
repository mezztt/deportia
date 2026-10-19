import { useEffect } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { APP_BRAND, APP_NAME } from "../../config";
import { DeportiaLogo, InstagramLink, MezzttLink, PoweredBy, useBrandLinks, useLightPage } from "../../components/Brand";

/**
 * Textos legales públicos (sin login): /legal/terminos y /legal/privacidad.
 * Son textos generales del servicio; no reemplazan el asesoramiento de un profesional (ver LEGAL.md).
 */
const UPDATED = "octubre de 2026";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="dp-legal-section"><h2>{title}</h2>{children}</section>;
}

function Contact() {
  const links = useBrandLinks();
  return (
    <p className="dp-legal-contact">
      Escribinos por el Instagram de <MezzttLink />
      <InstagramLink href={links.mezztt_instagram_url} label={`Instagram de ${APP_BRAND}`} />
    </p>
  );
}

function Terminos() {
  return (
    <>
      <p className="dp-legal-lead">
        Estas son las condiciones para usar {APP_NAME}. Están escritas en lenguaje simple. Si usás el sistema, entendemos que las aceptás.
      </p>
      <Section title={`1. Qué es ${APP_NAME}`}>
        <p>{APP_NAME} es un sistema de gestión para complejos deportivos: turnos y canchas, turnos fijos, clientes, buffet, torneos, cobros y una web para que los jugadores reserven, según los módulos que cada complejo contrate.</p>
      </Section>
      <Section title="2. Quién presta el servicio">
        <p>El servicio lo presta {APP_BRAND}, que desarrolla y mantiene el sistema. El cliente es el complejo deportivo que lo contrata, y es quien decide qué personas de su equipo tienen usuario.</p>
      </Section>
      <Section title="3. Cuenta y contraseñas">
        <ul>
          <li>Cada usuario es personal. No compartas tu contraseña.</li>
          <li>El complejo es responsable de lo que se hace con los usuarios que crea y de darlos de baja cuando alguien deja de trabajar ahí.</li>
          <li>Si creés que alguien entró con tu usuario, cambiá la contraseña y avisanos.</li>
        </ul>
      </Section>
      <Section title="4. Uso permitido">
        <ul>
          <li>El sistema es para la actividad del complejo. No se puede usar para fines ilegales ni para cargar datos de personas sin tener derecho a hacerlo.</li>
          <li>No está permitido intentar entrar a datos de otros complejos, copiar el sistema ni afectar su funcionamiento.</li>
        </ul>
      </Section>
      <Section title="5. Reservas, señas y torneos">
        <ul>
          <li>Las reservas, los precios, las señas y su devolución los define cada complejo. {APP_NAME} es la herramienta con la que el complejo los gestiona: el acuerdo por el turno es entre el jugador y el complejo.</li>
          <li>Cuando un complejo pide seña, el pago se hace en Mercado Pago, con la cuenta del complejo. Antes de pagar se muestra su política de cancelación y devolución.</li>
          <li>Los torneos, sus reglas, inscripciones y premios los organiza el complejo.</li>
        </ul>
      </Section>
      <Section title="6. Comprobantes">
        <p>{APP_NAME} <b>no emite</b> comprobantes fiscales de ARCA (ex AFIP). Los tickets, comprobantes de reserva y resúmenes que muestra o imprime son documentos internos, no válidos como factura. La factura, cuando corresponde, la emite el complejo por sus propios medios.</p>
      </Section>
      <Section title="7. Abono y baja del servicio">
        <ul>
          <li>El servicio tiene un pago inicial y un abono mensual según los módulos contratados, acordados con {APP_BRAND} antes de empezar.</li>
          <li>Podés pedir la baja cuando quieras, por los mismos medios por los que te contactás con nosotros, sin trámites adicionales.</li>
          <li>Si reservás por la web, en la página de reservas y en el ticket tenés el «Botón de arrepentimiento» y el «Botón de baja de servicio» (Disposición 954/2025 de la Subsecretaría de Defensa del Consumidor). No hace falta registrarte y recibís un código de registración al instante. El arrepentimiento tiene excepciones, por ejemplo si el servicio ya se usó.</li>
          <li>Si el abono queda impago, el acceso puede suspenderse después de avisarte. Los datos no se borran por eso.</li>
        </ul>
      </Section>
      <Section title="8. Tus datos son tuyos">
        <p>Los datos que el complejo carga en el sistema son del complejo. Podés pedirnos una copia en cualquier momento, también al darte de baja. Cómo los cuidamos está explicado en la <Link to="/legal/privacidad">Política de privacidad</Link>.</p>
      </Section>
      <Section title="9. Disponibilidad">
        <p>Trabajamos para que el sistema esté disponible todo el tiempo y hacemos copias de seguridad, pero no podemos garantizar que nunca haya cortes: pueden existir interrupciones por mantenimiento, por fallas de internet o de los proveedores de alojamiento y de pagos.</p>
      </Section>
      <Section title="10. Responsabilidad">
        <p>{APP_BRAND} responde por el funcionamiento del sistema dentro de lo razonable. No responde por los datos mal cargados, por las decisiones que el complejo tome con esos datos, ni por el uso del sistema fuera de estas condiciones. La relación con los jugadores, los equipos y los clientes del complejo es del complejo.</p>
      </Section>
      <Section title="11. Cambios">
        <p>Podemos mejorar el sistema y actualizar estas condiciones. Si el cambio es importante, te avisamos antes.</p>
      </Section>
      <Section title="12. Ley aplicable">
        <p>Estas condiciones se rigen por las leyes de la República Argentina.</p>
      </Section>
      <Section title="13. Contacto"><Contact /></Section>
    </>
  );
}

function Privacidad() {
  return (
    <>
      <p className="dp-legal-lead">
        Acá te contamos qué datos personales se guardan en {APP_NAME}, para qué se usan y qué derechos tenés, según la Ley 25.326 de Protección de Datos Personales.
      </p>
      <Section title="1. Quién es responsable de los datos">
        <ul>
          <li>El <b>complejo deportivo</b> que usa {APP_NAME} es el responsable de su base de datos: decide qué datos carga y para qué.</li>
          <li><b>{APP_BRAND}</b> presta el software y guarda esos datos por cuenta del complejo. No los usa para otra cosa.</li>
        </ul>
      </Section>
      <Section title="2. Qué datos se guardan y para qué">
        <ul>
          <li><b>Reservas:</b> nombre, teléfono y, si lo cargás, email y cantidad de jugadores. Sirven para tomar el turno, avisarte y recibirte en el complejo.</li>
          <li><b>Clientes del complejo</b> (si el complejo usa ese módulo): historial de turnos, ausencias, consumos y saldos. Sirven para la atención y la cobranza del complejo.</li>
          <li><b>Torneos:</b> nombre de los equipos y de los jugadores, y el contacto del delegado. En la página pública del torneo solo se muestran los nombres de equipos y jugadores: nunca teléfonos ni otros datos de contacto.</li>
          <li><b>Usuarios del sistema:</b> nombre, email y rol de las personas que trabajan en el complejo, y el registro de lo que cargan (por ejemplo, quién anotó un cobro o un resultado).</li>
        </ul>
      </Section>
      <Section title="3. Si reservás por la web">
        <p>Te pedimos nombre y teléfono y, si querés, email. Esos datos los recibe el complejo donde reservás, solo para gestionar tu turno. Si el complejo pide seña, el pago se hace en Mercado Pago: {APP_NAME} no ve ni guarda los datos de tu tarjeta.</p>
      </Section>
      <Section title="4. No se venden ni se ceden">
        <p>Los datos no se venden, no se alquilan y no se entregan a terceros para publicidad. Solo se comparten cuando lo exige la ley o una orden judicial, o con los proveedores técnicos necesarios para que el sistema funcione (alojamiento y, si pagás una seña, Mercado Pago), que están obligados a mantener la confidencialidad.</p>
      </Section>
      <Section title="5. Tus derechos">
        <p>Podés pedir <b>acceso</b> a tus datos, que se <b>rectifiquen</b> o <b>actualicen</b> si están mal, y que se <b>supriman</b> cuando corresponda.</p>
        <p>El pedido se hace ante el complejo donde reservaste o jugaste, que es el responsable de la base. Si no sabés a quién dirigirte, escribinos y te orientamos.</p>
      </Section>
      <Section title="6. Seguridad">
        <p>Las contraseñas se guardan cifradas, la conexión es segura (https), cada complejo ve solo sus propios datos y se hacen copias de seguridad. Ningún sistema es infalible: si detectamos un problema que afecte tus datos, se lo avisamos al responsable.</p>
      </Section>
      <Section title="7. Cookies y seguimiento">
        <p>{APP_NAME} no usa cookies de publicidad ni rastreadores de terceros. Solo guarda en tu navegador lo necesario para mantener tu sesión, tu preferencia de modo claro u oscuro y, en la web de reservas, el código de tus últimas reservas para que puedas volver a verlas.</p>
      </Section>
      <Section title="8. Órgano de control">
        <p className="dp-legal-quote">La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.</p>
      </Section>
      <Section title="9. Contacto"><Contact /></Section>
    </>
  );
}

const DOCS = {
  terminos: { title: "Términos y condiciones", other: "privacidad", otherLabel: "Política de privacidad", Body: Terminos },
  privacidad: { title: "Política de privacidad", other: "terminos", otherLabel: "Términos y condiciones", Body: Privacidad },
} as const;

function Legal({ doc }: { doc: keyof typeof DOCS }) {
  useLightPage();
  const d = DOCS[doc];
  useEffect(() => { document.title = `${d.title} · ${APP_NAME}`; window.scrollTo(0, 0); }, [d.title]);
  return (
    <main className="pub-page dp-legal-page">
      <header className="dp-legal-top">
        <div className="dp-legal-wrap dp-legal-top-row">
          <span className="dp-legal-brand"><DeportiaLogo size={34} /><strong>{APP_NAME}</strong></span>
          <button type="button" className="dp-legal-back" onClick={() => (window.history.length > 1 ? window.history.back() : window.location.assign("/"))}>‹ Volver</button>
        </div>
      </header>
      <div className="dp-legal-wrap">
        <article className="dp-legal-card">
          <span className="dp-legal-kicker">Legales</span>
          <h1>{d.title}</h1>
          <p className="dp-legal-updated">Última actualización: {UPDATED}</p>
          <d.Body />
          <p className="dp-legal-also">Leé también: <Link to={`/legal/${d.other}`}>{d.otherLabel}</Link></p>
        </article>
      </div>
      <footer className="pub-footer"><PoweredBy /></footer>
    </main>
  );
}

export default Legal;
