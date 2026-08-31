import { useState } from "react";
import { BrandMark } from "../components.jsx";
import { hrefForLocale, LanguageSelector, useUiLocale } from "../i18n/LanguageSelector.jsx";

export const authenticatedPageStyles = `
:root {
  color-scheme: light;
  --web-bg: #f6f2e4;
  --web-surface: #fffefe;
  --web-ink: #1f2927;
  --web-muted: #626b68;
  --web-line: rgba(0, 102, 94, .16);
  --web-soft: #f2f7f7;
  --web-forest: #00665e;
  --web-grass: #a2d45e;
  --web-danger: #a33c35;
  font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
* { box-sizing: border-box; }
html, body, #root { min-height: 100%; margin: 0; }
body { background: var(--web-bg); color: var(--web-ink); font: 15px/1.5 Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
.web-sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); clip-path: inset(50%); white-space: nowrap; }
button, input, select { font: inherit; }
a { color: inherit; }
:focus-visible { outline: 3px solid rgba(0, 102, 94, .32); outline-offset: 3px; }
.web-shell { width: min(1120px, calc(100% - 32px)); margin: 0 auto; padding: 22px 0 52px; }
.web-topbar { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-bottom: 42px; }
.web-topbar-actions { display: flex; align-items: center; justify-content: flex-end; gap: 10px; }
.web-brand { display: inline-flex; align-items: center; gap: 10px; color: inherit; font-size: 17px; font-weight: 700; text-decoration: none; }
.web-brand .brand-mark { display: grid; width: 30px; height: 30px; place-items: center; border-radius: 9px; background: var(--web-grass); color: #003834; }
.web-account { display: flex; align-items: center; justify-content: flex-end; gap: 10px; }
.web-user { min-width: 0; color: var(--web-muted); font-size: 14px; text-align: right; }
.web-account-actions { display: flex; align-items: center; gap: 4px; }
.web-account-action { min-height: 36px; border: 0; border-radius: 9px; padding: 7px 9px; background: transparent; color: var(--web-forest); cursor: pointer; font: inherit; font-size: 14px; font-weight: 680; }
.web-account-action:hover:not(:disabled) { background: var(--web-soft); }
.web-account-action:disabled { cursor: wait; opacity: .58; }
.web-account-error { margin: 0; color: var(--web-danger); font-size: 14px; text-align: right; }
.web-language-selector select { min-height: 36px; border: 1px solid var(--web-line); border-radius: 9px; padding: 6px 27px 6px 9px; background: var(--web-surface); color: var(--web-forest); cursor: pointer; font-size: 14px; font-weight: 680; }
.web-heading { max-width: 720px; margin-bottom: 28px; }
.web-eyebrow { margin: 0 0 8px; color: var(--web-forest); font-size: 14px; font-weight: 750; letter-spacing: .08em; text-transform: uppercase; }
.web-heading h1, .web-state-card h1 { margin: 0; font-size: clamp(30px, 6vw, 52px); letter-spacing: -.05em; line-height: 1.02; }
.web-heading p, .web-state-card p { margin: 13px 0 0; color: var(--web-muted); }
.web-state-layout { display: grid; min-height: calc(100vh - 130px); place-items: center; }
.web-state-card { width: min(620px, 100%); border: 1px solid var(--web-line); border-radius: 24px; padding: clamp(26px, 5vw, 48px); background: var(--web-surface); box-shadow: 0 22px 70px rgba(0, 56, 52, .08); }
.web-state-card h1 { font-size: clamp(28px, 5vw, 44px); }
.web-loading-dot { display: inline-block; width: 12px; height: 12px; margin-bottom: 22px; border-radius: 50%; background: var(--web-grass); animation: web-pulse 1.1s ease-in-out infinite alternate; }
.web-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 24px; }
.web-button { display: inline-flex; min-height: 42px; align-items: center; justify-content: center; gap: 8px; border: 1px solid var(--web-line); border-radius: 11px; padding: 9px 15px; background: var(--web-surface); color: var(--web-ink); cursor: pointer; font-weight: 680; text-decoration: none; }
.web-button:hover:not(:disabled) { border-color: var(--web-forest); }
.web-button-primary { border-color: var(--web-forest); background: var(--web-forest); color: white; }
.web-button-danger { color: var(--web-danger); }
.web-button:disabled { cursor: wait; opacity: .58; }
.web-inline-error { margin: 14px 0 0; color: var(--web-danger); font-size: 14px; }
.web-role-badge, .web-status-badge { display: inline-flex; min-height: 28px; align-items: center; border-radius: 999px; padding: 4px 11px; background: var(--web-soft); color: var(--web-forest); font-size: 14px; font-weight: 650; }
.web-status-badge.is-pending { background: #fff6d8; color: #655728; }
@keyframes web-pulse { to { opacity: .35; transform: scale(.8); } }
@media (prefers-color-scheme: dark) {
  :root { color-scheme: dark; --web-bg: #141815; --web-surface: #202620; --web-ink: #f2f5ee; --web-muted: #acb4ad; --web-line: rgba(155, 214, 205, .2); --web-soft: #28342f; --web-forest: #9bd6cd; }
  .web-button-primary { color: #003834; background: var(--web-grass); border-color: var(--web-grass); }
  .web-state-card { box-shadow: 0 22px 70px rgba(0, 0, 0, .22); }
}
@media (prefers-reduced-motion: reduce) { .web-loading-dot { animation: none; } }
@media (max-width: 640px) {
  .web-shell { width: min(100% - 22px, 1120px); padding-top: 14px; }
  .web-topbar { margin-bottom: 30px; }
  .web-account { align-items: flex-end; flex-direction: column; gap: 2px; }
  .web-topbar-actions { align-items: flex-end; gap: 4px; }
  .web-user { max-width: 58vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .web-account-actions { gap: 0; }
  .web-account-action { min-height: 32px; padding: 5px 7px; }
  .web-state-card { border-radius: 18px; }
}
`;

