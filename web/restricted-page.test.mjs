import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const restrictedSource = readFileSync(new URL("./src/restricted/RestrictedTripApp.jsx", import.meta.url), "utf8");
const accessSource = readFileSync(new URL("./src/restricted/AccessPanel.jsx", import.meta.url), "utf8");

test("restricted page embeds the canonical viewer without an editor", () => {
  assert.match(restrictedSource, /<ItineraryViewer/);
  assert.match(restrictedSource, /variant="restricted"/);
  assert.doesNotMatch(restrictedSource, /ItineraryEditor|contentEditable/);
});

test("restricted viewer owns an accessible light and dark color theme", () => {
  assert.match(restrictedSource, /\.restricted-viewer \.itinerary-viewer\s*\{[\s\S]*background:\s*var\(--surface\);[\s\S]*color:\s*var\(--ink\);/);
  assert.match(restrictedSource, /@media \(prefers-color-scheme: dark\)\s*\{[\s\S]*\.restricted-viewer \.itinerary-viewer\s*\{[\s\S]*--ink:\s*#f2f2ef;/);
  assert.match(restrictedSource, /@media \(prefers-color-scheme: dark\)\s*\{[\s\S]*\.restricted-viewer \.itinerary-viewer\s*\{[\s\S]*--surface:\s*#20201e;/);
});

test("restricted page uses BFF routes and guards writable reservations", () => {
  assert.match(restrictedSource, /\/api\/session/);
  assert.match(restrictedSource, /\/api\/trips\/\$\{encodeURIComponent\(webId\)\}/);
  assert.match(restrictedSource, /\/reservations\/status/);
  assert.match(restrictedSource, /reservationWritable=\{trip\.permissions\.updateReservationStatus\}/);
  assert.match(restrictedSource, /latestStateRef\.current/);
  assert.match(restrictedSource, /reservationOperations\.current\.begin\(/);
  assert.match(restrictedSource, /expectedVersion:\s*reservationOperation\.expectedVersion/);
  assert.match(restrictedSource, /operationId:\s*reservationOperation\.operationId/);
  assert.match(restrictedSource, /reservationOperations\.current\.clear\(operationKey\)/);
});

test("access panel exposes invitation and membership BFF contracts", () => {
  assert.match(accessSource, /\/access/);
  assert.match(accessSource, /\/invitations/);
  assert.match(accessSource, /\/resend/);
  assert.match(accessSource, /method:\s*"PATCH"/);
  assert.match(accessSource, /method:\s*"DELETE"/);
  assert.match(accessSource, /X-CSRF-Token|csrfToken/);
});

test("destructive sharing changes require contextual confirmation", () => {
  assert.match(accessSource, /role="alertdialog"/);
  assert.match(accessSource, /restrictTitle: "¿Restringir este viaje\?"/);
  assert.match(accessSource, /replaceTitle: "¿Crear un enlace público nuevo\?"/);
  assert.match(accessSource, /removeTitle: \(name\) => `¿Quitar a \$\{name\}\?`/);
  assert.match(accessSource, /revokeTitle: \(email\) => `¿Revocar la invitación de \$\{email\}\?`/);
  assert.match(accessSource, /migrateTitle: \(email\) => `¿Migrar la invitación de \$\{email\}\?`/);
  assert.match(accessSource, /deleteTitle: \(email\) => `¿Eliminar la invitación antigua de \$\{email\}\?`/);
  assert.match(accessSource, /title: copy\.removeTitle\(member\.name \|\| member\.email\)/);
  assert.match(accessSource, /title: copy\.revokeTitle\(invitation\.email\)/);
  assert.match(accessSource, /title: copy\.migrateTitle\(invitation\.email\)/);
  assert.match(accessSource, /title: copy\.deleteTitle\(invitation\.email\)/);
  assert.match(accessSource, /cancel: "Cancelar"/);
});

test("access UI distinguishes invitation lifecycle and delivery", () => {
  assert.match(accessSource, /Vencida/);
  assert.match(accessSource, /Pendiente/);
  assert.match(accessSource, /Aceptada por correo/);
  assert.match(accessSource, /Reintentando/);
  assert.match(accessSource, /Correo no configurado/);
  assert.match(accessSource, /quedó en cola de envío/);
  assert.doesNotMatch(accessSource, /Comparte el enlace manualmente/);
});

test("owners can explicitly recover or remove non-access-bearing legacy invitations", () => {
  assert.match(accessSource, /Invitaciones antiguas/);
  assert.match(accessSource, /Estos registros pendientes no otorgan acceso/);
  assert.match(accessSource, /legacy-invitations\/\$\{encodeURIComponent\(invitation\.id\)\}\/migrate/);
  assert.match(accessSource, /legacy-invitations\/\$\{encodeURIComponent\(invitation\.id\)\}`/);
  assert.match(accessSource, /method:\s*"DELETE"/);
  assert.match(accessSource, /migrate: "Migrar y enviar"/);
  assert.match(accessSource, /delete: "Eliminar"/);
  assert.match(accessSource, />\{copy\.migrate\}<\/WebButton>/);
  assert.match(accessSource, />\{copy\.delete\}<\/WebButton>/);
  assert.match(accessSource, /legacyMigrationNotice\(result\.delivery, invitation\.email, copy\)/);
  assert.match(accessSource, /await load\(\)/);
});

test("editable restricted trips can continue in configured ChatGPT surface", () => {
  assert.match(restrictedSource, /sendero-chatgpt-url/);
  assert.match(restrictedSource, /trip\.permissions\.editInSendero/);
  assert.match(restrictedSource, /Continuar este viaje en ChatGPT/);
});
