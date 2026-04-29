#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PLUGIN_NAME = "Codex-Gemini-Llmcaller";
const LEGACY_PLUGIN_NAME = "multi-model-api";
const MARKETPLACE_NAME = "codex-gemini-llmcaller-local";
const MARKETPLACE_DISPLAY_NAME = "Codex-Gemini-Llmcaller Local Plugins";
const DEFAULT_MODEL = "gemini-3-flash-preview";
const MIN_NODE_MAJOR = 18;
const REPO_ROOT = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_PLUGIN_DIR = path.join(REPO_ROOT, "plugins", PLUGIN_NAME);

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const withoutPrefix = token.slice(2);
    const equalIndex = withoutPrefix.indexOf("=");
    const key = equalIndex === -1 ? withoutPrefix : withoutPrefix.slice(0, equalIndex);
    const value = equalIndex === -1 ? argv[index + 1] : withoutPrefix.slice(equalIndex + 1);

    if (equalIndex === -1) {
      if (value === undefined || value.startsWith("--")) {
        args[toCamelCase(key)] = true;
        continue;
      }
      index += 1;
    }

    args[toCamelCase(key)] = value;
  }

  return args;
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function printHelp() {
  console.log(`Usage:
  node ./setup.mjs [options]

Options:
  --api-key-env GEMINI_API_KEY       Read the Gemini API key from a local environment variable.
  --model gemini-3-flash-preview     Gemini model for the default profile.
  --profile gemini-default           Secret/profile name to create and set as default.
  --plugin-target-dir <path>         Override the user-level plugin install directory.
  --marketplace-path <path>          Override the user-level marketplace path.
  --check-only                       Check Node, Windows, PowerShell, and writable paths only.
  --yes                              Skip interactive confirmation prompts.

Default install target:
  path.join(os.homedir(), "plugins", "Codex-Gemini-Llmcaller")

Default encrypted data target:
  path.join(os.homedir(), "plugins", "Codex-Gemini-Llmcaller", ".data")

Default marketplace target:
  path.join(os.homedir(), ".agents", "plugins", "marketplace.json")`);
}

