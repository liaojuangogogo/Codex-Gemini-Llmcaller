#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = resolve(SCRIPT_DIR, "..");
const REPO_ROOT = resolve(PLUGIN_ROOT, "..", "..");
const TEXT_EXTENSIONS = new Set([".md", ".mjs", ".json", ".gitignore"]);
const EXCLUDED_DIRS = new Set([".data", ".git", "node_modules"]);
const FORBIDDEN_PATTERNS = [
  {
    name: "Windows absolute path",
    pattern: /\b[A-Za-z]:[\\/](?![\\/])/u
  },
  {
    name: "USERPROFILE placeholder",
    pattern: new RegExp(`%${"USERPROFILE"}%`, "iu")
  },
  {
    name: "file URI",
    pattern: /file:\/\//iu
  }
];

function walkFiles(root) {
  const files = [];

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (EXCLUDED_DIRS.has(entry.name)) {
      continue;
    }

    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function assertJson(path) {
  JSON.parse(readFileSync(path, "utf8"));
}

function scanForbiddenPaths(files) {
  const findings = [];

  for (const file of files) {
    if (!TEXT_EXTENSIONS.has(extname(file)) && !file.endsWith(".gitignore")) {
      continue;
    }

    const text = readFileSync(file, "utf8");
    for (const { name, pattern } of FORBIDDEN_PATTERNS) {
      if (pattern.test(text)) {
        findings.push(`${relative(REPO_ROOT, file)} contains ${name}`);
      }
    }
  }

  return findings;
}

function assertDataIgnored() {
  const gitignorePath = join(PLUGIN_ROOT, ".gitignore");
  if (!existsSync(gitignorePath)) {
    throw new Error("plugins/Codex-Gemini-Llmcaller/.gitignore is missing.");
  }

  const content = readFileSync(gitignorePath, "utf8");
  if (!/^\.data\/?$/mu.test(content)) {
    throw new Error("plugins/Codex-Gemini-Llmcaller/.gitignore must ignore .data/.");
  }
}

function assertRootTmpIgnored() {
  const gitignorePath = join(REPO_ROOT, ".gitignore");
  if (!existsSync(gitignorePath)) {
    throw new Error(".gitignore is missing.");
  }

  const content = readFileSync(gitignorePath, "utf8");
  if (!/^\.tmp\/?$/mu.test(content)) {
    throw new Error(".gitignore must ignore .tmp/.");
  }
}

function assertDirectoryHasNoFiles(directory, label) {
  if (!existsSync(directory)) {
    return;
  }

  const files = walkAllFiles(directory);
  if (files.length) {
    throw new Error(`${label} contains generated or sensitive files that must not be uploaded:\n${files.map((file) => relative(REPO_ROOT, file)).join("\n")}`);
  }
}

function walkAllFiles(root) {
  const files = [];

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkAllFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

try {
  const files = [
    ...walkFiles(PLUGIN_ROOT),
    join(REPO_ROOT, "setup.mjs"),
    join(REPO_ROOT, ".agents", "plugins", "marketplace.json")
  ].filter((file) => existsSync(file) && statSync(file).isFile());

  for (const file of [
    join(REPO_ROOT, ".agents", "plugins", "marketplace.json"),
    join(PLUGIN_ROOT, ".codex-plugin", "plugin.json"),
    join(PLUGIN_ROOT, ".mcp.json")
  ]) {
    assertJson(file);
  }

  assertDataIgnored();
  assertRootTmpIgnored();
  assertDirectoryHasNoFiles(join(REPO_ROOT, ".tmp"), ".tmp/");
  assertDirectoryHasNoFiles(join(PLUGIN_ROOT, ".data"), "plugins/Codex-Gemini-Llmcaller/.data/");
  const findings = scanForbiddenPaths(files);
  if (findings.length) {
    throw new Error(`Release path check failed:\n${findings.join("\n")}`);
  }

  console.log("Release check passed.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
