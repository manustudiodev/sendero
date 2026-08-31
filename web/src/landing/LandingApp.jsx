import { useCallback, useEffect, useRef, useState } from "react";
import { sanitizePublicSnapshot } from "../../../shared/public-snapshot.mjs";
import { BrandMark } from "../components.jsx";
import { ItineraryViewer } from "../itinerary/ItineraryViewer.jsx";
import { landingShowcaseItinerary } from "./showcase-itinerary.js";
import { useLandingStory } from "./useLandingStory.js";

const HERO_PROMPT = "Quiero organizar dos semanas en Buenos Aires, sin auto, combinando clásicos con lugares que frecuentan los locales.";
const MODIFICATION_PROMPT = "Haz que el sábado empiece más tranquilo en Recoleta y mueve el MALBA para después del almuerzo.";
const QUERY_PROMPT = "¿Qué clima suele hacer durante esas dos semanas y qué me conviene llevar?";
const landingPublicItinerary = sanitizePublicSnapshot(landingShowcaseItinerary);

const adjustedShowcaseItinerary = Object.freeze({
  ...landingShowcaseItinerary,
  days: Object.freeze(landingShowcaseItinerary.days.map((day) => day.date !== "2026-08-15" ? day : Object.freeze({
    ...day,
    area: "Recoleta · Palermo",
    summary: "Una mañana sin apuro y una tarde de arte latinoamericano.",
    title: "Recoleta sin apuro y MALBA",
    activities: Object.freeze(day.activities.map((activity, index) => {
      if (index === 0) return Object.freeze({ ...activity, startTime: "11:00", title: "Mañana tranquila en Recoleta" });
      if (index === 1) return Object.freeze({
        ...activity,
        id: "malba",
        location: { address: "Av. Figueroa Alcorta 3415, Buenos Aires, Argentina", latitude: -34.5768, longitude: -58.4032, name: "MALBA" },
        sourceUrl: "https://www.malba.org.ar/",
        startTime: "15:30",
        title: "MALBA después del almuerzo",
      });
      return activity;
    })),
  }))),
});

const beatOrder = [
  "hidden",
  "surface",
  "docked",
  "initialSent",
  "initialThinking",
  "initialReply",
  "planningResearch",
  "planningSchedule",
  "planningRoutes",
  "itineraryReady",
  "viewsListRoute",
  "viewsListDescription",
  "viewsCalendar",
  "viewsRoutes",
  "routeFocus",
  "reservations",
  "queryTyping",
  "querySent",
  "queryThinking",
  "queryAnswered",
  "changeTyping",
  "changeSent",
  "changeThinking",
  "changeApplied",
];

function reached(beat, target) {
  return beatOrder.indexOf(beat) >= beatOrder.indexOf(target);
}

const createSteps = [
  { dwell: "long", eyebrow: "01 · El contexto", title: "Sendero entiende antes de proponer.", body: "Extrae lo que ya dijiste y pregunta en conjunto únicamente por la información crítica que falte." },
  { dwell: "long", eyebrow: "02 · La preparación", title: "Investiga y ordena un viaje posible.", body: "Agrupa barrios y considera horarios, traslados, clima, reservas y alternativas antes de presentar el resultado." },
  { dwell: "xlong", eyebrow: "03 · El itinerario", title: "Un mismo viaje, distintas formas de entenderlo.", body: "Explora la lista, el calendario y las rutas. Cada día reúne recorrido, descripción, clima y una alternativa cuando hace falta." },
  { dwell: "medium", eyebrow: "04 · Rutas", title: "La logística también forma parte del plan.", body: "Sendero ordena las paradas y deja cada recorrido listo para entenderlo o abrirlo en tu app de mapas." },
  { dwell: "long", eyebrow: "05 · Reservas", title: "Lo pendiente también forma parte del viaje.", body: "Entradas, reservas y fechas límite permanecen conectadas con cada actividad, sin completar ninguna compra por ti." },
  { dwell: "long", eyebrow: "06 · Consultas", title: "¿Tienes dudas sobre tu itinerario?", body: "Pregúntale a Sendero sobre el clima, qué llevar o cualquier detalle del viaje. La respuesta conserva todo el contexto." },
  { dwell: "long", eyebrow: "07 · ¿Quieres cambiar algo?", title: "El itinerario cambia conversando.", body: "Pide un ajuste con lenguaje natural y Sendero reorganiza lo necesario sin perder el resto del viaje." },
];