function expandTilde(filePath) {
  if (typeof filePath !== "string" || !filePath) {
    return filePath;
  }
  if (filePath === "~") {
    return os.homedir();
  }
  if (filePath.startsWith("~/") || filePath.startsWith("~\\")) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

function defaultPluginTargetDir() {
  return path.join(os.homedir(), "plugins", PLUGIN_NAME);
}

function defaultPluginDataDir() {
  return path.join(defaultPluginTargetDir(), ".data");
}

function defaultMarketplacePath() {
  return path.join(os.homedir(), ".agents", "plugins", "marketplace.json");
}

function defaultPluginCacheDir() {
  return path.join(os.homedir(), ".codex", "plugins", "cache", MARKETPLACE_NAME, PLUGIN_NAME);
}

function resolveInstallOptions(args) {
  return {
    profile: typeof args.profile === "string" && args.profile.trim() ? args.profile.trim() : "gemini-default",
    model: typeof args.model === "string" && args.model.trim() ? args.model.trim() : DEFAULT_MODEL,
    apiKeyEnv: typeof args.apiKeyEnv === "string" && args.apiKeyEnv.trim() ? args.apiKeyEnv.trim() : null,
    pluginTargetDir: path.resolve(expandTilde(args.pluginTargetDir) || defaultPluginTargetDir()),
    marketplacePath: path.resolve(expandTilde(args.marketplacePath) || defaultMarketplacePath()),
    checkOnly: args.checkOnly === true,
    yes: args.yes === true
  };
}

function checkNodeVersion() {
  const major = Number.parseInt(process.versions.node.split(".")[0], 10);
  if (!Number.isInteger(major) || major < MIN_NODE_MAJOR) {
    throw new Error(`Node.js ${MIN_NODE_MAJOR} or newer is required. Current version: ${process.version}`);
  }
}

function checkWindows() {
  if (process.platform !== "win32") {
    throw new Error("This one-step setup currently supports Windows only. Use passphrase mode manually on other platforms.");
  }
}

function checkPowerShell() {
  const result = spawnSync("powershell.exe", [
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    "$PSVersionTable.PSVersion.ToString()"
  ], {
    encoding: "utf8",
    windowsHide: true
  });

  if (result.error || result.status !== 0) {
    throw new Error("Windows PowerShell is required but was not available.");
  }

  return result.stdout.trim();
}

function ensureSourcePluginExists() {
  if (!existsSync(path.join(SOURCE_PLUGIN_DIR, ".codex-plugin", "plugin.json"))) {
    throw new Error("Could not find ./plugins/Codex-Gemini-Llmcaller/.codex-plugin/plugin.json. Run setup from the repository root.");
  }
}

function assertSafeTarget(sourceDir, targetDir) {
  const source = path.resolve(sourceDir);
  const target = path.resolve(targetDir);

  if (source === target) {
    throw new Error("The plugin target directory must not be the source plugin directory.");
  }
  if (source.startsWith(`${target}${path.sep}`)) {
    throw new Error("The plugin target directory must not contain the source repository.");
  }
}

function probeWritableDirectory(directory) {
  mkdirSync(directory, { recursive: true });
  const probePath = path.join(directory, `.codex-gemini-llmcaller-write-test-${process.pid}-${Date.now()}`);
  writeFileSync(probePath, "ok", "utf8");
  rmSync(probePath, { force: true });
}

function checkWritableTargets(options) {
  probeWritableDirectory(options.pluginTargetDir);
  probeWritableDirectory(defaultPluginDataDir());
  probeWritableDirectory(path.dirname(options.marketplacePath));
}

async function promptHidden(label) {
  if (!process.stdin.isTTY || !process.stdout.isTTY || typeof process.stdin.setRawMode !== "function") {
    throw new Error(`${label} requires an interactive terminal. Use --api-key-env with a local environment variable for non-interactive setup.`);
  }

  return new Promise((resolve, reject) => {
    let value = "";
    const stdin = process.stdin;
    const stdout = process.stdout;

    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off("data", onData);
    };

    const onData = (chunk) => {
      const text = chunk.toString("utf8");

      for (const char of text) {
        if (char === "\u0003") {
          cleanup();
          stdout.write("\n");
          reject(new Error("Cancelled."));
          return;
        }
        if (char === "\r" || char === "\n") {
          cleanup();
          stdout.write("\n");
          resolve(value);
          return;
        }
        if (char === "\u0008" || char === "\u007f") {
          value = value.slice(0, -1);
          continue;
        }
        value += char;
      }
    };

    stdout.write(label);
    stdin.resume();
    stdin.setRawMode(true);
    stdin.on("data", onData);
  });
}

async function promptLine(label) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return "";
  }

  return new Promise((resolve) => {
    let value = "";
    const stdin = process.stdin;
    const stdout = process.stdout;

    const cleanup = () => {
      stdin.pause();
      stdin.off("data", onData);
    };

    const onData = (chunk) => {
      const text = chunk.toString("utf8");

      for (const char of text) {
        if (char === "\r" || char === "\n") {
          cleanup();
          stdout.write("\n");
          resolve(value);
          return;
        }
        value += char;
      }
    };

    stdout.write(label);
    stdin.resume();
    stdin.on("data", onData);
  });
}

async function confirmInstall(options) {
  if (options.yes) {
    return;
  }

  console.log("Before continuing, fully quit Codex Desktop so plugin files are not locked.");
  console.log("Make sure Codex Desktop has full access permission for the local project/plugin directories.");
  console.log(`Plugin install target: ${options.pluginTargetDir}`);
  console.log(`Marketplace target: ${options.marketplacePath}`);
  const answer = await promptLine("Continue? [y/N] ");
  if (!/^y(es)?$/i.test(answer.trim())) {
    throw new Error("Setup cancelled.");
  }
}

async function readApiKey(options) {
  if (options.apiKeyEnv) {
    const value = process.env[options.apiKeyEnv];
    if (!value || !value.trim()) {
      throw new Error(`Environment variable ${options.apiKeyEnv} is not set.`);
    }
    return value.trim();
  }

  const value = await promptHidden("Gemini API key: ");
  if (!value.trim()) {
    throw new Error("API key cannot be empty.");
  }
  return value.trim();
}

