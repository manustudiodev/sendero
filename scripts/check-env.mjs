import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { deploymentProfiles, environmentVariables } from "../config/environment.mjs";

const args = process.argv.slice(2);
const exampleMode = args.includes("--example");
const profile = valueAfter("--profile") || (exampleMode ? "local" : "local");
const envFile = valueAfter("--env-file");
const target = valueAfter("--target") || "runtime";

if (!deploymentProfiles.includes(profile)) {
  fail(`Unknown profile \"${profile}\". Expected one of: ${deploymentProfiles.join(", ")}.`);
}
if (!['runtime', 'convex'].includes(target)) {
  fail(`Unknown target \"${target}\". Expected runtime or convex.`);
}

const values = envFile ? parseEnv(await readFile(resolve(envFile), "utf8")) : { ...process.env };
const failures = [];
const warnings = [];

if (exampleMode) {
  const example = parseEnv(await readFile(resolve(".env.example"), "utf8"));
  for (const variable of environmentVariables) {
    if (!(variable.name in example)) failures.push(`.env.example is missing ${variable.name}.`);
    if (variable.kind === "secret" && example[variable.name]) {
      failures.push(`.env.example must not contain a value for secret ${variable.name}.`);
    }
  }
  const knownNames = new Set(environmentVariables.map(({ name }) => name));
  for (const name of Object.keys(example)) {
    if (!knownNames.has(name)) warnings.push(`.env.example contains undocumented variable ${name}.`);
  }
} else {
  for (const variable of environmentVariables) {
    const value = String(values[variable.name] || "").trim();
    const requiredIn = target === "convex" ? variable.convexRequiredIn : variable.requiredIn;
    const recommendedIn = target === "convex" ? variable.convexRecommendedIn : variable.recommendedIn;
    if (requiredIn?.includes(profile) && !value) {
      failures.push(`${variable.name} is required for ${profile} ${target}.`);
      continue;
    }
    if (recommendedIn?.includes(profile) && !value) {
      warnings.push(`${variable.name} is recommended for ${profile} ${target}.`);
      continue;
    }
    if (!value) continue;
    if (variable.kind === "url") validateUrl(variable.name, value, profile, failures);
    if (variable.allowedValues && !variable.allowedValues.includes(value)) {
      failures.push(`${variable.name} must be one of: ${variable.allowedValues.join(", ")}.`);
    }
    if (variable.minBytes && Buffer.byteLength(value, "utf8") < variable.minBytes) {
      failures.push(`${variable.name} must contain at least ${variable.minBytes} bytes.`);
    }
  }
}

for (const warning of warnings) console.warn(`warning: ${warning}`);
if (failures.length) fail(failures.join("\n"));
console.log(exampleMode
  ? `Environment example covers ${environmentVariables.length} documented variables without embedded secrets.`
  : `Environment values satisfy the ${profile} ${target} profile (${warnings.length} warning(s)).`);

function valueAfter(flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : "";
}

function parseEnv(source) {
  const result = {};
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const name = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[name] = value;
  }
  return result;
}

function validateUrl(name, value, environment, errors) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) errors.push(`${name} must use HTTP or HTTPS.`);
    if (environment !== "local" && url.protocol !== "https:") errors.push(`${name} must use HTTPS in ${environment}.`);
    if (url.username || url.password) errors.push(`${name} must not include credentials.`);
  } catch {
    errors.push(`${name} must be an absolute URL.`);
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
