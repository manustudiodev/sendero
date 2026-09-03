import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("places lodging search on a full row while pace keeps one column", async () => {
  const source = await readFile(new URL("./src/generate/GenerateTripApp.jsx", import.meta.url), "utf8");
  const nameIndex = source.indexOf('name="lodging-address-search"');
  const startIndex = source.lastIndexOf("<DestinationCombobox", nameIndex);
  const endIndex = source.indexOf("/>", nameIndex);
  const lodgingSearch = source.slice(startIndex, endIndex + 2);

  assert.ok(nameIndex > -1 && startIndex > -1 && endIndex > -1, "expected the lodging address combobox");
  assert.match(lodgingSearch, /\n\s+wide\n/);
  assert.match(source, /<label className="generate-field"><span>\{copy\.pace\}<\/span>/);
  assert.doesNotMatch(source, /<label className="generate-field generate-field-wide"><span>\{copy\.pace\}<\/span>/);
});

test("keeps authentication in the top bar and exposes the WebMCP command disclosure in the former action area", async () => {
  const source = await readFile(new URL("./src/generate/GenerateTripApp.jsx", import.meta.url), "utf8");

  assert.match(source, /signIn: "Ingresar"/);
  assert.match(source, /const topbarAction = page\.session\.authenticated/);
  assert.match(source, /<WebPageFrame[\s\S]{0,180}?topbarAction=\{topbarAction\}/);
  assert.match(source, /<details className=\{`generate-webmcp is-\$\{model\.state\}`\} data-webmcp-indicator>/);
  assert.match(source, /<WebMcpIndicator language=\{language\} status=\{generationStatus\} \/>/);
  assert.doesNotMatch(source, /<div className="web-actions">[\s\S]{0,250}?copy\.signIn/);
});

test("uses a concise localized label for the prompt generation action", async () => {
  const source = await readFile(new URL("./src/generate/GenerateTripApp.jsx", import.meta.url), "utf8");

  assert.match(source, /prepare: "Generate prompt"/);
  assert.match(source, /prepare: "Generar prompt"/);
  assert.match(source, /prepare: "Gerar prompt"/);
  assert.match(source, /prepare: "Générer le prompt"/);
  assert.match(source, /prepare: "Prompt generieren"/);
  assert.doesNotMatch(source, /prepare: "Crear prompt para ChatGPT"/);
});
