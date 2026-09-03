import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import test from "node:test";
import { landingCopy } from "./src/landing/copy.js";
import { landingShowcaseItinerary } from "./src/landing/showcase-itinerary.js";

const projectRoot = resolve(import.meta.dirname, "..");

function runBuild(outputPath) {
  return new Promise((resolveBuild, rejectBuild) => {
    const child = spawn(process.execPath, ["web/build.mjs"], {
      cwd: projectRoot,
      env: {
        ...process.env,
        PUBLIC_WEB_URL: "https://sendero.example",
        SENDERO_CHATGPT_URL: "https://chatgpt.com/g/g-sendero",
        SENDERO_UI_OUTPUT_PATH: outputPath,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", rejectBuild);
    child.once("exit", (code) => {
      if (code === 0) resolveBuild();
      else rejectBuild(new Error(`UI build exited with ${code}: ${stderr}`));
    });
  });
}

function runDevelopmentBuild(outputPath) {
  return new Promise((resolveBuild, rejectBuild) => {
    const child = spawn(process.execPath, ["web/build.mjs"], {
      cwd: projectRoot,
      env: {
        ...process.env,
        PUBLIC_WEB_URL: "https://sendero-dev.example",
        SENDERO_ENVIRONMENT: "development",
        SENDERO_UI_OUTPUT_PATH: outputPath,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", rejectBuild);
    child.once("exit", (code) => {
      if (code === 0) resolveBuild();
      else rejectBuild(new Error(`Development UI build exited with ${code}: ${stderr}`));
    });
  });
}

test("build exports the landing and legal documents with public metadata", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "sendero-landing-"));
  const outputPath = join(directory, "widgets.mjs");
  t.after(() => rm(directory, { force: true, recursive: true }));

  await runBuild(outputPath);
  const pages = await import(`${pathToFileURL(outputPath).href}?test=${Date.now()}`);

  assert.match(pages.landingPageHtml, /<html class="site-document" lang="es">/);
  assert.match(pages.landingPageHtml, /<title>Sendero · Planifica conversando<\/title>/);
  assert.match(pages.landingPageHtml, /rel="canonical" href="https:\/\/sendero\.example\/"/);
  assert.match(pages.landingPageHtml, /property="og:title" content="Sendero · Planifica conversando"/);
  assert.match(pages.landingPageHtml, /name="sendero-chatgpt-url" content="https:\/\/chatgpt\.com\/g\/g-sendero"/);
  assert.match(pages.landingPageHtml, /application\/ld\+json/);
  assert.match(pages.landingPageHtml, /Tu viaje empieza con una frase\./);
  assert.match(pages.landingPageHtml, /Saltar al contenido/);
  assert.match(pages.landingPageHtml, /sendero_locale/);
  assert.match(pages.landingPageHtml, /Ingresar/);
  assert.match(pages.landingPageHtml, /Crear un itinerario/);
  assert.doesNotMatch(pages.landingPageHtml, /Abrir en ChatGPT/);
  assert.match(pages.landingPageHtml, /Your trip starts with one sentence\./);
  assert.match(pages.landingPageHtml, /Sua viagem come.{0,8}a com uma frase\./);
  assert.match(pages.landingPageHtml, /Votre voyage commence par une phrase\./);
  assert.match(pages.landingPageHtml, /Deine Reise beginnt mit einem Satz\./);
  assert.match(pages.landingPageHtml, /Haz scroll para ver c.{0,8}mo Sendero crea, organiza y comparte tu viaje\./);
  assert.match(pages.landingPageHtml, /Describe tu viaje/);
  assert.match(pages.landingPageHtml, /Iniciar recorrido de ejemplo/);
  assert.match(pages.landingPageHtml, /C.{0,8}mo funciona Sendero/);
  assert.doesNotMatch(pages.landingPageHtml, /PLANIFICA EN CONVERSACI.{0,8}N/);
  assert.doesNotMatch(pages.landingPageHtml, /Prueba la idea/);
  assert.doesNotMatch(pages.landingPageHtml, /Descubre el recorrido/);
  assert.doesNotMatch(pages.landingPageHtml, /Ver mis viajes/);
  assert.doesNotMatch(pages.landingPageHtml, /Demostraci.{0,8}n local .{0,8} no guarda datos/);
  assert.doesNotMatch(pages.landingPageHtml, /14 d.{0,8}as conectados/);
  assert.doesNotMatch(pages.landingPageHtml, /3 formas de verlo/);
  assert.doesNotMatch(pages.landingPageHtml, /Compartir con control/);
  assert.doesNotMatch(pages.landingPageHtml, /CREAR Y EXPLORAR/);
  assert.doesNotMatch(pages.landingPageHtml, /Mira c.{0,8}mo una idea toma forma\./);
  assert.match(pages.landingPageHtml, /id="sendero-intro"/);
  assert.match(pages.landingPageHtml, /sendero:intro:v1/);
  assert.match(pages.landingPageHtml, /Una conversaci.{0,8}n .{0,8} componentes reales/);
  assert.match(pages.landingPageHtml, /Copia p.{0,8}blica sanitizada/);
  assert.match(pages.landingPageHtml, /solicitud expl.{0,8}cita publica directamente/);
  assert.match(pages.landingPageHtml, /Edici.{0,8}n acotada en la web/);
  assert.match(pages.landingPageHtml, /03 .{0,8} El itinerario/);
  assert.match(pages.landingPageHtml, /04 .{0,8} Rutas/);
  assert.match(pages.landingPageHtml, /05 .{0,8} Reservas/);
  assert.match(pages.landingPageHtml, /06 .{0,8} Consultas/);
  assert.match(pages.landingPageHtml, /07 .{0,8} .{0,8}Quieres cambiar algo/);
  assert.doesNotMatch(pages.landingPageHtml, /03 .{0,8} Lista/);
  assert.doesNotMatch(pages.landingPageHtml, /04 .{0,8} Calendario/);
  assert.doesNotMatch(pages.landingPageHtml, /08 .{0,8} Clima/);
  assert.match(pages.landingPageHtml, /data-demo-result.{0,8}modification/);
  assert.match(pages.landingPageHtml, /data-demo-result.{0,8}weather/);
  assert.doesNotMatch(pages.landingPageHtml, /03 .{0,8} M.{0,8}vil/);
  assert.doesNotMatch(pages.landingPageHtml, /landing-(?:window-bar|browser(?:-bar|-dots|-address|-phone)?)/);

  assert.match(pages.privacyPageHtml, /<title>Privacidad · Sendero<\/title>/);
  assert.match(pages.privacyPageHtml, /rel="canonical" href="https:\/\/sendero\.example\/privacy"/);
  assert.match(pages.privacyPageHtml, /proveedor de acceso/);

  assert.match(pages.termsPageHtml, /<title>Términos · Sendero<\/title>/);
  assert.match(pages.termsPageHtml, /rel="canonical" href="https:\/\/sendero\.example\/terms"/);
  assert.match(pages.termsPageHtml, /Sendero no es una agencia de viajes/);
  assert.doesNotMatch(pages.privacyPageHtml, /\.landing-story-grid/);
  assert.doesNotMatch(pages.termsPageHtml, /id="sendero-intro"/);

  assert.match(pages.publicSharePageHtml, /name="robots" content="noindex,nofollow,noarchive"/);
  assert.doesNotMatch(pages.itineraryWidgetHtml, /sendero-chatgpt-url/);
});

test("public site and landing-only styles include responsive, motion, and dark contracts", async () => {
  const [styles, landingStyles] = await Promise.all([
    readFile(resolve(projectRoot, "web/src/styles.css"), "utf8"),
    readFile(resolve(projectRoot, "web/src/landing/landing.css"), "utf8"),
  ]);
  assert.match(styles, /html\.site-document/);
  assert.match(styles, /@media \(prefers-color-scheme: dark\)/);
  assert.match(styles, /@media \(max-width: 820px\)/);
  assert.match(styles, /font: 16px\/1\.55 Inter/);
  assert.match(landingStyles, /\.landing-story-sticky/);
  assert.match(landingStyles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(landingStyles, /@media \(prefers-color-scheme: dark\)/);
});

test("landing keeps one chronological chat, one passive composer, a seven-scene story, and reversible scrubbed interactions", async () => {
  const spanishCopy = landingCopy("es");
  const [landingSource, landingStyles, motionSource] = await Promise.all([
    readFile(resolve(projectRoot, "web/src/landing/LandingApp.jsx"), "utf8"),
    readFile(resolve(projectRoot, "web/src/landing/landing.css"), "utf8"),
    readFile(resolve(projectRoot, "web/src/landing/useLandingStory.js"), "utf8"),
  ]);

  assert.doesNotMatch(landingSource, /className="site-nav"/);
  assert.doesNotMatch(landingSource, /chatGptUrl|chatGptCtaCopy|target="_blank"/);
  assert.match(landingSource, /function signInHref\(locale\)[\s\S]{0,180}?\/auth\/login/);
  assert.equal([...landingSource.matchAll(/href=\{signInHref\(locale\)\}/g)].length, 2, "header and footer sign-in links must open authentication directly");
  assert.match(landingSource, /href={hrefForLocale\("\/app\/new", locale\)\}[\s\S]*?\{copy\.createTrip\}/);
  assert.equal([...landingSource.matchAll(/<LanguageSelector\b/g)].length, 1, "the landing must render the language selector only in the footer");
  assert.match(landingSource, /className="landing-footer-language-selector"[\s\S]{0,160}?showFlags/);
  assert.doesNotMatch(landingSource, /landing-hero-links|landing-composer-meta|landing-signals/);
  assert.match(landingSource, /<label className="visually-hidden" htmlFor="sendero-demo-prompt">\{copy\.composerLabel\}<\/label>/);
  assert.equal([...landingSource.matchAll(/<textarea\b/g)].length, 1, "the landing must render a single real textarea");
  assert.equal([...landingSource.matchAll(/<form className="landing-composer"/g)].length, 1, "the landing must render a single real composer form");
  assert.equal([...landingSource.matchAll(/<HeroComposer\b/g)].length, 1, "the hero composer must mount only once");
  assert.match(landingSource, /<textarea[\s\S]*?aria-readonly="true"[\s\S]*?data-composer-text[\s\S]*?readOnly[\s\S]*?rows="1"[\s\S]*?tabIndex="-1"/);
  assert.doesNotMatch(landingSource, /<textarea[\s\S]{0,500}?onChange=/);
  assert.match(landingSource, /data-full-value=\{copy\.heroPrompt\}/);
  assert.match(landingSource, /aria-label=\{copy\.composerAction\} data-composer-send/);
  assert.match(landingSource, /d="M12 18V6m0 0-5 5m5-5 5 5"/);
  assert.match(landingSource, /data-composer-source/);
  assert.match(landingSource, /data-composer-carrier/);
  assert.match(landingSource, /data-composer-morph/);
  assert.match(landingSource, /className="landing-composer-dock" data-composer-target/);
  assert.equal([...landingSource.matchAll(/\bdata-composer-text\b/g)].length, 1, "the real textarea must be the only animated composer text surface");
  assert.equal([...landingSource.matchAll(/\bdata-composer-target\b/g)].length, 1, "the conversation must expose one empty geometric dock");
  assert.doesNotMatch(landingSource, /landing-composer-ghost|data-docked-composer(?:-text)?/);
  assert.match(landingSource, /<UserTurn messageId="initial-request" visible=\{showsInitialUser\}>\{copy\.heroPrompt\}<\/UserTurn>/);
  assert.match(landingSource, /data-create-conversation/);
  assert.match(landingSource, /data-demo-phase=\{beat\}/);
  assert.match(landingSource, /data-demo-interaction=/);
  assert.match(landingSource, /data-interaction-state=/);
  assert.match(landingSource, /data-showcase-passive inert=""/);
  assert.match(landingSource, /data-demo-result="modification"/);
  assert.match(landingSource, /data-demo-result="weather"/);
  assert.match(landingSource, /data-stage-surface="conversation"/);
  assert.match(landingSource, /data-share-stack/);
  assert.equal([...landingSource.matchAll(/\bdata-share-panel\b/g)].length, 1, "share panels must be rendered by one persistent mapped stack");
  assert.match(landingSource, /<ShareReceipt copy=\{copy\} key="publish" \/>/);
  assert.match(landingSource, /<ProductViewer activeView="list" copy=\{copy\} itinerary=\{publicItinerary\} key="explore" locale=\{locale\} \/>/);
  assert.match(landingSource, /<ProductViewer activeView="routes" copy=\{copy\} itinerary=\{publicItinerary\} key="privacy" locale=\{locale\} privacy \/>/);
  assert.match(landingSource, /<AccessStage copy=\{copy\} key="access" \/>/);
  assert.match(landingSource, /<CollaboratorStage copy=\{copy\} itinerary=\{itinerary\} key="collaborate" locale=\{locale\} \/>/);
  assert.doesNotMatch(landingSource, /let content;[\s\S]*?if \(scene ===/);
  assert.doesNotMatch(landingSource, /shareViewForScene|setShareView/);
  assert.equal([...landingSource.matchAll(/\bdata-conversation-scroll\b/g)].length, 1, "the conversation must expose one scrollport");
  assert.equal([...landingSource.matchAll(/\bdata-conversation-thread\b/g)].length, 1, "the conversation must expose one chronological thread");
  assert.match(landingSource, /className="landing-conversation-scroll" data-conversation-scroll/);
  assert.match(landingSource, /className="landing-conversation-thread" data-conversation-thread role="log"/);
  assert.match(
    landingSource,
    /data-conversation-thread role="log"[\s\S]*?<\/div>\s*<\/div>\s*<div[^>]*className="landing-composer-dock"[^>]*data-composer-target/,
    "the persistent composer must be a sibling after, not a child of, the conversation scrollport",
  );

  assert.match(landingSource, /data-message-id=\{messageId\}/, "conversation turn IDs must be exposed in the rendered DOM");
  const chronologicalMessageOrder = ["itinerary-v1", "weather-request", "weather-result", "adjust-request", "adjust-result", "itinerary-v2"]
    .map((messageId) => landingSource.indexOf(`messageId="${messageId}"`));
  assert.ok(chronologicalMessageOrder.every((position) => position >= 0), "every chronological product and chat turn must be present");
  assert.deepEqual(
    chronologicalMessageOrder,
    [...chronologicalMessageOrder].sort((left, right) => left - right),
    "the original itinerary, query, adjustment, and adjusted itinerary must remain in conversational order",
  );
  assert.match(landingSource, /messageId="itinerary-v1"[\s\S]*?<ProductViewer[\s\S]*?itinerary=\{itinerary\}/);
  assert.match(landingSource, /messageId="itinerary-v2"[\s\S]*?<ProductViewer[\s\S]*?itinerary=\{adjustedItinerary\}/);
  assert.doesNotMatch(landingSource, /landing-conversation-(?:history|product)|has-viewer/);
  assert.match(landingSource, /showHeading=\{false\}/);
  assert.match(landingSource, /<h2 className="visually-hidden" id=\{`\$\{id\}-title`\}>\{copy\.howTitle\}<\/h2>/);

  assert.equal(spanishCopy.shareSteps.length, 5, "sharing must have five scenes");
  assert.doesNotMatch(JSON.stringify(spanishCopy.shareSteps), /M.{0,8}vil/);
  assert.doesNotMatch(landingSource, /landing-stage-(?:stack|layer)|landing-window-bar|landing-browser(?:-bar|-dots|-address|-phone)?/);
  assert.doesNotMatch(landingSource, /\bframe=\{/);
  assert.equal(spanishCopy.createSteps.length, 7, "creation must have seven scenes with explicit dwell time");
  assert.ok(spanishCopy.createSteps.every((step) => step.dwell), "each creation scene must declare dwell time");
  const createStepBlock = JSON.stringify(spanishCopy.createSteps);
  assert.match(createStepBlock, /01 .{0,8} El contexto/);
  assert.match(createStepBlock, /02 .{0,8} La preparaci.{0,8}n/);
  assert.match(createStepBlock, /03 .{0,8} El itinerario/);
  assert.match(createStepBlock, /04 .{0,8} Rutas/);
  assert.match(createStepBlock, /05 .{0,8} Reservas/);
  assert.match(createStepBlock, /06 .{0,8} Consultas/);
  assert.match(createStepBlock, /07 .{0,8} .{0,8}Quieres cambiar algo/);
  assert.doesNotMatch(createStepBlock, /03 .{0,8} Lista|04 .{0,8} Calendario|08 .{0,8} Clima/);
  const creationOrder = ["El contexto", "La preparación", "El itinerario", "Rutas", "Reservas", "Consultas", "¿Quieres cambiar algo?"]
    .map((label) => createStepBlock.indexOf(label));
  assert.ok(creationOrder.every((position) => position >= 0), "every creation chapter must be present");
  assert.deepEqual(creationOrder, [...creationOrder].sort((left, right) => left - right), "creation chapters must preserve the intended narrative order");
  const beatOrderBlock = landingSource.match(/const beatOrder = \[([\s\S]*?)\n\];/);
  assert.ok(beatOrderBlock, "conversation beats must remain declared as one chronological sequence");
  assert.ok(beatOrderBlock[1].indexOf('"reservations"') < beatOrderBlock[1].indexOf('"queryTyping"'), "consultation beats must begin after reservations");
  assert.match(landingSource, /if \(beat === "changeTyping"\) return "weather-result"/);
  assert.match(landingSource, /beat === "reservations" \|\| beat\.startsWith\("query"\)/);
  assert.doesNotMatch(landingSource, /setTimeout\(alignToMessage/);
  assert.match(landingSource, /data-dwell=\{step\.dwell \|\| "medium"\}/);
  assert.match(landingSource, /className="landing-story-step-copy"/);
  assert.match(landingSource, /selectedListDetailView=\{beat === "viewsListDescription" \? "description" : "route"\}/);
  assert.doesNotMatch(landingSource, /onViewChange=|onReservationStatusChange=|reservationWritable/);

  assert.match(landingStyles, /\.landing-header\s*\{[\s\S]*?border-bottom:\s*0/);
  assert.match(landingStyles, /@font-face\s*\{[\s\S]*?font-family:\s*"Sendero Recoleta"[\s\S]*?local\("Recoleta Medium"\)/);
  assert.match(landingStyles, /\.landing-page,[\s\S]*?font-family:\s*Inter/);
  assert.match(landingStyles, /\.landing-composer button\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px;[\s\S]*?border-radius:\s*50%;[\s\S]*?background:\s*#000/);
  assert.match(landingStyles, /\[data-create-stage\]\s*\{[^}]*place-items:\s*center/);
  assert.match(landingStyles, /\.landing-conversation\s*\{[^}]*align-self:\s*center/);
  assert.match(landingStyles, /\.landing-conversation-scroll\s*\{/);
  assert.match(landingStyles, /\.landing-conversation-scroll\s*\{[\s\S]*?scroll-behavior:\s*auto/);
  assert.match(landingStyles, /\.landing-conversation-thread\s*\{/);
  assert.doesNotMatch(landingStyles, /\.landing-conversation-product|\.landing-conversation\.has-viewer|\.has-viewer|\.landing-conversation-history/);
  assert.match(landingStyles, /\.landing-story-step\[data-story-step="create"\]\[data-dwell="long"\]\s*\{[^}]*min-height:\s*170svh/);
  assert.match(landingStyles, /\.landing-story-step\[data-story-step="create"\]\[data-dwell="xlong"\]\s*\{[^}]*min-height:\s*240svh/);
  assert.match(landingStyles, /\.landing-story-step\[data-story-step="create"\] \.landing-story-step-copy\s*\{[^}]*position:\s*sticky[^}]*top:\s*50svh/);
  assert.match(landingStyles, /\.landing-composer-dock\s*\{/);
  assert.match(landingStyles, /\.landing-composer-dock\s*\{[^}]*min-height:\s*72px/);
  assert.doesNotMatch(landingStyles, /\.landing-composer-ghost/);
  assert.match(landingStyles, /\.landing-share-panel\s*\{[^}]*position:\s*absolute[^}]*opacity:\s*0[^}]*visibility:\s*hidden[^}]*pointer-events:\s*none/);
  assert.match(landingStyles, /\.landing-share-badge-stack\s*\{[^}]*position:\s*relative/);
  assert.match(landingStyles, /\.landing-share-caption-stack\s*\{[^}]*position:\s*relative/);
  assert.match(landingStyles, /\.landing-product-surface\s*\{/);
  assert.match(landingStyles, /\[data-showcase-passive\]\s*\{\s*pointer-events:\s*none;\s*user-select:\s*none/);
  assert.match(landingStyles, /\.landing-product-public\s*\{[\s\S]*?padding:\s*0 36px 36px/);
  assert.match(landingStyles, /\.landing-product \.day-route-content\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1\.35fr\) minmax\(150px, \.65fr\)/);
  assert.match(landingStyles, /\.landing-product \.day-context-item\s*\{/);
  assert.doesNotMatch(landingStyles, /\.landing-product \.day-context\s*\{[^}]*display:\s*none/);
  assert.doesNotMatch(landingStyles, /@media \(max-width: 820px\)[\s\S]*?\.landing-header \.site-header-actions > \.site-text-link\s*\{\s*display:\s*inline-flex/);
  assert.match(landingStyles, /@media \(prefers-color-scheme: dark\)[\s\S]*?\.landing-composer button\s*\{\s*background:\s*#000;\s*color:\s*#fff/);
  assert.match(landingStyles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.landing-page\[data-motion="reduced"\] \.landing-composer-dock\s*\{[^}]*min-height:\s*0/);
  assert.match(landingStyles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.landing-page\[data-motion="reduced"\] \.landing-composer-shell,[\s\S]*?animation:\s*none;\s*transition:\s*none/);
  assert.doesNotMatch(landingStyles, /\.landing-window-bar|\.landing-browser(?:-bar|-dots|-address|-phone)?/);

  assert.match(motionSource, /function composerDestination/);
  assert.match(motionSource, /root\.querySelector\("\[data-composer-target\]"\)/);
  assert.match(motionSource, /root\.querySelector\("\[data-composer-text\]"\)/);
  assert.match(motionSource, /pin:\s*composerCarrier/);
  assert.match(motionSource, /scrub:\s*conditions\.mobile \? true : 0\.16/);
  assert.match(motionSource, /invalidateOnRefresh:\s*true/);
  assert.match(motionSource, /onCreateBeatChange\?\.\(beat\)/);
  assert.match(motionSource, /MutationObserver/);
  assert.match(motionSource, /heroPrompt\.slice\(0, Math\.round\(cursor\.length\)\)/);
  assert.match(motionSource, /paused:\s*true/);
  assert.match(motionSource, /const playhead = \{ progress: 0 \}/);
  assert.match(motionSource, /onUpdate: \(\) => renderNarrativeAt\(playhead\.progress\)/);
  assert.match(motionSource, /queryPrompt/);
  assert.match(motionSource, /modificationPrompt/);
  assert.match(motionSource, /"deleting"/);
  assert.match(motionSource, /onEnterBack/);
  for (const state of ["queryTyping", "querySent", "queryThinking", "queryAnswered", "changeTyping", "changeSent", "changeThinking", "changeApplied"]) {
    assert.match(landingSource, new RegExp(`"${state}"`), `the reversible interaction state ${state} must remain observable`);
  }
  assert.doesNotMatch(motionSource, /function scriptedBeat|syncScriptedPrompt/);
  assert.doesNotMatch(motionSource, /prompt\.length\s*\*\s*Math\.min\(1,\s*progress/);
  assert.doesNotMatch(motionSource, /scene === 6 \? modificationPrompt|scene === 6 \|\| scene === 7/);
  assert.match(motionSource, /if \(conditions\.reduce\)[\s\S]*?onCreateScene\?\.\(2\)/);
  assert.match(motionSource, /if \(conditions\.reduce\)[\s\S]*?onShareScene\?\.\(1\)/);
  assert.match(motionSource, /gsap\.set\(composer, \{ clearProps: "all" \}\)/);
  assert.doesNotMatch(motionSource, /backgroundColor|borderRadius/);
  assert.doesNotMatch(motionSource, /dockedComposer|dockedComposerText|\[data-docked-composer/);
  assert.doesNotMatch(motionSource, /\.to\(composer,\s*\{[^}]*autoAlpha:\s*0/);
  assert.match(motionSource, /new ResizeObserver\(scheduleComposerDockSync\)/);
  assert.match(motionSource, /bridgeProgress < 0\.995/);
});

test("creation and sharing keep native scroll and drive reversible playheads from document progress", async () => {
  const motionSource = await readFile(resolve(projectRoot, "web/src/landing/useLandingStory.js"), "utf8");

  assert.doesNotMatch(motionSource, /ScrollTrigger\.observe\s*\(/, "the landing must not intercept wheel or touch input");
  assert.doesNotMatch(motionSource, /preventDefault:\s*true/, "the motion layer must never cancel native document scroll");
  assert.doesNotMatch(motionSource, /window\.scrollTo\s*\(/, "the landing must not rewrite the user's scroll position");
  assert.doesNotMatch(motionSource, /ScrollTrigger\.normalizeScroll\s*\(/, "the story must not install a global scroll normalizer");
  assert.doesNotMatch(motionSource, /scrollGate|consumeScrollIntent|tweenScrollTo|pendingRequests?|requestQueue/i);

  assert.match(motionSource, /const createSteps = Array\.from\(root\.querySelectorAll\('\[data-story-step="create"\]'\)\)/);
  assert.match(motionSource, /sceneWeights = createSteps\.map\(\(step\) => Math\.max\(1, step\.offsetHeight\)\)/);
  assert.match(motionSource, /const playhead = \{ progress: 0 \}/);
  assert.match(motionSource, /animation:\s*narrativeTween/);
  assert.match(motionSource, /scrub:\s*conditions\.mobile \? true : 0\.16/);
  assert.match(motionSource, /onUpdate: \(\) => renderNarrativeAt\(playhead\.progress\)/);
  assert.match(motionSource, /const reversed = narrativeProgress < previousNarrativeProgress/);

  assert.match(motionSource, /const shareSteps = Array\.from\(root\.querySelectorAll\('\[data-story-step="share"\]'\)\)/);
  assert.match(motionSource, /const sharePanels = Array\.from\(root\.querySelectorAll\("\[data-share-panel\]"\)\)/);
  assert.match(motionSource, /shareWeights = shareSteps\.map\(\(step\) => Math\.max\(1, step\.offsetHeight\)\)/);
  assert.match(motionSource, /const sharePlayhead = \{ progress: 0 \}/);
  assert.match(motionSource, /onUpdate: \(\) => renderShareAt\(sharePlayhead\.progress\)/);
  assert.match(motionSource, /animation:\s*shareTween/);
  assert.match(motionSource, /shareTrigger\?\.kill\(\)/);
  assert.match(motionSource, /shareTween\?\.kill\(\)/);
  assert.doesNotMatch(motionSource, /for \(const step of root\.querySelectorAll\('\[data-story-step="share"\]'\)\)/);

  assert.match(motionSource, /scene === 2[\s\S]{0,260}emitBeat\(viewBeat\(progress\)\)/);
  assert.match(motionSource, /scene === 3[\s\S]{0,220}emitBeat\("routeFocus"\)/);
  assert.match(motionSource, /scene === 4[\s\S]{0,220}emitBeat\("reservations"\)/);
  assert.match(motionSource, /scene === 5[\s\S]{0,500}answeredBeat: "queryAnswered"[\s\S]{0,260}startBeat: "reservations"/);
  assert.match(motionSource, /answeredBeat: "changeApplied"[\s\S]{0,260}startBeat: "queryAnswered"/);

  const reducedBranchStart = motionSource.indexOf("if (conditions.reduce)");
  const playheadStart = motionSource.indexOf("const playhead = { progress: 0 }");
  assert.ok(reducedBranchStart >= 0 && reducedBranchStart < playheadStart, "reduced motion must branch before the scrubbed playhead is installed");
  assert.match(motionSource.slice(reducedBranchStart, playheadStart), /return\s*\(\)\s*=>/, "reduced motion must bypass the playhead entirely");
});

test("development builds are unmistakably labeled without changing production markup", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "sendero-development-"));
  const outputPath = join(directory, "widgets.mjs");
  t.after(() => rm(directory, { force: true, recursive: true }));

  await runDevelopmentBuild(outputPath);
  const pages = await import(`${pathToFileURL(outputPath).href}?test=${Date.now()}`);

  for (const html of [pages.landingPageHtml, pages.accountPageHtml, pages.itineraryWidgetHtml]) {
    assert.match(html, /data-sendero-environment="development"/);
    assert.match(html, /class="sendero-environment-badge"[^>]*>DEV<\/div>/);
  }
  assert.match(pages.landingPageHtml, /<title>Sendero · Planifica conversando · Dev<\/title>/);
});

test("the Buenos Aires showcase spans the complete two-week story", () => {
  assert.equal(landingShowcaseItinerary.destination, "Buenos Aires, Argentina");
  assert.equal(landingShowcaseItinerary.startDate, "2026-08-13");
  assert.equal(landingShowcaseItinerary.endDate, "2026-08-26");
  assert.equal(landingShowcaseItinerary.days.length, 14);
  assert.equal(new Set(landingShowcaseItinerary.days.map((day) => day.date)).size, 14);
  assert.ok(landingShowcaseItinerary.days.every((day) => day.activities.length && day.route));
});
