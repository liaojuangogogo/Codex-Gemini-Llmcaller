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
import {
  DEFAULT_PROFILE_NAME,
  DEFAULT_PROVIDER_ID,
  PROVIDER_SPECS,
  apiKeyEnvMap,
  setupProviderSpecs
} from "./plugins/Codex-Llmcaller/scripts/provider-registry.mjs";

const PLUGIN_NAME = "Codex-Llmcaller";
const LEGACY_PLUGIN_NAMES = ["Codex-Gemini-Llmcaller", "multi-model-api"];
const MARKETPLACE_NAME = "codex-llmcaller-local";
const LEGACY_MARKETPLACE_NAMES = ["codex-gemini-llmcaller-local"];
const MARKETPLACE_DISPLAY_NAME = "Codex-Llmcaller Local Plugins";
const LEGACY_MARKETPLACE_DISPLAY_NAMES = [
  "Codex-Gemini-Llmcaller Local Plugins",
  "Local User Plugins",
  "CheckWithModel Local Plugins"
];
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
  --providers gemini,deepseek        Providers to initialize. Defaults to gemini.
  --api-key-env GEMINI_API_KEY       Read the default provider API key from a local environment variable.
  --api-key-env gemini=GEMINI_API_KEY,deepseek=DEEPSEEK_API_KEY
                                    Read multiple provider API keys from local environment variables.
  --default-profile deepseek-default Set the global default profile after initialization.
  --refresh-secrets                 Re-enter or re-import provider API keys even when decryptable secrets already exist.
  --skip-api-validate               Skip the lightweight provider API validation calls after initialization.
  --install-only                     Install/register the plugin without initializing secrets or profiles.
  --model gemini-3-flash-preview     Legacy Gemini model override for the default profile.
  --profile gemini-default           Legacy Gemini secret/profile name override.
  --plugin-target-dir <path>         Override the user-level plugin install directory.
  --marketplace-path <path>          Override the user-level marketplace path.
  --check-only                       Check Node, Windows, PowerShell, and writable paths only.
  --yes                              Skip interactive confirmation prompts.

Default install target:
  path.join(os.homedir(), "plugins", "Codex-Llmcaller")

Default encrypted data target:
  path.join(os.homedir(), "plugins", "Codex-Llmcaller", ".data")

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

function legacyPluginCacheDirs() {
  return [
    ...LEGACY_MARKETPLACE_NAMES.map((marketplaceName) => path.join(os.homedir(), ".codex", "plugins", "cache", marketplaceName, "Codex-Gemini-Llmcaller")),
    path.join(os.homedir(), ".codex", "plugins", "cache", MARKETPLACE_NAME, "Codex-Gemini-Llmcaller")
  ];
}

function resolveInstallOptions(args) {
  const legacyProfile = typeof args.profile === "string" && args.profile.trim() ? args.profile.trim() : DEFAULT_PROFILE_NAME;
  const providers = parseProviderList(args.providers);
  const envMap = apiKeyEnvMap(typeof args.apiKeyEnv === "string" ? args.apiKeyEnv : "");
  const providersExplicit = typeof args.providers === "string" && args.providers.trim();

  return {
    providers,
    providersExplicit: Boolean(providersExplicit),
    providerSpecs: setupProviderSpecs(providers),
    legacyProfile,
    legacyModel: typeof args.model === "string" && args.model.trim() ? args.model.trim() : PROVIDER_SPECS.gemini.profiles[DEFAULT_PROFILE_NAME].model,
    apiKeyEnvMap: envMap,
    defaultApiKeyEnv: typeof args.apiKeyEnv === "string" && args.apiKeyEnv.trim() && !args.apiKeyEnv.includes("=") ? args.apiKeyEnv.trim() : null,
    defaultProfile: typeof args.defaultProfile === "string" && args.defaultProfile.trim()
      ? args.defaultProfile.trim()
      : providersExplicit && !providers.includes(DEFAULT_PROVIDER_ID) ? `${providers[0]}-default` : null,
    refreshSecrets: args.refreshSecrets === true,
    validateApis: args.skipApiValidate !== true,
    pluginTargetDir: path.resolve(expandTilde(args.pluginTargetDir) || defaultPluginTargetDir()),
    marketplacePath: path.resolve(expandTilde(args.marketplacePath) || defaultMarketplacePath()),
    installOnly: args.installOnly === true,
    checkOnly: args.checkOnly === true,
    yes: args.yes === true
  };
}

function parseProviderList(value) {
  if (typeof value !== "string" || !value.trim()) {
    return [DEFAULT_PROVIDER_ID];
  }

  const providers = value.split(",")
    .map((provider) => provider.trim().toLowerCase())
    .filter(Boolean);

  return providers.length ? [...new Set(providers)] : [DEFAULT_PROVIDER_ID];
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
    throw new Error("Could not find ./plugins/Codex-Llmcaller/.codex-plugin/plugin.json. Run setup from the repository root.");
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
  const probePath = path.join(directory, `.codex-llmcaller-write-test-${process.pid}-${Date.now()}`);
  writeFileSync(probePath, "ok", "utf8");
  rmSync(probePath, { force: true });
}