const shareSteps = [
  { eyebrow: "01 · Publicar", title: "Una instrucción basta para publicar.", body: "Cuando lo pides explícitamente, Sendero crea o actualiza la copia pública. También puedes pedir una vista previa antes de decidir." },
  { eyebrow: "02 · Explorar", title: "El viaje se entiende al abrir el enlace.", body: "Quien lo recibe puede recorrer la misma lista, el calendario y las rutas sin tener que abrir ChatGPT." },
  { eyebrow: "03 · Privacidad", title: "Compartir no significa publicar todo.", body: "La copia pública omite alojamiento exacto, notas privadas, colaboradores, historial y enlaces privados de reservas." },
  { eyebrow: "04 · Colaborar", title: "Cada persona recibe el acceso que necesita.", body: "Puedes invitar a alguien para mirar o colaborar, y conservar como propietario el control de personas y enlaces." },
  { eyebrow: "05 · Editar", title: "Un colaborador puede avanzar sin perder el contexto.", body: "Desde la web actualiza estados concretos; los cambios amplios del viaje continúan conversando con Sendero." },
];

function chatGptUrl() {
  return document.querySelector('meta[name="sendero-chatgpt-url"]')?.content || "https://chatgpt.com/";
}

function chatGptCtaCopy(cta) {
  try {
    const target = new URL(cta);
    const isSenderoTarget = target.pathname !== "/" || target.search || target.hash;
    if (isSenderoTarget) {
      return {
        header: "Abrir en ChatGPT",
        footer: "Usar Sendero en ChatGPT",
      };
    }
  } catch {
    // Invalid configuration falls back to truthful, generic ChatGPT copy.
  }
  return { header: "Abrir en ChatGPT", footer: "Abrir ChatGPT" };
}

function ArrowIcon() {
  return <span aria-hidden="true">↗</span>;
}

