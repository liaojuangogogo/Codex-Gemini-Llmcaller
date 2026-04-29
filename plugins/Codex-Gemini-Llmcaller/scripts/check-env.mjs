#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const MIN_NODE_MAJOR = 18;

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }
    const key = token.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
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

function checkNodeVersion() {
  const major = Number.parseInt(process.versions.node.split(".")[0], 10);
  if (!Number.isInteger(major) || major < MIN_NODE_MAJOR) {
    throw new Error(`Node.js ${MIN_NODE_MAJOR} or newer is required. Current version: ${process.version}`);
  }
  return process.version;
}

function checkWindows() {
  if (process.platform !== "win32") {
    throw new Error("Windows is required for the default local-user DPAPI setup path.");
  }
  return os.release();
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

function probeWritableDirectory(directory) {
  mkdirSync(directory, { recursive: true });
  const probePath = path.join(directory, `.Codex-Gemini-Llmcaller-write-test-${process.pid}-${Date.now()}`);
  writeFileSync(probePath, "ok", "utf8");
  rmSync(probePath, { force: true });
}

try {
  const args = parseArgs(process.argv.slice(2));
  const pluginTargetDir = path.resolve(expandTilde(args.pluginTargetDir) || path.join(os.homedir(), "plugins", "Codex-Gemini-Llmcaller"));
  const marketplacePath = path.resolve(expandTilde(args.marketplacePath) || path.join(os.homedir(), ".agents", "plugins", "marketplace.json"));
  const nodeVersion = checkNodeVersion();
  const windowsVersion = checkWindows();
  const powerShellVersion = checkPowerShell();

  probeWritableDirectory(pluginTargetDir);
  probeWritableDirectory(path.dirname(marketplacePath));

  console.log("Environment check passed.");
  console.log(`Node.js: ${nodeVersion}`);
  console.log(`Windows: ${windowsVersion}`);
  console.log(`PowerShell: ${powerShellVersion}`);
  console.log(`Plugin target: ${pluginTargetDir}`);
  console.log(`Marketplace: ${marketplacePath}`);
} catch (error) {
  if (["EBUSY", "EPERM", "EACCES"].includes(error?.code)) {
    console.error("Environment check failed: a target path is locked or not writable. Fully quit Codex Desktop and rerun this command.");
  } else {
    console.error(`Environment check failed: ${error.message}`);
  }
  process.exitCode = 1;
}