function copyPluginSource(sourceDir, targetDir) {
  mkdirSync(targetDir, { recursive: true });

  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    if (entry.name === ".data") {
      continue;
    }

    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      copyPluginSource(sourcePath, targetPath);
      continue;
    }
    if (entry.isFile()) {
      mkdirSync(path.dirname(targetPath), { recursive: true });
      copyFileSync(sourcePath, targetPath);
    }
  }
}

function copyDirectoryContents(sourceDir, targetDir) {
  mkdirSync(targetDir, { recursive: true });

  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryContents(sourcePath, targetPath);
      continue;
    }
    if (entry.isFile()) {
      mkdirSync(path.dirname(targetPath), { recursive: true });
      copyFileSync(sourcePath, targetPath);
    }
  }
}

function cleanTargetExceptData(targetDir) {
  if (!existsSync(targetDir)) {
    return;
  }

  for (const entry of readdirSync(targetDir, { withFileTypes: true })) {
    if (entry.name === ".data") {
      continue;
    }

    rmSync(path.join(targetDir, entry.name), {
      recursive: true,
      force: true
    });
  }
}

function migrateLegacyDataIfNeeded(options) {
  const targetDataDir = defaultPluginDataDir();
  const legacyDataDir = path.join(os.homedir(), "plugins", LEGACY_PLUGIN_NAME, ".data");

  if (existsSync(targetDataDir) || !existsSync(legacyDataDir)) {
    return false;
  }

  copyDirectoryContents(legacyDataDir, targetDataDir);
  return true;
}

