import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
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

test("build exports self-contained account, invitation, and restricted-trip pages", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "sendero-authenticated-pages-"));
  const outputPath = join(directory, "widgets.mjs");
  t.after(() => rm(directory, { force: true, recursive: true }));

  await runBuild(outputPath);
  const pages = await import(`${pathToFileURL(outputPath).href}?test=${Date.now()}`);
  const expected = [
    [pages.accountPageHtml, "Tus viajes · Sendero"],
    [pages.invitePageHtml, "Invitación · Sendero"],
    [pages.restrictedTripPageHtml, "Itinerario privado · Sendero"],
  ];

  for (const [html, title] of expected) {
    assert.match(html, /<!doctype html>/);
    assert.match(html, /<html class="web-document" lang="es">/);
    assert.match(html, new RegExp(`<title>${title}<\\/title>`));
    assert.match(html, /name="robots" content="noindex,nofollow,noarchive"/);
    assert.match(html, /name="sendero-chatgpt-url" content="https:\/\/chatgpt\.com\/g\/g-sendero"/);
    assert.doesNotMatch(html, /rel="canonical"/);
  }

  assert.match(pages.accountPageHtml, /api\/session/);
  assert.match(pages.accountPageHtml, /api\/trips/);
  assert.match(pages.invitePageHtml, /api\/invitations\/inspect/);
  assert.match(pages.restrictedTripPageHtml, /reservations\/status/);
});