function SendIcon() {
  return (
    <svg aria-hidden="true" fill="none" focusable="false" viewBox="0 0 24 24">
      <path d="M12 18V6m0 0-5 5m5-5 5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function SiteHeader({ cta, ctaCopy }) {
  return (
    <header className="site-header landing-header">
      <a aria-label="Sendero, inicio" className="site-brand" href="/">
        <BrandMark />
        <span>Sendero</span>
      </a>
      <div className="site-header-actions">
        <a className="site-text-link" href="/app">Mis viajes</a>
        <a aria-label={ctaCopy.header} className="site-button site-button-small" href={cta} rel="noreferrer noopener" target="_blank">
          <span className="landing-cta-prefix">Abrir en </span><span>ChatGPT</span> <ArrowIcon />
        </a>
      </div>
    </header>
  );
}

function HeroComposer({ docked, onSubmit }) {
  return (
    <div className={`landing-composer-shell ${docked ? "is-docked" : ""}`} data-composer-morph>
      <form className="landing-composer" onSubmit={onSubmit}>
        <label className="visually-hidden" htmlFor="sendero-demo-prompt">Describe tu viaje</label>
        <textarea
          aria-readonly="true"
          data-composer-text
          data-full-value={HERO_PROMPT}
          data-typewriter-state="waiting"
          defaultValue=""
          id="sendero-demo-prompt"
          placeholder={docked ? "Escribe un mensaje…" : undefined}
          readOnly
          rows="1"
          tabIndex="-1"
        />
        <button aria-disabled={docked ? "true" : undefined} aria-label="Iniciar recorrido de ejemplo" data-composer-send disabled={docked} tabIndex={docked ? -1 : 0} type="submit"><SendIcon /></button>
      </form>
    </div>
  );
}

function Hero({ composerDocked, onDemoSubmit }) {
  return (
    <section aria-labelledby="landing-title" className="landing-hero">
      <div aria-hidden="true" className="landing-hero-route">
        <svg viewBox="0 0 900 520">
          <path d="M-25 440C152 394 148 174 350 199c194 24 168 228 367 178 83-21 105-107 209-125" />
          <circle cx="350" cy="199" r="8" />
          <circle cx="717" cy="377" r="8" />
        </svg>
      </div>
      <div className="landing-hero-copy">
        <h1 id="landing-title">Tu viaje empieza con una frase.</h1>
        <p>Sendero convierte lo que cuentas en un itinerario claro, conectado y listo para recorrer, ajustar o compartir.</p>
      </div>
      <div className="landing-hero-demo" data-composer-source>
        <div className="landing-composer-carrier" data-composer-carrier>
          <HeroComposer docked={composerDocked} onSubmit={onDemoSubmit} />
        </div>
      </div>
      <a aria-label="Ver cómo funciona Sendero" className="landing-scroll-cue" data-composer-cue href="#crear">
        <span>Haz scroll para ver cómo Sendero crea, organiza y comparte tu viaje.</span><span aria-hidden="true">↓</span>
      </a>
    </section>
  );
}

function SurfaceHeader({ badge, children, label }) {
  return (
    <header className="landing-surface-header">
      <div className="landing-surface-brand"><BrandMark /><strong>{label}</strong></div>
      {children || (badge ? <span className="landing-surface-badge">{badge}</span> : null)}
    </header>
  );
}

function ProductViewer({ activeView, itinerary, privacy = false, selectedListDate, selectedListDetailView, surface = "public" }) {
  const isChat = surface === "chat";
  const viewportRef = useRef(null);

  useEffect(() => {
    if (!selectedListDate || activeView !== "list") return undefined;
    const frame = window.requestAnimationFrame(() => {
      const viewport = viewportRef.current;
      const target = viewport?.querySelector(`time[datetime="${selectedListDate}"]`)?.closest(".day-card");
      if (!viewport || !target) return;
      viewport.scrollTop = Math.max(0, target.offsetTop - 12);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeView, itinerary, selectedListDate]);

  return (
    <div aria-label={isChat ? "Itinerario dentro de la conversación" : "Itinerario compartido"} className={`landing-product-surface landing-product-surface-${surface}`}>
      <p className="visually-hidden">Vista de solo lectura del itinerario de ejemplo en {activeView === "reservations" ? "reservas" : activeView}.</p>
      <div aria-hidden="true" className="landing-product-viewport" data-showcase-passive inert="" ref={viewportRef}>
        <div className={isChat ? "landing-product landing-product-chat" : "landing-product-public"}>
          <ItineraryViewer
            activeView={activeView}
            headingLevel={3}
            itinerary={itinerary || (isChat ? landingShowcaseItinerary : landingPublicItinerary)}
            selectedListDate={selectedListDate}
            selectedListDetailView={selectedListDetailView}
            selectedRouteDate="2026-08-13"
            variant={isChat ? "chat" : "public"}
          />
        </div>
      </div>
      {privacy ? <div className="landing-privacy-note"><span aria-hidden="true">✓</span><p><strong>Copia pública sanitizada</strong><small>Sin alojamiento exacto, notas privadas ni historial.</small></p></div> : null}
    </div>
  );
}

function ThinkingIndicator({ label }) {
  return (
    <div aria-label={label} className="landing-thinking" role="status">
      <BrandMark />
      <span aria-hidden="true"><i /><i /><i /></span>
    </div>
  );
}

function AgentTurn({ children, className = "", messageId, visible }) {
  return (
    <div aria-hidden={visible ? undefined : "true"} className={`landing-chat-agent landing-turn ${className} ${visible ? "is-visible" : ""}`} data-message-id={messageId}>
      <BrandMark />
      <div>{children}</div>
    </div>
  );
}

function UserTurn({ children, messageId, visible }) {
  return <div aria-hidden={visible ? undefined : "true"} className={`landing-chat-user landing-turn ${visible ? "is-visible" : ""}`} data-message-id={messageId}>{children}</div>;
}

function conversationFocusForBeat(beat) {
  if (["viewsListRoute", "viewsListDescription", "viewsCalendar", "viewsRoutes", "routeFocus", "reservations", "queryTyping"].includes(beat)) return "itinerary-v1";
  if (beat === "changeApplied") return "itinerary-v2";
  if (beat === "changeThinking") return "adjust-thinking";
  if (beat === "changeSent") return "adjust-request";
  if (beat === "changeTyping") return "weather-result";
  if (beat === "queryAnswered") return "weather-result";
  if (beat === "queryThinking") return "weather-thinking";
  if (beat === "querySent") return "weather-request";
  if (beat === "queryTyping" || beat === "itineraryReady") return "itinerary-v1";
  if (["planningResearch", "planningSchedule", "planningRoutes"].includes(beat)) return "itinerary-generation";
  if (beat === "initialReply") return "initial-clarification";
  if (beat === "initialThinking") return "initial-thinking";
  if (beat === "initialSent") return "initial-request";
  return null;
}

function CreateConversation({ activeView, beat, scene }) {
  const scrollportRef = useRef(null);
  const showsInitialUser = reached(beat, "initialSent");
  const showsInitialThinking = beat === "initialThinking";
  const showsInitialClarification = reached(beat, "initialReply");
  const showsPlanning = reached(beat, "planningResearch");
  const showsViewer = reached(beat, "itineraryReady");
  const showsQueryUser = reached(beat, "querySent");
  const showsQueryThinking = beat === "queryThinking";
  const showsQueryResult = reached(beat, "queryAnswered");
  const showsChangeUser = reached(beat, "changeSent");
  const showsChangeThinking = beat === "changeThinking";
  const showsChangeResult = reached(beat, "changeApplied");

  useEffect(() => {
    const scrollport = scrollportRef.current;
    const messageId = conversationFocusForBeat(beat);
    if (!scrollport || !messageId) return undefined;

    let frame;
    const startedAt = performance.now();
    const startingTop = scrollport.scrollTop;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const duration = reduceMotion ? 0 : 180;
    const messageTop = () => {
      const target = scrollport.querySelector(`[data-message-id="${messageId}"]`);
      if (!target) return scrollport.scrollTop;
      const alignsToStart = messageId === "itinerary-v1" || messageId === "itinerary-v2";
      const top = alignsToStart
        ? target.offsetTop - 10
        : target.offsetTop + target.offsetHeight - scrollport.clientHeight + 18;
      return Math.max(0, top);
    };

    const alignToMessage = (now) => {
      const progress = duration ? Math.min(1, (now - startedAt) / duration) : 1;
      const eased = 1 - ((1 - progress) ** 3);
      scrollport.scrollTop = startingTop + ((messageTop() - startingTop) * eased);
      if (progress < 1) frame = window.requestAnimationFrame(alignToMessage);
    };
    frame = window.requestAnimationFrame(alignToMessage);

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [activeView, beat]);

  return (
    <div className={`landing-conversation ${showsPlanning ? "has-planning" : ""} ${showsViewer ? "has-itinerary" : ""}`} data-create-conversation data-demo-interaction="" data-demo-phase={beat} data-interaction-state="" data-scene={scene}>
      <SurfaceHeader label="Sendero en ChatGPT" />
      <div className="landing-conversation-scroll" data-conversation-scroll data-showcase-passive inert="" ref={scrollportRef}>
        <div aria-label="Conversación de ejemplo con Sendero" className="landing-conversation-thread" data-conversation-thread role="log">
          <UserTurn messageId="initial-request" visible={showsInitialUser}>{HERO_PROMPT}</UserTurn>
          <div aria-hidden={showsInitialThinking ? undefined : "true"} className={`landing-turn ${showsInitialThinking ? "is-visible" : ""}`} data-message-id="initial-thinking">
            {showsInitialThinking ? <ThinkingIndicator label="Sendero está interpretando el pedido" /> : null}
          </div>
          <AgentTurn messageId="initial-clarification" visible={showsInitialClarification}>
            <p>Perfecto. Para armarlo bien, ¿en qué fechas viajan y cuántas personas son?</p>
            <div aria-label="Contexto comprendido" className="landing-context-chips"><span>Buenos Aires</span><span>Sin auto</span><span>Clásicos + vida local</span></div>
          </AgentTurn>
          <UserTurn messageId="trip-details" visible={showsPlanning}>Del 13 al 26 de agosto, para dos adultos.</UserTurn>
          <AgentTurn className="landing-generation-turn" messageId="itinerary-generation" visible={showsPlanning}>
            <p>Genial. Voy a investigar y ordenar una propuesta posible antes de mostrártela.</p>
            <div className="landing-planning-card is-visible" role={showsPlanning ? "status" : undefined}>
              <div className="landing-planning-head"><span>Generando el itinerario</span><strong>14 días</strong></div>
              <div className={`landing-planning-line ${reached(beat, "planningResearch") ? "is-complete" : ""}`}><span />Barrios, clima y horarios</div>
              <div className={`landing-planning-line ${reached(beat, "planningSchedule") ? "is-complete" : ""}`}><span />Ritmo, reservas y alternativas</div>
              <div className={`landing-planning-line ${reached(beat, "planningRoutes") ? "is-complete" : ""}`}><span />Traslados y rutas por día</div>
            </div>
          </AgentTurn>
          <AgentTurn className="landing-itinerary-turn" messageId="itinerary-v1" visible={showsViewer}>
            <p>Listo. Organicé el viaje por zonas para reducir traslados y dejé alternativas donde el clima o una reserva pueden cambiar el día.</p>
            <ProductViewer
              activeView={activeView}
              itinerary={landingShowcaseItinerary}
              selectedListDate="2026-08-13"
              selectedListDetailView={beat === "viewsListDescription" ? "description" : "route"}
              surface="chat"
            />
          </AgentTurn>

          <UserTurn messageId="weather-request" visible={showsQueryUser}>{QUERY_PROMPT}</UserTurn>
          <div aria-hidden={showsQueryThinking ? undefined : "true"} className={`landing-turn ${showsQueryThinking ? "is-visible" : ""}`} data-message-id="weather-thinking">
            {showsQueryThinking ? <ThinkingIndicator label="Sendero está revisando el clima del viaje" /> : null}
          </div>
          <AgentTurn className="landing-result-turn" messageId="weather-result" visible={showsQueryResult}>
            <p>Agosto suele ser fresco en Buenos Aires. Conviene vestirse en capas y dejar una alternativa cubierta para los días húmedos.</p>
            <div className="landing-weather-result" data-demo-result="weather"><span><strong>15–18 °C</strong><small>tardes habituales</small></span><span><strong>6–9 °C</strong><small>mañanas y noches</small></span><span><strong>Capas + paraguas</strong><small>equipaje recomendado</small></span></div>
          </AgentTurn>

          <UserTurn messageId="adjust-request" visible={showsChangeUser}>{MODIFICATION_PROMPT}</UserTurn>
          <div aria-hidden={showsChangeThinking ? undefined : "true"} className={`landing-turn ${showsChangeThinking ? "is-visible" : ""}`} data-message-id="adjust-thinking">
            {showsChangeThinking ? <ThinkingIndicator label="Sendero está reorganizando el itinerario" /> : null}
          </div>
          <AgentTurn className="landing-result-turn" messageId="adjust-result" visible={showsChangeResult}>
            <p>Listo. Dejé la mañana más libre y moví el MALBA a las 15:30 sin cambiar el resto del viaje.</p>
            <div className="landing-demo-result" data-demo-result="modification"><span>✓</span><strong>Recoleta 11:00 · MALBA 15:30</strong></div>
          </AgentTurn>
          <AgentTurn className="landing-itinerary-turn landing-itinerary-turn-adjusted" messageId="itinerary-v2" visible={showsChangeResult}>
            <p>Esta es la nueva versión del sábado. El resto del itinerario permanece igual.</p>
            <ProductViewer
              activeView="list"
              itinerary={adjustedShowcaseItinerary}
              selectedListDate="2026-08-15"
              selectedListDetailView="route"
              surface="chat"
            />
          </AgentTurn>
        </div>
      </div>
      <div aria-hidden="true" className="landing-composer-dock" data-composer-target />
    </div>
  );
}

function CreateStage({ activeView, beat, scene }) {
  return (
    <div aria-label="Demostración continua de creación y exploración de un itinerario" className="landing-stage" data-create-stage data-stage-surface="conversation">
      <div aria-live="polite" className="visually-hidden">Escena {scene + 1} de {createSteps.length}: {createSteps[scene]?.title}</div>
      <CreateConversation activeView={activeView} beat={beat} scene={scene} />
      <p className="landing-stage-caption"><span>{String(scene + 1).padStart(2, "0")}</span>Una conversación · componentes reales</p>
    </div>
  );
}

function ShareReceipt() {
  return (
    <div className="landing-share-receipt">
      <div className="landing-share-receipt-body">
        <span aria-hidden="true" className="landing-share-check">✓</span>
        <p className="site-kicker">ENLACE CREADO</p>
        <h3>Tu viaje está listo para compartir.</h3>
        <p>Cualquier persona con el enlace podrá ver únicamente la versión pública de solo lectura.</p>
        <div className="landing-link-field"><span>sendero.app/share/••••••••</span><strong>Copiar</strong></div>
        <small>El enlace se puede actualizar, reemplazar o revocar.</small>
      </div>
    </div>
  );
}

function AccessStage() {
  return (
    <div className="landing-access-stage">
      <div className="landing-access-body">
        <header><div><p className="site-kicker">VIAJE RESTRINGIDO</p><h3>Comparte con distintos permisos.</h3></div><span className="landing-access-invite">Invitar por correo</span></header>
        <div className="landing-access-row"><span className="landing-avatar is-owner">MP</span><p><strong>Manuel</strong><small>Controla personas, publicación y viaje</small></p><span>Propietario</span></div>
        <div className="landing-access-row"><span className="landing-avatar">AL</span><p><strong>Ana L.</strong><small>Puede ajustar el viaje y gestionar reservas</small></p><span>Colaborador</span></div>
        <div className="landing-access-row"><span className="landing-avatar">JR</span><p><strong>Julián R.</strong><small>Puede consultar el itinerario privado</small></p><span>Viewer</span></div>
      </div>
    </div>
  );
}

function CollaboratorStage() {
  return (
    <div className="landing-collaborator-stage">
      <span aria-label="Ejemplo de cambio ya aplicado" className="landing-collaborator-status" role="status">Actualizado</span>
      <p className="visually-hidden">Ejemplo de solo lectura de una reserva actualizada por un colaborador.</p>
      <div aria-hidden="true" className="landing-product-viewport" data-showcase-passive inert="">
        <div className="landing-product">
          <ItineraryViewer
            activeView="reservations"
            headingLevel={3}
            itinerary={landingShowcaseItinerary}
            variant="chat"
          />
        </div>
      </div>
    </div>
  );
}

function ShareStage({ scene }) {
  const captions = ["Publicación del enlace", "Itinerario público", "Copia pública sanitizada", "Acceso privado por rol", "Edición acotada en la web"];
  const badges = ["Enlace creado", "Solo lectura", "Privacidad", "Accesos", "Colaborador"];
  const panels = [
    <ShareReceipt key="publish" />,
    <ProductViewer activeView="list" key="explore" />,
    <ProductViewer activeView="routes" key="privacy" privacy />,
    <AccessStage key="access" />,
    <CollaboratorStage key="collaborate" />,
  ];
  return (
    <div aria-label="Demostración de publicación y colaboración" className="landing-stage landing-stage-share" data-stage-surface="share">
      <div aria-live="polite" className="visually-hidden">Escena {scene + 1} de {shareSteps.length}: {shareSteps[scene]?.title}</div>
      <div className="landing-share-surface" data-share-surface data-scene={scene}>
        <SurfaceHeader label="Sendero">
          <span aria-hidden="true" className="landing-share-badge-stack">
            {badges.map((badge, index) => <span className={`landing-surface-badge landing-share-badge ${scene === index ? "is-active" : ""}`} data-share-badge data-share-scene={index} key={badge}>{badge}</span>)}
          </span>
        </SurfaceHeader>
        <div className="landing-share-body" data-share-stack>
          {panels.map((content, index) => (
            <div aria-hidden={scene === index ? undefined : "true"} className={`landing-share-panel ${scene === index ? "is-active" : ""}`} data-share-panel data-share-scene={index} key={index}>
              {content}
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden="true" className="landing-stage-caption landing-share-caption-stack">
        {captions.map((caption, index) => <p className={`landing-share-caption ${scene === index ? "is-active" : ""}`} data-share-caption data-share-scene={index} key={caption}><span>{String(index + 1).padStart(2, "0")}</span>{caption}</p>)}
      </div>
    </div>
  );
}

function StoryStep({ active, chapter, index, step }) {
  return (
    <article aria-current={active ? "step" : undefined} className={`landing-story-step ${active ? "is-active" : ""}`} data-dwell={step.dwell || "medium"} data-scene={index} data-scene-label={step.eyebrow} data-story-step={chapter}>
      <div className="landing-story-step-copy">
        <p className="site-kicker">{step.eyebrow}</p>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
      </div>
    </article>
  );
}

function StorySection({ activeScene, children, description, id, showHeading = true, steps, title }) {
  return (
    <section aria-labelledby={`${id}-title`} className={`landing-story-section ${showHeading ? "" : "landing-story-section-direct"}`} id={id}>
      {showHeading ? (
        <header className="landing-story-heading" data-story-reveal>
          <p className="site-kicker">COMPARTIR Y COLABORAR</p>
          <h2 id={`${id}-title`}>{title}</h2>
          <p>{description}</p>
        </header>
      ) : <h2 className="visually-hidden" id={`${id}-title`}>Cómo funciona Sendero</h2>}
      <div className="landing-story-grid">
        <div className="landing-story-sticky">{children}</div>
        <div className="landing-story-steps">
          {steps.map((step, index) => <StoryStep active={activeScene === index} chapter={id === "crear" ? "create" : "share"} index={index} key={step.title} step={step} />)}
        </div>
      </div>
    </section>
  );
}

function PrivacySection() {
  return (
    <section aria-labelledby="privacidad-title" className="landing-privacy" id="privacidad" data-story-reveal>
      <div><p className="site-kicker">PRIVADO POR DISEÑO</p><h2 id="privacidad-title">Tu viaje privado no se convierte en público por accidente.</h2></div>
      <div className="landing-privacy-grid">
        <article><span>01</span><h3>Tú decides cómo publicar.</h3><p>Una solicitud explícita publica directamente; si quieres revisar antes, puedes pedir una vista previa exacta.</p></article>
        <article><span>02</span><h3>La copia tiene límites claros.</h3><p>Una lista permitida decide qué campos pueden salir del viaje privado.</p></article>
        <article><span>03</span><h3>El acceso se puede retirar.</h3><p>Actualiza el contenido, cambia el enlace o revócalo cuando lo necesites.</p></article>
      </div>
    </section>
  );
}

function FrequentlyAskedQuestions() {
  return (
    <section aria-labelledby="preguntas-title" className="landing-faq" id="preguntas">
      <header data-story-reveal><p className="site-kicker">PREGUNTAS FRECUENTES</p><h2 id="preguntas-title">Lo esencial, sin letra pequeña.</h2></header>
      <div className="landing-faq-list">
        <details><summary>¿Tengo que aprender comandos?</summary><p>No. Puedes explicar el viaje con lenguaje natural. Los atajos de ChatGPT son opcionales.</p></details>
        <details><summary>¿La otra persona necesita ChatGPT?</summary><p>No para un enlace público. Puede abrir la versión de solo lectura directamente en el navegador.</p></details>
        <details><summary>¿Sendero hace reservas por mí?</summary><p>No. Centraliza enlaces y estados dentro de Sendero, pero cualquier compra o cancelación real se confirma con el proveedor.</p></details>
        <details><summary>¿Se puede editar todo desde la web?</summary><p>No. La planificación y los cambios amplios siguen siendo conversacionales; la web se centra en consultar, colaborar y gestionar accesos o estados concretos.</p></details>
      </div>
    </section>
  );
}

function SiteFooter({ cta, ctaCopy }) {
  return (
    <>
      <section aria-labelledby="final-cta-title" className="site-final-cta landing-final-cta" data-story-reveal>
        <p className="site-kicker">EL PRÓXIMO VIAJE</p>
        <h2 id="final-cta-title">Una frase basta para empezar.</h2>
        <p>Cuéntale a Sendero a dónde quieres ir. El resto se construye conversando.</p>
        <a className="site-button site-button-primary" href={cta} rel="noreferrer noopener" target="_blank">{ctaCopy.footer} <ArrowIcon /></a>
      </section>
      <footer className="site-footer landing-footer">
        <a aria-label="Sendero, inicio" className="site-brand" href="/"><BrandMark /><span>Sendero</span></a>
        <p>Planifica conversando.</p>
        <nav aria-label="Enlaces del pie de página"><a href="/app">Mis viajes</a><a href="/privacy">Privacidad</a><a href="/terms">Términos</a></nav>
      </footer>
    </>
  );
}

function createViewForBeat(beat) {
  if (beat === "reservations" || beat.startsWith("query")) return "reservations";
  if (beat === "viewsCalendar") return "calendar";
  if (beat === "viewsRoutes" || beat === "routeFocus") return "routes";
  return "list";
}

export function LandingApp() {
  const rootRef = useRef(null);
  const [createScene, setCreateScene] = useState(0);
  const [createBeat, setCreateBeat] = useState("hidden");
  const [shareScene, setShareScene] = useState(0);
  const [composerDocked, setComposerDocked] = useState(false);
  const cta = chatGptUrl();
  const ctaCopy = chatGptCtaCopy(cta);

  const activateCreateScene = useCallback((scene) => {
    setCreateScene(scene);
  }, []);

  const activateShareScene = useCallback((scene) => {
    setShareScene(scene);
  }, []);

  useLandingStory(rootRef, {
    heroPrompt: HERO_PROMPT,
    modificationPrompt: MODIFICATION_PROMPT,
    onComposerDockChange: setComposerDocked,
    onCreateBeatChange: setCreateBeat,
    onCreateScene: activateCreateScene,
    onShareScene: activateShareScene,
    queryPrompt: QUERY_PROMPT,
  });

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => window.__senderoIntroReady?.());
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function startDemo(event) {
    event.preventDefault();
    const textarea = event.currentTarget.querySelector("textarea");
    if (textarea) textarea.value = HERO_PROMPT;
    textarea?.blur();
    if (composerDocked) return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    document.getElementById("crear")?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }

  return (
    <div className="landing-page" ref={rootRef}>
      <a className="site-skip-link" href="#contenido">Saltar al contenido</a>
      <SiteHeader cta={cta} ctaCopy={ctaCopy} />
      <main id="contenido">
        <Hero composerDocked={composerDocked} onDemoSubmit={startDemo} />
        <StorySection activeScene={createScene} id="crear" showHeading={false} steps={createSteps}>
          <CreateStage activeView={createViewForBeat(createBeat)} beat={createBeat} scene={createScene} />
        </StorySection>
        <StorySection activeScene={shareScene} description="El itinerario sale del chat sin convertirse en una segunda app difícil de aprender." id="compartir" steps={shareSteps} title="El mismo viaje, ahora para los demás.">
          <ShareStage scene={shareScene} />
        </StorySection>
        <PrivacySection />
        <FrequentlyAskedQuestions />
        <SiteFooter cta={cta} ctaCopy={ctaCopy} />
      </main>
    </div>
  );
}
