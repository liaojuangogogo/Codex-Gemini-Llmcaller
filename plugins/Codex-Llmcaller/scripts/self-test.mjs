#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { callModel } from "./server.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = resolve(SCRIPT_DIR, "..");
const REPO_ROOT = resolve(PLUGIN_ROOT, "..", "..");
const DEFAULT_USER_SECRETS_PATH = resolve(os.homedir(), "plugins", "Codex-Llmcaller", ".data", "secrets.json");

function runNode(args, label) {
  const result = spawnSync(process.execPath, args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    windowsHide: true
  });

  if (result.error || result.status !== 0) {
    throw new Error(`${label} failed.\n${result.error?.message ?? ""}\n${result.stdout ?? ""}${result.stderr ?? ""}`);
  }

  if (result.stdout.trim()) {
    console.log(result.stdout.trim());
  }
}

function assertJson(path) {
  JSON.parse(readFileSync(path, "utf8"));
}

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = value;
    index += 1;
  }

  return args;
}

async function runRealProfile(profileName) {
  const result = await callModel({
    profileName,
    prompt: "Only output OK."
  });

  if (!result.text || !result.text.trim()) {
    throw new Error(`Real profile '${profileName}' call returned empty text.`);
  }
  const serialized = JSON.stringify(result);
  if (/AIza[0-9A-Za-z_-]{20,}|sk-[0-9A-Za-z_-]{20,}/.test(serialized)) {
    throw new Error("Real model result included a plaintext API key.");
  }

  console.log(`Real profile '${profileName}' call passed.`);
  console.log(result.text.trim());
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const realProfile = typeof args["real-profile"] === "string"
    ? args["real-profile"]
    : args["real-gemini"] ? "gemini-default" : null;

  for (const script of [
    "plugins/Codex-Llmcaller/scripts/server.mjs",
    "plugins/Codex-Llmcaller/scripts/server.test.mjs",
    "plugins/Codex-Llmcaller/scripts/provider-registry.mjs",
    "plugins/Codex-Llmcaller/scripts/call-model-local.mjs",
    "plugins/Codex-Llmcaller/scripts/secret-import.mjs",
    "plugins/Codex-Llmcaller/scripts/secret-migrate-local-user.mjs",
    "plugins/Codex-Llmcaller/scripts/check-env.mjs",
    "plugins/Codex-Llmcaller/scripts/mcp-smoke.mjs",
    "plugins/Codex-Llmcaller/scripts/release-check.mjs",
    "plugins/Codex-Llmcaller/scripts/self-test.mjs",
    "setup.mjs"
  ]) {
    runNode(["--check", script], `Syntax check ${script}`);
  }

  for (const jsonFile of [
    ".agents/plugins/marketplace.json",
    "plugins/Codex-Llmcaller/.codex-plugin/plugin.json",
    "plugins/Codex-Llmcaller/.mcp.json"
  ]) {
    assertJson(resolve(REPO_ROOT, jsonFile));
  }

  runNode(["plugins/Codex-Llmcaller/scripts/mcp-smoke.mjs"], "MCP smoke");
  runNode(["plugins/Codex-Llmcaller/scripts/server.test.mjs"], "Server tests");
  runNode(["plugins/Codex-Llmcaller/scripts/release-check.mjs"], "Release check");

  if (realProfile) {
    if (!existsSync(DEFAULT_USER_SECRETS_PATH)) {
      throw new Error("Real model test requires installed secrets in $HOME/plugins/Codex-Llmcaller/.data/secrets.json.");
    }
    await runRealProfile(realProfile);
  }

  console.log("Self-test passed.");
}

main().catch((error) => {
  console.error(`Self-test failed: ${error.message}`);
  process.exitCode = 1;
});
