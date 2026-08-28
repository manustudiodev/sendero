import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const componentPath = new URL("./src/share-control/PublicShareControlApp.jsx", import.meta.url);

test("the final public-share receipt offers only direct copy and open actions", async () => {
  const source = await readFile(componentPath, "utf8");
  const start = source.indexOf("if (hasPublicShareResultActions(output))");
  const end = source.indexOf("\n  return (", start);

  assert.notEqual(start, -1, "the final-result receipt branch must exist");
  assert.notEqual(end, -1, "the final-result receipt branch must be bounded");
  const receipt = source.slice(start, end);

  assert.match(source, /copy: "Copiar enlace", open: "Abrir"/);
  assert.match(receipt, />\{copy\.copy\}<\/Button>/);
  assert.match(receipt, />\{copy\.open\} <span/);
  assert.match(receipt, /copyLink/);
  assert.match(receipt, /openExternal\(publicUrl\)/);
  assert.doesNotMatch(
    receipt,
    /continueConversation|sendFollowUpMessage|sendMessage|launchConversation|Solicitud recibida/i,
  );
});
