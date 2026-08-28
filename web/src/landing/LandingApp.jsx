import { useId, useRef, useState } from "react";
import { BrandMark } from "../components.jsx";

const demoViews = [
  { id: "list", label: "Lista" },
  { id: "calendar", label: "Calendario" },
  { id: "routes", label: "Rutas" },
];

const demoDays = [
  { date: "13", weekday: "Jue", title: "Centro histórico sin prisas", area: "Monserrat · San Nicolás" },
  { date: "14", weekday: "Vie", title: "San Telmo cotidiano", area: "San Telmo · Barracas" },
  { date: "15", weekday: "Sáb", title: "Diseño, parques y despedida", area: "Palermo · Villa Crespo" },
];

function chatGptUrl() {
  return document.querySelector('meta[name="sendero-chatgpt-url"]')?.content || "https://chatgpt.com/";
}

function ArrowIcon() {
  return <span aria-hidden="true">↗</span>;
}

function SiteHeader() {
  return (
    <header className="site-header">
      <a aria-label="Sendero, inicio" className="site-brand" href="/">
        <BrandMark />
        <span>Sendero</span>
      </a>
      <nav aria-label="Navegación principal" className="site-nav">
        <a href="#como-funciona">Cómo funciona</a>
        <a href="#capacidades">Qué considera</a>
        <a href="#compartir">Compartir</a>
      </nav>
      <div className="site-header-actions">
        <a className="site-text-link" href="/app">Mis viajes</a>
        <a className="site-button site-button-small" href={chatGptUrl()} rel="noreferrer noopener" target="_blank">
          Usar en ChatGPT <ArrowIcon />
        </a>
      </div>
    </header>
  );
}

function ConversationPreview() {
  return (
    <div aria-label="Ejemplo de una conversación con Sendero" className="site-conversation-preview">
      <div className="site-user-message">
        Nos quedamos en Palermo. Queremos conocer Buenos Aires como locales, sin auto, y salir un día de la ciudad.
      </div>
      <div className="site-agent-line">
        <BrandMark />
        <span>Organicé el viaje por zonas y dejé las reservas importantes a mano.</span>
      </div>
      <div className="site-trip-receipt">
        <div>
          <p className="site-kicker">BUENOS AIRES · 13–26 AGO</p>
          <strong>Barrios, sobremesas y río</strong>
          <span>14 días · transporte público · 1 escapada</span>
        </div>
        <span aria-hidden="true" className="site-receipt-arrow">→</span>
      </div>
    </div>
  );
}

