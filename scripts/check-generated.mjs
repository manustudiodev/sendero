import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const temporaryDirectory = await mkdtemp(join(tmpdir(), "sendero-generated-"));
const temporaryOutput = join(temporaryDirectory, "widgets.mjs");

try {
  await run(process.execPath, ["web/build.mjs"], {
    ...process.env,
    SENDERO_UI_OUTPUT_PATH: temporaryOutput,
  });
  const [expected, actual] = await Promise.all([
    readFile(resolve("server/ui/generated/widgets.mjs"), "utf8"),
    readFile(temporaryOutput, "utf8"),
  ]);
  if (actual !== expected) {
    console.error("Generated Sendero UI is stale. Run `npm run build:ui` and include the result.");
    process.exitCode = 1;
  } else {
    console.log("Generated Sendero UI matches the current sources.");
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

function run(command, args, env) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { env, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} failed with ${signal ? `signal ${signal}` : `exit code ${code}`}.`));
    });
  });
}
