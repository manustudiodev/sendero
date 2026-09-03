import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sanitizePublicSnapshot } from "../../../shared/public-snapshot.mjs";
import { BrandMark } from "../components.jsx";
import { hrefForLocale, LanguageSelector, useUiLocale } from "../i18n/LanguageSelector.jsx";
import { ItineraryViewer } from "../itinerary/ItineraryViewer.jsx";
import { landingCopy } from "./copy.js";
import { landingShowcaseItinerary } from "./showcase-itinerary.js";
import { useLandingStory } from "./useLandingStory.js";

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

function SendIcon() {
  return (
    <svg aria-hidden="true" fill="none" focusable="false" viewBox="0 0 24 24">
      <path d="M12 18V6m0 0-5 5m5-5 5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function signInHref(locale) {
  return `/auth/login?${new URLSearchParams({ returnTo: hrefForLocale("/app", locale) }).toString()}`;
}

function SiteHeader({ copy, locale }) {
  return (
    <header className="site-header landing-header">
      <a aria-label={copy.home} className="site-brand" href={hrefForLocale("/", locale)}>
        <BrandMark />
        <span>Sendero</span>
      </a>
      <div className="site-header-actions">
        <a className="site-text-link" href={signInHref(locale)}>{copy.signIn}</a>
      </div>
    </header>
  );
}

function HeroComposer({ copy, docked, onSubmit }) {
  return (
    <div className={`landing-composer-shell ${docked ? "is-docked" : ""}`} data-composer-morph>
      <form className="landing-composer" onSubmit={onSubmit}>
        <label className="visually-hidden" htmlFor="sendero-demo-prompt">{copy.composerLabel}</label>
        <textarea
          aria-readonly="true"
          data-composer-text
          data-full-value={copy.heroPrompt}
          data-typewriter-state="waiting"
          defaultValue=""
          id="sendero-demo-prompt"
          placeholder={docked ? copy.composerPlaceholder : undefined}
          readOnly
          rows="1"
          tabIndex="-1"
        />
        <button aria-disabled={docked ? "true" : undefined} aria-label={copy.composerAction} data-composer-send disabled={docked} tabIndex={docked ? -1 : 0} type="submit"><SendIcon /></button>
      </form>
    </div>
  );
}

function Hero({ copy, composerDocked, locale, onDemoSubmit }) {
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
        <h1 id="landing-title">{copy.heroTitle}</h1>
        <p>{copy.heroBody}</p>
      </div>
      <div className="landing-hero-demo" data-composer-source>
        <div className="landing-composer-carrier" data-composer-carrier>
          <HeroComposer copy={copy} docked={composerDocked} onSubmit={onDemoSubmit} />
        </div>
        <a className="site-button site-button-primary landing-hero-cta" href={hrefForLocale("/app/new", locale)}>
          {copy.createTrip} <span aria-hidden="true">→</span>
        </a>
      </div>
      <a aria-label={copy.scrollAria} className="landing-scroll-cue" data-composer-cue href="#crear">
        <span>{copy.scroll}</span><span aria-hidden="true">↓</span>
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

function ProductViewer({ activeView, copy, itinerary, locale, privacy = false, selectedListDate, selectedListDetailView, surface = "public" }) {
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
    <div aria-label={isChat ? copy.itineraryInChat : copy.sharedItinerary} className={`landing-product-surface landing-product-surface-${surface}`}>
      <p className="visually-hidden">{copy.passiveView}.</p>
      <div aria-hidden="true" className="landing-product-viewport" data-showcase-passive inert="" ref={viewportRef}>
        <div className={isChat ? "landing-product landing-product-chat" : "landing-product-public"}>
          <ItineraryViewer
            activeView={activeView}
            headingLevel={3}
            itinerary={itinerary}
            selectedListDate={selectedListDate}
            selectedListDetailView={selectedListDetailView}
            selectedRouteDate="2026-08-13"
            uiLocale={locale}
            variant={isChat ? "chat" : "public"}
          />
        </div>
      </div>
      {privacy ? <div className="landing-privacy-note"><span aria-hidden="true">✓</span><p><strong>{copy.publicCopy}</strong><small>{copy.publicCopyDetail}</small></p></div> : null}
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

function CreateConversation({ activeView, beat, copy, itinerary, adjustedItinerary, locale, scene }) {
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
        <div aria-label={copy.conversationAria} className="landing-conversation-thread" data-conversation-thread role="log">
          <UserTurn messageId="initial-request" visible={showsInitialUser}>{copy.heroPrompt}</UserTurn>
          <div aria-hidden={showsInitialThinking ? undefined : "true"} className={`landing-turn ${showsInitialThinking ? "is-visible" : ""}`} data-message-id="initial-thinking">
            {showsInitialThinking ? <ThinkingIndicator label={copy.interpreting} /> : null}
          </div>
          <AgentTurn messageId="initial-clarification" visible={showsInitialClarification}>
            <p>{copy.clarification}</p>
            <div aria-label={copy.context} className="landing-context-chips"><span>Buenos Aires</span><span>{copy.noCar}</span><span>{copy.localLife}</span></div>
          </AgentTurn>
          <UserTurn messageId="trip-details" visible={showsPlanning}>{copy.tripDetails}</UserTurn>
          <AgentTurn className="landing-generation-turn" messageId="itinerary-generation" visible={showsPlanning}>
            <p>{copy.researchReply}</p>
            <div className="landing-planning-card is-visible" role={showsPlanning ? "status" : undefined}>
              <div className="landing-planning-head"><span>{copy.generating}</span><strong>{copy.days14}</strong></div>
              <div className={`landing-planning-line ${reached(beat, "planningResearch") ? "is-complete" : ""}`}><span />{copy.researchLine}</div>
              <div className={`landing-planning-line ${reached(beat, "planningSchedule") ? "is-complete" : ""}`}><span />{copy.scheduleLine}</div>
              <div className={`landing-planning-line ${reached(beat, "planningRoutes") ? "is-complete" : ""}`}><span />{copy.routesLine}</div>
            </div>
          </AgentTurn>
          <AgentTurn className="landing-itinerary-turn" messageId="itinerary-v1" visible={showsViewer}>
            <p>{copy.itineraryReply}</p>
            <ProductViewer
              activeView={activeView}
              copy={copy}
              itinerary={itinerary}
              locale={locale}
              selectedListDate="2026-08-13"
              selectedListDetailView={beat === "viewsListDescription" ? "description" : "route"}
              surface="chat"
            />
          </AgentTurn>

          <UserTurn messageId="weather-request" visible={showsQueryUser}>{copy.queryPrompt}</UserTurn>
          <div aria-hidden={showsQueryThinking ? undefined : "true"} className={`landing-turn ${showsQueryThinking ? "is-visible" : ""}`} data-message-id="weather-thinking">
            {showsQueryThinking ? <ThinkingIndicator label={copy.weatherThinking} /> : null}
          </div>
          <AgentTurn className="landing-result-turn" messageId="weather-result" visible={showsQueryResult}>
            <p>{copy.weatherReply}</p>
            <div className="landing-weather-result" data-demo-result="weather"><span><strong>15–18 °C</strong><small>{copy.afternoons}</small></span><span><strong>6–9 °C</strong><small>{copy.mornings}</small></span><span><strong>{copy.packing}</strong><small>{copy.packingDetail}</small></span></div>
          </AgentTurn>

          <UserTurn messageId="adjust-request" visible={showsChangeUser}>{copy.modificationPrompt}</UserTurn>
          <div aria-hidden={showsChangeThinking ? undefined : "true"} className={`landing-turn ${showsChangeThinking ? "is-visible" : ""}`} data-message-id="adjust-thinking">
            {showsChangeThinking ? <ThinkingIndicator label={copy.changeThinking} /> : null}
          </div>
          <AgentTurn className="landing-result-turn" messageId="adjust-result" visible={showsChangeResult}>
            <p>{copy.changeReply}</p>
            <div className="landing-demo-result" data-demo-result="modification"><span>✓</span><strong>Recoleta 11:00 · MALBA 15:30</strong></div>
          </AgentTurn>
          <AgentTurn className="landing-itinerary-turn landing-itinerary-turn-adjusted" messageId="itinerary-v2" visible={showsChangeResult}>
            <p>{copy.changedVersion}</p>
            <ProductViewer
              activeView="list"
              copy={copy}
              itinerary={adjustedItinerary}
              locale={locale}
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

function CreateStage({ activeView, adjustedItinerary, beat, copy, itinerary, locale, scene }) {
  return (
    <div aria-label={copy.createStageAria} className="landing-stage" data-create-stage data-stage-surface="conversation">
      <div aria-live="polite" className="visually-hidden">{copy.scene({ current: scene + 1, total: copy.createSteps.length, title: copy.createSteps[scene]?.title })}</div>
      <CreateConversation activeView={activeView} adjustedItinerary={adjustedItinerary} beat={beat} copy={copy} itinerary={itinerary} locale={locale} scene={scene} />
      <p className="landing-stage-caption"><span>{String(scene + 1).padStart(2, "0")}</span>{copy.createCaption}</p>
    </div>
  );
}

function ShareReceipt({ copy }) {
  return (
    <div className="landing-share-receipt">
      <div className="landing-share-receipt-body">
        <span aria-hidden="true" className="landing-share-check">✓</span>
        <p className="site-kicker">{copy.shareReceiptKicker}</p>
        <h3>{copy.shareReceiptTitle}</h3>
        <p>{copy.shareReceiptBody}</p>
        <div className="landing-link-field"><span>sendero.app/share/••••••••</span><strong>{copy.copyLink}</strong></div>
        <small>{copy.shareReceiptDetail}</small>
      </div>
    </div>
  );
}

function AccessStage({ copy }) {
  return (
    <div className="landing-access-stage">
      <div className="landing-access-body">
        <header><div><p className="site-kicker">{copy.restrictedKicker}</p><h3>{copy.accessTitle}</h3></div><span className="landing-access-invite">{copy.inviteEmail}</span></header>
        <div className="landing-access-row"><span className="landing-avatar is-owner">MP</span><p><strong>Manuel</strong><small>{copy.ownerDetail}</small></p><span>{copy.owner}</span></div>
        <div className="landing-access-row"><span className="landing-avatar">AL</span><p><strong>Ana L.</strong><small>{copy.collaboratorDetail}</small></p><span>{copy.collaborator}</span></div>
        <div className="landing-access-row"><span className="landing-avatar">JR</span><p><strong>Julián R.</strong><small>{copy.viewerDetail}</small></p><span>{copy.viewer}</span></div>
      </div>
    </div>
  );
}

function CollaboratorStage({ copy, itinerary, locale }) {
  return (
    <div className="landing-collaborator-stage">
      <span aria-label={copy.updatedAria} className="landing-collaborator-status" role="status">{copy.updated}</span>
      <p className="visually-hidden">{copy.collaboratorPassive}</p>
      <div aria-hidden="true" className="landing-product-viewport" data-showcase-passive inert="">
        <div className="landing-product">
          <ItineraryViewer
            activeView="reservations"
            headingLevel={3}
            itinerary={itinerary}
            uiLocale={locale}
            variant="chat"
          />
        </div>
      </div>
    </div>
  );
}

function ShareStage({ copy, itinerary, locale, publicItinerary, scene }) {
  const captions = copy.shareCaptions;
  const badges = copy.shareBadges;
  const panels = [
    <ShareReceipt copy={copy} key="publish" />,
    <ProductViewer activeView="list" copy={copy} itinerary={publicItinerary} key="explore" locale={locale} />,
    <ProductViewer activeView="routes" copy={copy} itinerary={publicItinerary} key="privacy" locale={locale} privacy />,
    <AccessStage copy={copy} key="access" />,
    <CollaboratorStage copy={copy} itinerary={itinerary} key="collaborate" locale={locale} />,
  ];
  return (
    <div aria-label={copy.shareStageAria} className="landing-stage landing-stage-share" data-stage-surface="share">
      <div aria-live="polite" className="visually-hidden">{copy.scene({ current: scene + 1, total: copy.shareSteps.length, title: copy.shareSteps[scene]?.title })}</div>
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

function StorySection({ activeScene, children, copy, description, id, showHeading = true, steps, title }) {
  return (
    <section aria-labelledby={`${id}-title`} className={`landing-story-section ${showHeading ? "" : "landing-story-section-direct"}`} id={id}>
      {showHeading ? (
        <header className="landing-story-heading" data-story-reveal>
          <p className="site-kicker">{copy.shareKicker}</p>
          <h2 id={`${id}-title`}>{title}</h2>
          <p>{description}</p>
        </header>
      ) : <h2 className="visually-hidden" id={`${id}-title`}>{copy.howTitle}</h2>}
      <div className="landing-story-grid">
        <div className="landing-story-sticky">{children}</div>
        <div className="landing-story-steps">
          {steps.map((step, index) => <StoryStep active={activeScene === index} chapter={id === "crear" ? "create" : "share"} index={index} key={step.title} step={step} />)}
        </div>
      </div>
    </section>
  );
}

function PrivacySection({ copy }) {
  return (
    <section aria-labelledby="privacidad-title" className="landing-privacy" id="privacidad" data-story-reveal>
      <div><p className="site-kicker">{copy.privacyKicker}</p><h2 id="privacidad-title">{copy.privacyTitle}</h2></div>
      <div className="landing-privacy-grid">
        {copy.privacyItems.map(([title, body], index) => <article key={title}><span>{String(index + 1).padStart(2, "0")}</span><h3>{title}</h3><p>{body}</p></article>)}
      </div>
    </section>
  );
}

function FrequentlyAskedQuestions({ copy }) {
  return (
    <section aria-labelledby="preguntas-title" className="landing-faq" id="preguntas">
      <header data-story-reveal><p className="site-kicker">{copy.faqKicker}</p><h2 id="preguntas-title">{copy.faqTitle}</h2></header>
      <div className="landing-faq-list">
        {copy.faq.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
      </div>
    </section>
  );
}

function SiteFooter({ copy, locale, onLocaleChange }) {
  return (
    <>
      <section aria-labelledby="final-cta-title" className="site-final-cta landing-final-cta" data-story-reveal>
        <p className="site-kicker">{copy.finalKicker}</p>
        <h2 id="final-cta-title">{copy.finalTitle}</h2>
        <p>{copy.finalBody}</p>
        <a className="site-button site-button-primary" href={hrefForLocale("/app/new", locale)}>{copy.createTrip} <span aria-hidden="true">→</span></a>
      </section>
      <footer className="site-footer landing-footer">
        <a aria-label={copy.home} className="site-brand" href={hrefForLocale("/", locale)}><BrandMark /><span>Sendero</span></a>
        <p>{copy.tagline}</p>
        <nav aria-label={copy.footerNav}>
          <a href={signInHref(locale)}>{copy.signIn}</a>
          <a href={hrefForLocale("/privacy", locale)}>{copy.privacy}</a>
          <a href={hrefForLocale("/terms", locale)}>{copy.terms}</a>
          <LanguageSelector className="landing-footer-language-selector" locale={locale} onChange={onLocaleChange} showFlags />
        </nav>
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
  const { locale, selectLocale } = useUiLocale();
  const copy = landingCopy(locale);
  const rootRef = useRef(null);
  const [createScene, setCreateScene] = useState(0);
  const [createBeat, setCreateBeat] = useState("hidden");
  const [shareScene, setShareScene] = useState(0);
  const [composerDocked, setComposerDocked] = useState(false);
  const itinerary = useMemo(() => ({ ...landingShowcaseItinerary, locale }), [locale]);
  const adjustedItinerary = useMemo(() => ({ ...adjustedShowcaseItinerary, locale }), [locale]);
  const publicItinerary = useMemo(() => sanitizePublicSnapshot(itinerary), [itinerary]);

  const activateCreateScene = useCallback((scene) => {
    setCreateScene(scene);
  }, []);

  const activateShareScene = useCallback((scene) => {
    setShareScene(scene);
  }, []);

  useLandingStory(rootRef, {
    heroPrompt: copy.heroPrompt,
    modificationPrompt: copy.modificationPrompt,
    onComposerDockChange: setComposerDocked,
    onCreateBeatChange: setCreateBeat,
    onCreateScene: activateCreateScene,
    onShareScene: activateShareScene,
    queryPrompt: copy.queryPrompt,
  });

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => window.__senderoIntroReady?.());
    return () => window.cancelAnimationFrame(frame);
  }, []);
  useEffect(() => { document.title = copy.documentTitle; }, [copy.documentTitle]);

  function startDemo(event) {
    event.preventDefault();
    const textarea = event.currentTarget.querySelector("textarea");
    if (textarea) textarea.value = copy.heroPrompt;
    textarea?.blur();
    if (composerDocked) return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    document.getElementById("crear")?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }

  return (
    <div className="landing-page" ref={rootRef}>
      <a className="site-skip-link" href="#contenido">{copy.skip}</a>
      <SiteHeader copy={copy} locale={locale} />
      <main id="contenido">
        <Hero copy={copy} composerDocked={composerDocked} locale={locale} onDemoSubmit={startDemo} />
        <StorySection activeScene={createScene} copy={copy} id="crear" showHeading={false} steps={copy.createSteps}>
          <CreateStage activeView={createViewForBeat(createBeat)} adjustedItinerary={adjustedItinerary} beat={createBeat} copy={copy} itinerary={itinerary} locale={locale} scene={createScene} />
        </StorySection>
        <StorySection activeScene={shareScene} copy={copy} description={copy.shareDescription} id="compartir" steps={copy.shareSteps} title={copy.shareTitle}>
          <ShareStage copy={copy} itinerary={itinerary} locale={locale} publicItinerary={publicItinerary} scene={shareScene} />
        </StorySection>
        <PrivacySection copy={copy} />
        <FrequentlyAskedQuestions copy={copy} />
        <SiteFooter copy={copy} locale={locale} onLocaleChange={selectLocale} />
      </main>
    </div>
  );
}
