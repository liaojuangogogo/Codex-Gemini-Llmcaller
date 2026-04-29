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
const DEFAULT_USER_SECRETS_PATH = resolve(os.homedir(), "plugins", "Codex-Gemini-Llmcaller", ".data", "secrets.json");

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

async function runRealGemini() {
  const result = await callModel({
    prompt: "Only output OK."
  });

  if (!result.text || !result.text.trim()) {
    throw new Error("Real Gemini call returned empty text.");
  }
  const serialized = JSON.stringify(result);
  if (/AIza[0-9A-Za-z_-]{20,}/.test(serialized)) {
    throw new Error("Real Gemini result included a plaintext Google API key.");
  }

  console.log("Real Gemini call passed.");
  console.log(result.text.trim());
}

async function main() {
  const realGemini = process.argv.includes("--real-gemini");

  for (const script of [
    "plugins/Codex-Gemini-Llmcaller/scripts/server.mjs",
    "plugins/Codex-Gemini-Llmcaller/scripts/server.test.mjs",
    "plugins/Codex-Gemini-Llmcaller/scripts/secret-import.mjs",
    "plugins/Codex-Gemini-Llmcaller/scripts/secret-migrate-local-user.mjs",
    "plugins/Codex-Gemini-Llmcaller/scripts/check-env.mjs",
    "plugins/Codex-Gemini-Llmcaller/scripts/mcp-smoke.mjs",
    "plugins/Codex-Gemini-Llmcaller/scripts/release-check.mjs",
    "plugins/Codex-Gemini-Llmcaller/scripts/self-test.mjs",
    "setup.mjs"
  ]) {
    runNode(["--check", script], `Syntax check ${script}`);
  }

  for (const jsonFile of [
    ".agents/plugins/marketplace.json",
    "plugins/Codex-Gemini-Llmcaller/.codex-plugin/plugin.json",
    "plugins/Codex-Gemini-Llmcaller/.mcp.json"
  ]) {
    assertJson(resolve(REPO_ROOT, jsonFile));
  }

  runNode(["plugins/Codex-Gemini-Llmcaller/scripts/mcp-smoke.mjs"], "MCP smoke");
  runNode(["plugins/Codex-Gemini-Llmcaller/scripts/server.test.mjs"], "Server tests");
  runNode(["plugins/Codex-Gemini-Llmcaller/scripts/release-check.mjs"], "Release check");

  if (realGemini) {
    if (!existsSync(DEFAULT_USER_SECRETS_PATH)) {
      throw new Error("Real Gemini test requires an installed gemini-default secret in $HOME/plugins/Codex-Gemini-Llmcaller/.data/secrets.json.");
    }
    await runRealGemini();
  }

  console.log("Self-test passed.");
}

main().catch((error) => {
  console.error(`Self-test failed: ${error.message}`);
  process.exitCode = 1;
});