function writeInstalledMcpConfig(options) {
  const targetMcpPath = path.join(options.pluginTargetDir, ".mcp.json");
  const targetServerPath = path.join(options.pluginTargetDir, "scripts", "server.mjs");
  const config = {
    mcpServers: {
      [PLUGIN_NAME]: {
        command: process.execPath,
        args: [targetServerPath]
      }
    }
  };

  writeFileSync(targetMcpPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

async function loadInstalledServer(options) {
  const targetServerPath = path.join(options.pluginTargetDir, "scripts", "server.mjs");
  return import(`${pathToFileURL(targetServerPath).href}?setup=${Date.now()}`);
}

async function hasDecryptableSecret(server, profileName) {
  try {
    const result = await server.handleToolCall({
      name: "secret_get",
      arguments: {
        name: profileName
      }
    });
    return result.structuredContent?.canDecrypt === true;
  } catch {
    return false;
  }
}

async function writeSecret(server, options, apiKey) {
  await server.handleToolCall({
    name: "secret_set",
    arguments: {
      name: options.profile,
      apiKey,
      protection: "local-user",
      provider: "google",
      model: options.model,
      overwrite: true
    }
  });
}

async function writeProfile(server, options) {
  await server.handleToolCall({
    name: "profile_set",
    arguments: {
      name: options.profile,
      provider: "google",
      model: options.model,
      secretName: options.profile,
      timeoutMs: 120000,
      thinkingLevel: "low",
      autoContinue: true,
      maxContinuationRounds: 2,
      setDefault: true
    }
  });
}

function readMarketplace(marketplacePath) {
  if (!existsSync(marketplacePath)) {
    return {
      name: MARKETPLACE_NAME,
      interface: {
        displayName: MARKETPLACE_DISPLAY_NAME
      },
      plugins: []
    };
  }

  const backupPath = `${marketplacePath}.bak`;
  copyFileSync(marketplacePath, backupPath);

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(marketplacePath, "utf8"));
  } catch (error) {
    throw new Error(`Could not parse existing marketplace.json. A backup was saved to ${backupPath}. Fix the JSON manually and rerun setup. ${error.message}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Existing marketplace.json must contain a JSON object.");
  }
  if (!parsed.name) {
    parsed.name = MARKETPLACE_NAME;
  }
  if (!parsed.interface || typeof parsed.interface !== "object" || Array.isArray(parsed.interface)) {
    parsed.interface = { displayName: MARKETPLACE_DISPLAY_NAME };
  }
  if (["Local User Plugins", "CheckWithModel Local Plugins"].includes(parsed.interface.displayName)) {
    parsed.interface.displayName = MARKETPLACE_DISPLAY_NAME;
  }
  if (!Array.isArray(parsed.plugins)) {
    if (parsed.plugins === undefined) {
      parsed.plugins = [];
    } else {
      throw new Error("Existing marketplace.json has a non-array plugins field. Fix it manually and rerun setup.");
    }
  }

  return parsed;
}

function writeMarketplace(options) {
  mkdirSync(path.dirname(options.marketplacePath), { recursive: true });
  const marketplace = readMarketplace(options.marketplacePath);
  const entry = {
    name: PLUGIN_NAME,
    source: {
      source: "local",
      path: options.pluginTargetDir
    },
    policy: {
      installation: "AVAILABLE",
      authentication: "ON_INSTALL"
    },
    category: "Productivity"
  };
  marketplace.plugins = marketplace.plugins.filter((plugin) => plugin?.name !== LEGACY_PLUGIN_NAME);
  const existingIndex = marketplace.plugins.findIndex((plugin) => plugin?.name === PLUGIN_NAME);

  if (existingIndex === -1) {
    marketplace.plugins.push(entry);
  } else {
    marketplace.plugins[existingIndex] = entry;
  }

  const tempPath = `${options.marketplacePath}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(marketplace, null, 2)}\n`, "utf8");
  renameSync(tempPath, options.marketplacePath);
}

function clearPluginCache() {
  const cacheDir = defaultPluginCacheDir();

  if (!existsSync(cacheDir)) {
    return false;
  }

  rmSync(cacheDir, {
    recursive: true,
    force: true
  });
  return true;
}

function isBusyError(error) {
  return ["EBUSY", "EPERM", "EACCES"].includes(error?.code);
}

function printEnvironmentSummary(options, powerShellVersion) {
  console.log(`Node.js: ${process.version}`);
  console.log(`PowerShell: ${powerShellVersion}`);
  console.log(`Source plugin: ${path.relative(REPO_ROOT, SOURCE_PLUGIN_DIR)}`);
  console.log(`Plugin target: ${options.pluginTargetDir}`);
  console.log(`Plugin data: ${defaultPluginDataDir()}`);
  console.log(`Plugin cache: ${defaultPluginCacheDir()}`);
  console.log(`Marketplace: ${options.marketplacePath}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const options = resolveInstallOptions(args);
  checkNodeVersion();
  checkWindows();
  ensureSourcePluginExists();
  assertSafeTarget(SOURCE_PLUGIN_DIR, options.pluginTargetDir);
  const powerShellVersion = checkPowerShell();
  printEnvironmentSummary(options, powerShellVersion);

  if (options.checkOnly) {
    checkWritableTargets(options);
    console.log("Environment check passed.");
    return;
  }

  await confirmInstall(options);
  checkWritableTargets(options);
  cleanTargetExceptData(options.pluginTargetDir);
  copyPluginSource(SOURCE_PLUGIN_DIR, options.pluginTargetDir);
  writeInstalledMcpConfig(options);
  const migratedLegacyData = migrateLegacyDataIfNeeded(options);
  const server = await loadInstalledServer(options);
  const canReuseSecret = !options.apiKeyEnv && await hasDecryptableSecret(server, options.profile);

  if (migratedLegacyData) {
    console.log(`Migrated existing encrypted data from ${path.join(os.homedir(), "plugins", LEGACY_PLUGIN_NAME, ".data")}.`);
  }

  if (canReuseSecret) {
    console.log(`Existing decryptable secret '${options.profile}' found; skipping API key input.`);
  } else {
    const apiKey = await readApiKey(options);
    await writeSecret(server, options, apiKey);
  }

  await writeProfile(server, options);
  writeMarketplace(options);
  const cacheCleared = clearPluginCache();

  if (cacheCleared) {
    console.log(`Cleared old Codex plugin cache: ${defaultPluginCacheDir()}`);
  }

  console.log("初始化完成。");
  console.log("重启 Codex Desktop 后，可以直接说：用 Gemini 检查一下这个回答。");
  console.log("也可以在插件页把 Codex-Gemini-Llmcaller 添加到会话后使用。");
}

main().catch((error) => {
  if (isBusyError(error)) {
    console.error("Error: A plugin or marketplace file is locked. Fully quit Codex Desktop and any editor using the install directory, then rerun setup.");
  } else {
    console.error(`Error: ${error.message}`);
  }
  process.exitCode = 1;
});
