#!/usr/bin/env node

import { handleToolCall } from "./server.mjs";

const flagMap = {
  "api-key-env": "apiKeyEnv",
  "master-key-env": "masterKeyEnv",
  "base-url": "baseUrl"
};

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
    const rawKey = equalIndex === -1 ? withoutPrefix : withoutPrefix.slice(0, equalIndex);
    const key = flagMap[rawKey] ?? rawKey;
    const value = equalIndex === -1 ? argv[index + 1] : withoutPrefix.slice(equalIndex + 1);

    if (equalIndex === -1) {
      if (value === undefined || value.startsWith("--")) {
        args[key] = true;
        continue;
      }
      index += 1;
    }

    args[key] = value;
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node ./plugins/Codex-Gemini-Llmcaller/scripts/secret-import.mjs --name <secret-name> [options]

Options:
  --name <name>                 Required secret name, for example gemini-default
  --provider <provider>         Optional provider metadata, for example google
  --model <model>               Optional model metadata
  --base-url <url>              Optional provider base URL metadata
  --api-key-env <env-name>      Read API key from a local environment variable
  --protection <mode>           local-user (default) or passphrase
  --master-key-env <env-name>   Read master password from a local environment variable for passphrase mode
  --overwrite false             Fail if the secret already exists

Default safe mode prompts for the API key with hidden terminal input and stores
it with Windows current-user protection. The API key is not printed, not passed
as a command-line argument, and not sent through chat.`);
}

async function promptHidden(label) {
  if (!process.stdin.isTTY || !process.stdout.isTTY || typeof process.stdin.setRawMode !== "function") {
    throw new Error(`${label} requires an interactive terminal. Run this script in a local terminal, or use --api-key-env with a local environment variable.`);
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

async function readSecretValue(args) {
  if (typeof args.apiKeyEnv === "string" && args.apiKeyEnv.trim()) {
    const value = process.env[args.apiKeyEnv.trim()];
    if (!value) {
      throw new Error(`Environment variable ${args.apiKeyEnv} is not set.`);
    }
    return value;
  }

  return promptHidden("API key: ");
}

async function readMasterKey(args) {
  const envName = typeof args.masterKeyEnv === "string" && args.masterKeyEnv.trim()
    ? args.masterKeyEnv.trim()
    : "CODEX_GEMINI_LLMCALLER_MASTER_KEY";
  const envValue = process.env[envName];

  if (envValue) {
    return envValue;
  }

  const first = await promptHidden("Master key: ");
  const second = await promptHidden("Confirm master key: ");

  if (first !== second) {
    throw new Error("Master key confirmation did not match.");
  }

  return first;
}

function resolveProtection(args) {
  if (args.protection === "local-user" || args.protection === "passphrase") {
    return args.protection;
  }
  if (typeof args.masterKeyEnv === "string" && args.masterKeyEnv.trim()) {
    return "passphrase";
  }

  return "local-user";
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

  const apiKey = await readSecretValue(args);
  const protection = resolveProtection(args);
  const masterKey = protection === "passphrase" ? await readMasterKey(args) : undefined;

  if (!apiKey.trim()) {
    throw new Error("API key cannot be empty.");
  }
  if (protection === "passphrase" && !masterKey.trim()) {
    throw new Error("Master key cannot be empty.");
  }

  const result = await handleToolCall({
    name: "secret_set",
    arguments: {
      name: args.name,
      apiKey,
      masterKey,
      protection,
      provider: args.provider,
      baseUrl: args.baseUrl,
      model: args.model,
      overwrite: args.overwrite === undefined ? true : args.overwrite !== "false"
    }
  });

  console.log(`Stored encrypted secret '${result.structuredContent.secret.name}'.`);
  console.log(`Fingerprint: ${result.structuredContent.secret.fingerprint}`);
  console.log(`Key preview: ${result.structuredContent.secret.keyPreview}`);
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
