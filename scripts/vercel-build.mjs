import { spawn } from "node:child_process";
import { resolve } from "node:path";

const vercelEnvironment = process.env.VERCEL_ENV;
if (process.env.VERCEL !== "1" || !["preview", "production"].includes(vercelEnvironment)) {
  console.error("build:vercel is guarded and may run only inside a Vercel Preview or Production build.");
  process.exit(1);
}
if (!process.env.CONVEX_DEPLOY_KEY?.trim()) {
  console.error(`CONVEX_DEPLOY_KEY is required for the Vercel ${vercelEnvironment} build.`);
  process.exit(1);
}

const convexExecutable = resolve("node_modules/.bin/convex");
const child = spawn(convexExecutable, ["deploy", "--cmd", "npm run build"], {
  env: process.env,
  stdio: "inherit",
});

child.once("error", (error) => {
  console.error(`Unable to start Convex deployment: ${error.message}`);
  process.exit(1);
});
child.once("exit", (code, signal) => {
  if (signal) {
    console.error(`Convex deployment stopped with signal ${signal}.`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