function checkWritableTargets(options) {
  probeWritableDirectory(options.pluginTargetDir);
  probeWritableDirectory(path.join(options.pluginTargetDir, ".data"));
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

async function readApiKey(providerPlan) {
  if (providerPlan.apiKeyEnv) {
    const value = process.env[providerPlan.apiKeyEnv];
    if (!value || !value.trim()) {
      throw new Error(`Environment variable ${providerPlan.apiKeyEnv} is not set.`);
    }
    return value.trim();
  }

  const value = await promptHidden(providerPlan.spec.setupPrompt ?? `${providerPlan.spec.displayName} API key: `);
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
  const targetDataDir = path.join(options.pluginTargetDir, ".data");

  if (existsSync(targetDataDir)) {
    return null;
  }

  for (const legacyPluginName of LEGACY_PLUGIN_NAMES) {
    const legacyDataDir = path.join(os.homedir(), "plugins", legacyPluginName, ".data");
    if (existsSync(legacyDataDir)) {
      copyDirectoryContents(legacyDataDir, targetDataDir);
      return legacyDataDir;
    }
  }

  return null;
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

async function hasDecryptableSecret(server, secretName) {
  try {
    const result = await server.handleToolCall({
      name: "secret_get",
      arguments: {
        name: secretName
      }
    });
    return result.structuredContent?.canDecrypt === true;
  } catch {
    return false;
  }
}

async function writeSecret(server, providerPlan, apiKey) {
  await server.handleToolCall({
    name: "secret_set",
    arguments: {
      name: providerPlan.secretName,
      apiKey,
      protection: "local-user",
      providerId: providerPlan.spec.id,
      provider: providerPlan.spec.provider,
      baseUrl: providerPlan.spec.baseUrl,
      model: providerPlan.primaryModel,
      overwrite: true
    }
  });
}

async function writeProfiles(server, providerPlan, options) {
  for (const [profileName, profile] of Object.entries(providerPlan.profiles)) {
    await server.handleToolCall({
      name: "profile_set",
      arguments: {
        name: profileName,
        ...profile,
        setDefault: options.defaultProfile === profileName
      }
    });
  }
}

async function validateProviderCall(server, providerPlan) {
  const profileName = providerPlan.primaryProfileName;
  console.log(`Validating ${providerPlan.spec.displayName} profile '${profileName}' with a lightweight API call...`);
  await server.handleToolCall({
    name: "call_model",
    arguments: {
      profileName,
      prompt: "只回复 OK。",
      executionMode: "raw",
      inputSource: "direct",
      groundingMode: "off",
      strictDelegation: true,
      outputMetaFooter: false,
      maxTokens: 16,
      autoContinue: false
    }
  });
  console.log(`Validated ${providerPlan.spec.displayName} profile '${profileName}'.`);
}

function buildProviderPlans(options) {
  return options.providerSpecs.map((spec) => {
    const legacyGeminiOverride = spec.id === "gemini" && (options.legacyProfile !== DEFAULT_PROFILE_NAME || options.legacyModel !== PROVIDER_SPECS.gemini.profiles[DEFAULT_PROFILE_NAME].model);
    const secretName = legacyGeminiOverride ? options.legacyProfile : spec.defaultSecretName;
    const profiles = legacyGeminiOverride
      ? {}
      : Object.fromEntries(
          Object.entries(spec.profiles ?? {}).map(([name, profile]) => [name, { ...profile }])
        );

    if (legacyGeminiOverride) {
      profiles[options.legacyProfile] = {
        ...PROVIDER_SPECS.gemini.profiles[DEFAULT_PROFILE_NAME],
        model: options.legacyModel,
        secretName: options.legacyProfile
      };
    }

    if (!options.defaultProfile && spec.id === "gemini" && legacyGeminiOverride) {
      options.defaultProfile = options.legacyProfile;
    }

    const primaryProfileEntry = Object.entries(profiles).find(([name]) => name === secretName) ??
      Object.entries(profiles)[0] ??
      [secretName, {}];
    const [primaryProfileName, primaryProfile] = primaryProfileEntry;
    const apiKeyEnv = options.apiKeyEnvMap[spec.id] ?? (
      options.defaultApiKeyEnv && (spec.id === DEFAULT_PROVIDER_ID || options.providerSpecs.length === 1) ? options.defaultApiKeyEnv : null
    );

    return {
      spec,
      secretName,
      profiles,
      primaryProfileName,
      primaryModel: primaryProfile.model,
      apiKeyEnv
    };
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
  if (!parsed.name || LEGACY_MARKETPLACE_NAMES.includes(parsed.name)) {
    parsed.name = MARKETPLACE_NAME;
  }
  if (!parsed.interface || typeof parsed.interface !== "object" || Array.isArray(parsed.interface)) {
    parsed.interface = { displayName: MARKETPLACE_DISPLAY_NAME };
  }
  if (LEGACY_MARKETPLACE_DISPLAY_NAMES.includes(parsed.interface.displayName)) {
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
  marketplace.plugins = marketplace.plugins.filter((plugin) => !LEGACY_PLUGIN_NAMES.includes(plugin?.name));
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
  const cacheDirs = [defaultPluginCacheDir(), ...legacyPluginCacheDirs()];
  let cleared = false;

  for (const cacheDir of cacheDirs) {
    if (!existsSync(cacheDir)) {
      continue;
    }

    rmSync(cacheDir, {
      recursive: true,
      force: true
    });
    cleared = true;
  }

  return cleared;
}

function isBusyError(error) {
  return ["EBUSY", "EPERM", "EACCES"].includes(error?.code);
}

function printEnvironmentSummary(options, powerShellVersion) {
  console.log(`Node.js: ${process.version}`);
  console.log(`PowerShell: ${powerShellVersion}`);
  console.log(`Source plugin: ${path.relative(REPO_ROOT, SOURCE_PLUGIN_DIR)}`);
  console.log(`Plugin target: ${options.pluginTargetDir}`);
  console.log(`Plugin data: ${path.join(options.pluginTargetDir, ".data")}`);
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
  const migratedLegacyDataDir = migrateLegacyDataIfNeeded(options);
  const server = await loadInstalledServer(options);
  const providerPlans = buildProviderPlans(options);

  if (migratedLegacyDataDir) {
    console.log(`Migrated existing encrypted data from ${migratedLegacyDataDir}.`);
  }

  if (!options.installOnly) {
    for (const providerPlan of providerPlans) {
      const canReuseSecret = !options.refreshSecrets && !providerPlan.apiKeyEnv && await hasDecryptableSecret(server, providerPlan.secretName);

      if (canReuseSecret) {
        console.log(`Existing decryptable secret '${providerPlan.secretName}' found; skipping ${providerPlan.spec.displayName} API key input.`);
      } else {
        if (options.refreshSecrets) {
          console.log(`Refreshing secret '${providerPlan.secretName}' for ${providerPlan.spec.displayName}.`);
        }
        const apiKey = await readApiKey(providerPlan);
        await writeSecret(server, providerPlan, apiKey);
      }

      await writeProfiles(server, providerPlan, options);
      console.log(`Initialized ${providerPlan.spec.displayName} profiles: ${Object.keys(providerPlan.profiles).join(", ")}`);
    }

    if (options.defaultProfile && !providerPlans.some((plan) => Object.prototype.hasOwnProperty.call(plan.profiles, options.defaultProfile))) {
      await server.handleToolCall({
        name: "config_set_default_profile",
        arguments: {
          profileName: options.defaultProfile
        }
      });
    }
  } else {
    console.log("Install-only mode: skipped secret and profile initialization.");
  }

  writeMarketplace(options);
  const cacheCleared = clearPluginCache();

  if (cacheCleared) {
    console.log("Cleared old Codex plugin cache entries.");
  }

  if (!options.installOnly) {
    if (options.validateApis) {
      const validationFailures = [];

      for (const providerPlan of providerPlans) {
        try {
          await validateProviderCall(server, providerPlan);
        } catch (error) {
          validationFailures.push({
            providerName: providerPlan.spec.displayName,
            profileName: providerPlan.primaryProfileName,
            message: error?.message || String(error)
          });
        }
      }

      if (validationFailures.length) {
        const details = validationFailures
          .map((failure) => `- ${failure.providerName} (${failure.profileName}): ${failure.message}`)
          .join("\n");
        throw new Error([
          "Provider API validation failed. The plugin files, marketplace entry, profiles, encrypted secrets, and plugin cache cleanup were completed, but at least one provider cannot complete a real API call.",
          details,
          "Fix the provider API key, billing/quota, model permission, or network access, then rerun setup with --refresh-secrets or --api-key-env. Use --skip-api-validate only when you intentionally want to skip live validation."
        ].join("\n"));
      }
    } else {
      console.log("Skipped provider API validation because --skip-api-validate was set.");
    }
  }

  console.log("初始化完成。");
  const example = providerPlans[0]?.spec.setupExample ?? "用外部模型检查一下这个回答。";
  console.log(`重启 Codex Desktop 后，可以直接说：${example}`);
  console.log("也可以在插件页把 Codex-Llmcaller 添加到会话后使用。");
}

main().catch((error) => {
  if (isBusyError(error)) {
    console.error("Error: A plugin or marketplace file is locked. Fully quit Codex Desktop and any editor using the install directory, then rerun setup.");
  } else {
    console.error(`Error: ${error.message}`);
  }
  process.exitCode = 1;
});