function DemoList() {
  return (
    <div className="site-demo-days">
      {demoDays.map((day, index) => (
        <article className="site-demo-day" key={day.date}>
          <div className="site-demo-date"><span>{day.weekday}</span><strong>{day.date}</strong></div>
          <div><h3>{day.title}</h3><p>{day.area}</p></div>
          <span aria-hidden="true" className={index === 0 ? "site-demo-plus is-active" : "site-demo-plus"}>{index === 0 ? "−" : "+"}</span>
          {index === 0 ? (
            <div className="site-demo-detail">
              <div><time>10:30</time><p><strong>Plaza de Mayo y el eje cívico</strong><span>Historia, arquitectura y una primera lectura de la ciudad.</span></p></div>
              <div><time>13:00</time><p><strong>Café con historia</strong><span>Avenida de Mayo y una sobremesa porteña.</span></p></div>
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function DemoCalendar() {
  const cells = ["10", "11", "12", "13", "14", "15", "16"];
  return (
    <div className="site-demo-calendar">
      <div className="site-demo-month"><span>AGOSTO 2026</span><span>← &nbsp; →</span></div>
      <div className="site-demo-weekdays">{["L", "M", "X", "J", "V", "S", "D"].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="site-demo-calendar-grid">
        {cells.map((date) => (
          <div className={date === "13" ? "is-selected" : ""} key={date}>
            <strong>{date}</strong>
            {date === "13" ? <span>Centro histórico</span> : date === "14" ? <span>San Telmo</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function DemoRoutes() {
  return (
    <div className="site-demo-routes">
      <div className="site-demo-route-list">
        <div className="site-demo-route-item is-selected"><span>Jue 13</span><strong>Monserrat</strong><small>3 paradas</small></div>
        <div className="site-demo-route-item"><span>Vie 14</span><strong>San Telmo</strong><small>3 paradas</small></div>
        <div className="site-demo-route-item"><span>Sáb 15</span><strong>Palermo</strong><small>4 paradas</small></div>
      </div>
      <div aria-label="Representación de una ruta diaria" className="site-demo-map" role="img">
        <svg viewBox="0 0 520 240">
          <path className="site-map-road" d="M-20 190 C120 110, 160 80, 260 105 S430 220, 560 115" />
          <path className="site-map-road" d="M80 -10 C105 70, 185 120, 145 260" />
          <path className="site-map-route" d="M74 185 C140 150, 167 98, 245 107 S350 177, 424 134" />
          {[{ x: 74, y: 185 }, { x: 245, y: 107 }, { x: 424, y: 134 }].map((point, index) => (
            <g key={index}><circle cx={point.x} cy={point.y} r="13" /><text dominantBaseline="middle" textAnchor="middle" x={point.x} y={point.y}>{index + 1}</text></g>
          ))}
        </svg>
        <span>Ruta del jueves · 24 min a pie</span>
      </div>
    </div>
  );
}

function ItineraryDemo() {
  const [activeView, setActiveView] = useState("list");
  const tabId = useId();
  const tabsRef = useRef([]);

  function selectWithKeyboard(event, currentIndex) {
    let nextIndex;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % demoViews.length;
    else if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + demoViews.length) % demoViews.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = demoViews.length - 1;
    else return;
    event.preventDefault();
    setActiveView(demoViews[nextIndex].id);
    tabsRef.current[nextIndex]?.focus();
  }

  return (
    <div className="site-itinerary-demo">
      <div className="site-demo-header">
        <div><p className="site-kicker">BUENOS AIRES, ARGENTINA</p><h3>Barrios, sobremesas y río</h3><span>13 — 26 de agosto · 14 días</span></div>
        <div aria-label="Vistas de la demostración" className="site-demo-tabs" role="tablist">
          {demoViews.map((view, index) => (
            <button
              aria-controls={`${tabId}-${view.id}`}
              aria-selected={activeView === view.id}
              className={activeView === view.id ? "is-active" : ""}
              id={`${tabId}-${view.id}-tab`}
              key={view.id}
              onClick={() => setActiveView(view.id)}
              onKeyDown={(event) => selectWithKeyboard(event, index)}
              ref={(element) => { tabsRef.current[index] = element; }}
              role="tab"
              tabIndex={activeView === view.id ? 0 : -1}
              type="button"
            >{view.label}</button>
          ))}
        </div>
      </div>
      <div aria-labelledby={`${tabId}-${activeView}-tab`} id={`${tabId}-${activeView}`} role="tabpanel" tabIndex="0">
        {activeView === "calendar" ? <DemoCalendar /> : activeView === "routes" ? <DemoRoutes /> : <DemoList />}
      </div>
      <p className="site-demo-caption">Demostración visual. No guarda datos ni realiza reservas.</p>
    </div>
  );
}

function SectionHeading({ eyebrow, title, children }) {
  return (
    <header className="site-section-heading">
      <p className="site-kicker">{eyebrow}</p>
      <h2>{title}</h2>
      {children ? <p>{children}</p> : null}
    </header>
  );
}

export function LandingApp() {
  const cta = chatGptUrl();
  return (
    <>
      <a className="site-skip-link" href="#contenido">Saltar al contenido</a>
      <SiteHeader />
      <main id="contenido">
        <section className="site-hero">
          <div className="site-hero-copy">
            <p className="site-kicker">PLANIFICA EN CONVERSACIÓN</p>
            <h1>Un viaje que se construye hablando.</h1>
            <p>Sendero transforma lo que cuentas en un itinerario real: entiende tus gustos, organiza cada día y mantiene rutas, reservas y alternativas en un mismo lugar.</p>
            <div className="site-hero-actions">
              <a className="site-button site-button-primary" href={cta} rel="noreferrer noopener" target="_blank">Usar Sendero en ChatGPT <ArrowIcon /></a>
              <a className="site-button" href="/app">Abrir mis viajes</a>
              <a className="site-text-link" href="#demostracion">Ver cómo se ve <span aria-hidden="true">↓</span></a>
            </div>
          </div>
          <ConversationPreview />
        </section>

        <div aria-label="Principios de Sendero" className="site-principles">
          <span>Sin comandos obligatorios</span><span>Contexto local</span><span>Rutas por día</span><span>Listo para compartir</span>
        </div>

        <section className="site-section" id="como-funciona">
          <SectionHeading eyebrow="CÓMO FUNCIONA" title="La conversación es el punto de partida.">
            Sendero vive en el chat. La web explica el producto y permite visualizar lo que decides compartir.
          </SectionHeading>
          <ol className="site-steps">
            <li><span>01</span><h3>Cuéntale el viaje</h3><p>Destino, fechas, personas, ritmo, gustos, límites y planes fijos en tus propias palabras.</p></li>
            <li><span>02</span><h3>Sendero lo organiza</h3><p>Investiga contexto real, agrupa zonas, calcula traslados y señala reservas o boletos.</p></li>
            <li><span>03</span><h3>Ajusta conversando</h3><p>Pide cambios como se los pedirías a alguien: “haz el viernes más tranquilo” o “mueve esta cena”.</p></li>
          </ol>
        </section>

        <section className="site-section site-capabilities" id="capacidades">
          <SectionHeading eyebrow="UN PLAN QUE ENTIENDE EL CONTEXTO" title="Más que una lista de lugares.">
            Cada recomendación tiene que funcionar dentro del viaje completo.
          </SectionHeading>
          <div className="site-capability-grid">
            <article className="site-capability-main"><span aria-hidden="true">⌁</span><h3>Local, no genérico</h3><p>Combina imprescindibles con mercados, barrios, cultura y lugares que forman parte de la vida cotidiana.</p></article>
            <article><p className="site-kicker">LOGÍSTICA</p><h3>Rutas viables</h3><p>Organiza por zonas y considera cómo quieres moverte, incluso si no conduces.</p></article>
            <article><p className="site-kicker">CONTEXTO</p><h3>Clima y eventos</h3><p>Incorpora horarios, cierres, temporadas y alternativas cuando el plan lo necesita.</p></article>
            <article><p className="site-kicker">ACCIÓN</p><h3>Reservas claras</h3><p>Distingue reservas de boletos y mantiene sus enlaces y estados junto al itinerario.</p></article>
          </div>
        </section>

        <section className="site-section" id="demostracion">
          <SectionHeading eyebrow="EL RESULTADO" title="Del chat a una vista que se entiende de inmediato.">
            Revisa el viaje por día, calendario o ruta. El ejemplo es completamente visual y no modifica ningún itinerario.
          </SectionHeading>
          <ItineraryDemo />
        </section>

        <section className="site-section site-sharing" id="compartir">
          <div>
            <SectionHeading eyebrow="COMPARTE SIN OBLIGAR A USAR CHATGPT" title="Tu viaje también puede vivir fuera del chat.">
              Quien recibe el enlace puede recorrer el itinerario desde el navegador, en una vista limpia y de solo lectura.
            </SectionHeading>
            <ul className="site-check-list">
              <li>Un snapshot público controlado por quien creó el viaje.</li>
              <li>Sin notas privadas ni datos de alojamiento precisos.</li>
              <li>Enlace que puede actualizarse, reemplazarse o revocarse.</li>
            </ul>
          </div>
          <div aria-label="Ejemplo de enlace compartido" className="site-share-card">
            <div className="site-share-card-top"><span><BrandMark /><strong>Sendero</strong></span><small>Solo lectura</small></div>
            <p className="site-kicker">VIAJE COMPARTIDO</p>
            <h3>Barrios, sobremesas y río</h3>
            <p>Buenos Aires · 13–26 de agosto</p>
            <div><span>Lista</span><span>Calendario</span><span>Rutas</span></div>
          </div>
        </section>

        <section className="site-section site-privacy">
          <SectionHeading eyebrow="PRIVACIDAD POR DISEÑO" title="Tú decides qué sale de la conversación.">
            Sendero separa el viaje privado de la versión pública. Compartir es una acción explícita, no una consecuencia automática de crear un itinerario.
          </SectionHeading>
          <a className="site-text-link" href="/privacy">Leer la política de privacidad <span aria-hidden="true">→</span></a>
        </section>

        <section className="site-final-cta">
          <p className="site-kicker">EMPIEZA POR CONTARLO</p>
          <h2>¿A dónde quieres ir?</h2>
          <p>No necesitas aprender una interfaz nueva. Abre Sendero y conversa sobre el viaje que tienes en mente.</p>
          <a className="site-button site-button-primary" href={cta} rel="noreferrer noopener" target="_blank">Usar Sendero en ChatGPT <ArrowIcon /></a>
        </section>
      </main>
      <footer className="site-footer">
        <a className="site-brand" href="/"><BrandMark /><span>Sendero</span></a>
        <p>Planifica en conversación. Comparte visualmente.</p>
        <nav aria-label="Información de Sendero"><a href="/app">Mis viajes</a><a href="/privacy">Privacidad</a><a href="/terms">Términos</a></nav>
      </footer>
    </>
  );
}
