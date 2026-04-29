#!/usr/bin/env node

import { migrateSecretToLocalUser } from "./server.mjs";

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

function printHelp() {
  console.log(`Usage:
  node ./plugins/Codex-Gemini-Llmcaller/scripts/secret-migrate-local-user.mjs --name <secret-name>

This migrates an existing passphrase-protected secret to Windows current-user
protection. The old master key is entered with hidden terminal input and is not
sent through chat or stored in the secret file.`);
}

async function promptHidden(label) {
  if (!process.stdin.isTTY || !process.stdout.isTTY || typeof process.stdin.setRawMode !== "function") {
    throw new Error(`${label} requires an interactive terminal.`);
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

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  if (typeof args.name !== "string" || !args.name.trim()) {
    printHelp();
    throw new Error("--name is required.");
  }

  const masterKey = await promptHidden("Existing master key: ");
  if (!masterKey.trim()) {
    throw new Error("Master key cannot be empty.");
  }

  const result = migrateSecretToLocalUser(args.name, masterKey);
  console.log(`Migrated encrypted secret '${result.name}' to local-user protection.`);
  console.log(`Fingerprint: ${result.fingerprint}`);
  console.log(`Key preview: ${result.keyPreview}`);
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