const FRAME_COPY = {
  en: {
    home: "Sendero, home",
    changeAccount: "Switch account",
    logout: "Sign out",
    logoutError: "We couldn't sign you out. Try again.",
    errorEyebrow: "We couldn't continue",
  },
  es: {
    home: "Sendero, inicio",
    changeAccount: "Cambiar cuenta",
    logout: "Cerrar sesión",
    logoutError: "No pudimos cerrar la sesión. Intenta nuevamente.",
    errorEyebrow: "No pudimos continuar",
  },
  pt: {
    home: "Sendero, início",
    changeAccount: "Trocar conta",
    logout: "Sair",
    logoutError: "Não foi possível encerrar a sessão. Tente novamente.",
    errorEyebrow: "Não foi possível continuar",
  },
  fr: {
    home: "Sendero, accueil",
    changeAccount: "Changer de compte",
    logout: "Se déconnecter",
    logoutError: "Impossible de vous déconnecter. Réessayez.",
    errorEyebrow: "Impossible de continuer",
  },
  de: {
    home: "Sendero, Startseite",
    changeAccount: "Konto wechseln",
    logout: "Abmelden",
    logoutError: "Die Abmeldung ist fehlgeschlagen. Versuche es erneut.",
    errorEyebrow: "Fortfahren nicht möglich",
  },
};

function currentReturnTo() {
  const pathname = globalThis.location?.pathname || "/app";
  const search = globalThis.location?.search || "";
  return `${pathname}${search}`;
}

export async function endSenderoSession(csrfToken, { changeAccount = false, returnTo = currentReturnTo() } = {}) {
  const response = await fetch("/auth/logout", {
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "X-CSRF-Token": csrfToken,
    },
    method: "POST",
    referrerPolicy: "same-origin",
  });
  if (!response.ok) throw new Error("logout_failed");
  const destination = changeAccount
    ? `/auth/login?returnTo=${encodeURIComponent(returnTo)}`
    : "/";
  globalThis.location.assign(destination);
}

function WebAccount({ copy, csrfToken, user }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function finishSession(changeAccount) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await endSenderoSession(csrfToken, { changeAccount });
    } catch {
      setBusy(false);
      setError(copy.logoutError);
    }
  }

  return (
    <div className="web-account">
      <span className="web-user">{user.name || user.email}</span>
      <div className="web-account-actions">
        <button className="web-account-action" disabled={busy} onClick={() => finishSession(true)} type="button">{copy.changeAccount}</button>
        <button className="web-account-action" disabled={busy} onClick={() => finishSession(false)} type="button">{copy.logout}</button>
      </div>
      {error ? <p className="web-account-error" role="alert">{error}</p> : null}
    </div>
  );
}

export function WebButton({ children, className = "", tone = "secondary", ...props }) {
  return (
    <button
      className={`web-button web-button-${tone} ${className}`.trim()}
      type="button"
      {...props}
    >{children}</button>
  );
}

export function WebPageFrame({ children, csrfToken = "", user, className = "" }) {
  const { language, locale, selectLocale } = useUiLocale();
  const copy = FRAME_COPY[language] || FRAME_COPY.es;
  return (
    <>
      <style>{authenticatedPageStyles}</style>
      <main className={`web-shell ${className}`.trim()}>
        <header className="web-topbar">
          <a aria-label={copy.home} className="web-brand" href={hrefForLocale("/", locale)}>
            <BrandMark />
            <span>Sendero</span>
          </a>
          <div className="web-topbar-actions">
            <LanguageSelector className="web-language-selector" locale={locale} onChange={selectLocale} />
            {user && csrfToken ? <WebAccount copy={copy} csrfToken={csrfToken} user={user} /> : null}
          </div>
        </header>
        {children}
      </main>
    </>
  );
}

export function WebState({ action, detail, kind = "status", session, title }) {
  const { language } = useUiLocale();
  const copy = FRAME_COPY[language] || FRAME_COPY.es;
  return (
    <WebPageFrame csrfToken={session?.csrfToken} user={session?.user}>
      <div className="web-state-layout">
        <section
          aria-busy={kind === "loading" ? "true" : undefined}
          aria-live="polite"
          className="web-state-card"
          role={kind === "error" ? "alert" : "status"}
        >
          {kind === "loading" ? <span aria-hidden="true" className="web-loading-dot" /> : null}
          <p className="web-eyebrow">{kind === "error" ? copy.errorEyebrow : "Sendero"}</p>
          <h1>{title}</h1>
          {detail ? <p>{detail}</p> : null}
          {action ? <div className="web-actions">{action}</div> : null}
        </section>
      </div>
    </WebPageFrame>
  );
}
