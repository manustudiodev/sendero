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
