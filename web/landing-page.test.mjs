import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import test from "node:test";

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
  assert.match(pages.landingPageHtml, /Un viaje que se construye hablando\./);
  assert.match(pages.landingPageHtml, /Saltar al contenido/);
  assert.match(pages.landingPageHtml, /href:"\/app"/);
  assert.match(pages.landingPageHtml, /children:"Mis viajes"/);
  assert.match(pages.landingPageHtml, /Abrir mis viajes/);
  assert.match(pages.landingPageHtml, /No guarda datos ni realiza reservas\./);

  assert.match(pages.privacyPageHtml, /<title>Privacidad · Sendero<\/title>/);
  assert.match(pages.privacyPageHtml, /rel="canonical" href="https:\/\/sendero\.example\/privacy"/);
  assert.match(pages.privacyPageHtml, /proveedor de acceso/);

  assert.match(pages.termsPageHtml, /<title>Términos · Sendero<\/title>/);
  assert.match(pages.termsPageHtml, /rel="canonical" href="https:\/\/sendero\.example\/terms"/);
  assert.match(pages.termsPageHtml, /Sendero no es una agencia de viajes/);

  assert.match(pages.publicSharePageHtml, /name="robots" content="noindex,nofollow,noarchive"/);
  assert.doesNotMatch(pages.itineraryWidgetHtml, /sendero-chatgpt-url/);
});

test("public site styles include responsive and dark color-scheme contracts", async () => {
  const styles = await readFile(resolve(projectRoot, "web/src/styles.css"), "utf8");
  assert.match(styles, /html\.site-document/);
  assert.match(styles, /@media \(prefers-color-scheme: dark\)/);
  assert.match(styles, /@media \(max-width: 820px\)/);
  assert.match(styles, /font: 16px\/1\.55 Inter/);
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
