import { BrandMark } from "../components.jsx";

const privacySections = [
  {
    title: "1. Qué información trata Sendero",
    content: [
      "Cuando creas una cuenta, podemos recibir datos básicos de identidad como nombre, correo electrónico e identificadores del proveedor de acceso.",
      "Cuando planificas un viaje, tratamos la información que decides compartir: destinos, fechas, preferencias, acompañantes, movilidad, alojamiento, actividades, notas, reservas y cambios del itinerario.",
      "También podemos registrar datos técnicos mínimos para operar y proteger el servicio, como marcas de tiempo, acciones de acceso, errores y registros de seguridad.",
    ],
  },
  {
    title: "2. Para qué usamos la información",
    content: [
      "La usamos para crear y conservar itinerarios, mostrar componentes interactivos, sincronizar cambios autorizados, gestionar colaboradores, resolver enlaces compartidos y mantener la seguridad del servicio.",
      "No usamos el contenido privado de un viaje para hacerlo público. Publicar o invitar a otra persona requiere una acción explícita.",
    ],
  },
  {
    title: "3. Viajes compartidos",
    content: [
      "Un enlace público muestra una versión preparada para compartir. Debe excluir datos privados como la dirección precisa del alojamiento, notas internas, colaboradores e identificadores técnicos.",
      "Cualquier persona que obtenga un enlace público vigente puede abrirlo. Quien lo creó puede actualizarlo, reemplazarlo, establecer una vigencia o revocarlo.",
      "Los viajes restringidos requieren una cuenta autorizada. El permiso asignado determina si una persona puede visualizar o colaborar.",
    ],
  },
  {
    title: "4. Proveedores y servicios externos",
    content: [
      "Sendero utiliza proveedores de infraestructura, autenticación, almacenamiento y mapas para prestar el servicio. Cada enlace de reserva, transporte, evento o establecimiento conduce a un servicio independiente con sus propias condiciones.",
      "Compartimos con esos proveedores únicamente la información necesaria para ejecutar la función solicitada.",
    ],
  },
  {
    title: "5. Conservación, control y seguridad",
    content: [
      "Conservamos la información mientras la cuenta o el viaje sigan activos y durante el tiempo razonablemente necesario para seguridad, continuidad y cumplimiento de obligaciones aplicables.",
      "Puedes dejar de compartir un enlace, retirar colaboradores o solicitar el cierre de tu cuenta. Aplicamos controles técnicos y organizativos para proteger la información, aunque ningún sistema conectado puede garantizar seguridad absoluta.",
    ],
  },
  {
    title: "6. Cambios y consultas",
    content: [
      "Podemos actualizar esta política cuando cambien las funciones o los requisitos aplicables. La versión publicada indicará la fecha de la última actualización.",
      "Las consultas sobre privacidad se gestionan mediante el canal de soporte disponible en Sendero.",
    ],
  },
];

const termsSections = [
  {
    title: "1. El servicio",
    content: [
      "Sendero ayuda a crear, organizar, visualizar y compartir itinerarios mediante una experiencia conversacional. La web complementa esa conversación con páginas informativas y vistas de viajes compartidos.",
      "Al usar Sendero aceptas estas condiciones y la política de privacidad.",
    ],
  },
  {
    title: "2. Cuenta y acceso",
    content: [
      "Eres responsable de mantener segura tu cuenta y de las acciones realizadas desde ella. No debes compartir credenciales ni intentar acceder a viajes para los que no tienes autorización.",
      "El propietario de un viaje puede conceder acceso de solo lectura o colaboración y puede modificar o retirar ese acceso.",
    ],
  },
  {
    title: "3. Información de viaje",
    content: [
      "Sendero puede apoyarse en fuentes públicas y servicios externos para presentar horarios, clima, eventos, rutas, disponibilidad y requisitos de reserva. Esa información puede cambiar o contener errores.",
      "Antes de desplazarte, reservar o pagar, verifica la información crítica directamente con el proveedor correspondiente. Sendero no es una agencia de viajes ni celebra la compra o reserva en tu nombre salvo que una función lo indique de forma expresa.",
    ],
  },
  {
    title: "4. Contenido y enlaces compartidos",
    content: [
      "Conservas la responsabilidad sobre la información que introduces y compartes. Debes tener derecho a usarla y evitar incluir datos sensibles innecesarios.",
      "Si publicas un enlace, cualquier persona que lo obtenga puede acceder mientras esté activo. Eres responsable de elegir la audiencia adecuada y revocarlo cuando ya no deba estar disponible.",
    ],
  },
  {
    title: "5. Uso aceptable",
    content: [
      "No puedes usar Sendero para vulnerar derechos, distribuir contenido ilícito, interferir con el servicio, evadir controles de acceso, automatizar abuso ni obtener información de otras personas sin autorización.",
    ],
  },
  {
    title: "6. Disponibilidad y responsabilidad",
    content: [
      "El servicio puede cambiar, interrumpirse o dejar de ofrecer determinadas funciones. Sendero se ofrece como herramienta de planificación y no garantiza disponibilidad, exactitud ni idoneidad de proveedores externos.",
      "Nada en estas condiciones limita derechos que no puedan excluirse conforme a la legislación aplicable.",
    ],
  },
  {
    title: "7. Cambios y terminación",
    content: [
      "Podemos actualizar estas condiciones y suspender cuentas que incumplan estas reglas o comprometan la seguridad del servicio. La versión publicada mostrará su fecha de actualización.",
      "Las consultas sobre estas condiciones se gestionan mediante el canal de soporte disponible en Sendero.",
    ],
  },
];

export function LegalPage({ kind }) {
  const isPrivacy = kind === "privacy";
  const sections = isPrivacy ? privacySections : termsSections;
  return (
    <>
      <a className="site-skip-link" href="#contenido-legal">Saltar al contenido</a>
      <header className="legal-header">
        <a aria-label="Sendero, inicio" className="site-brand" href="/"><BrandMark /><span>Sendero</span></a>
        <a className="site-text-link" href="/">Volver al inicio <span aria-hidden="true">→</span></a>
      </header>
      <main className="legal-main" id="contenido-legal">
        <header className="legal-title">
          <p className="site-kicker">INFORMACIÓN LEGAL</p>
          <h1>{isPrivacy ? "Privacidad" : "Términos de uso"}</h1>
          <p>{isPrivacy
            ? "Esta política explica qué información trata Sendero y qué ocurre cuando compartes un viaje."
            : "Estas condiciones definen el uso responsable de Sendero y el alcance de la información de viaje."}</p>
          <time dateTime="2026-08-27">Última actualización: 27 de agosto de 2026</time>
        </header>
        <div className="legal-content">
          {sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              {section.content.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </section>
          ))}
        </div>
      </main>
      <footer className="site-footer legal-footer">
        <p>Sendero</p>
        <nav aria-label="Información legal"><a href="/privacy">Privacidad</a><a href="/terms">Términos</a></nav>
      </footer>
    </>
  );
}
