#!/usr/bin/env node

import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SERVER_NAME = "Codex-Gemini-Llmcaller";
const SERVER_VERSION = "0.3.2";
const DEFAULT_TIMEOUT_MS = 120000;
const CONFIG_STORE_VERSION = 1;
const SECRET_STORE_VERSION = 1;
const SECRET_ALGORITHM = "aes-256-gcm";
const SECRET_KDF = "scrypt";
const LOCAL_USER_PROTECTION = "local-user-dpapi";
const GROUNDED_PROFILE_NAME = "gemini-grounded";
const DEFAULT_MAX_IMAGES = 4;
const DEFAULT_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const EXECUTION_MODES = new Set(["raw", "review", "rewrite", "extract"]);
const GROUNDING_MODES = new Set(["off", "google_search"]);
const INPUT_SOURCES = new Set(["direct", "context"]);

const MODULE_PATH = fileURLToPath(import.meta.url);
const MODULE_DIR = dirname(MODULE_PATH);
const USER_PLUGIN_ROOT = resolve(homedir(), "plugins", SERVER_NAME);
const DEFAULT_SECRETS_PATH = resolve(USER_PLUGIN_ROOT, ".data", "secrets.json");
const DEFAULT_CONFIG_PATH = resolve(USER_PLUGIN_ROOT, ".data", "config.json");
const DEFAULT_PROFILE_NAME = "gemini-default";
const DEFAULT_PROFILE = {
  provider: "google",
  model: "gemini-3-flash-preview",
  secretName: "gemini-default",
  timeoutMs: DEFAULT_TIMEOUT_MS,
  thinkingLevel: "low",
  autoContinue: true,
  maxContinuationRounds: 2
};

const DEFAULT_GROUNDED_PROFILE = {
  provider: "google",
  model: "gemini-2.5-flash",
  secretName: "gemini-default",
  timeoutMs: DEFAULT_TIMEOUT_MS,
  autoContinue: true,
  maxContinuationRounds: 2,
  groundingMode: "google_search",
  fallbackProfiles: ["gemini-grounded-lite", "gemini-grounded-20-flash"]
};

const DEFAULT_GROUNDED_LITE_PROFILE = {
  provider: "google",
  model: "gemini-2.5-flash-lite",
  secretName: "gemini-default",
  timeoutMs: DEFAULT_TIMEOUT_MS,
  autoContinue: true,
  maxContinuationRounds: 2,
  groundingMode: "google_search"
};

const DEFAULT_GROUNDED_20_FLASH_PROFILE = {
  provider: "google",
  model: "gemini-2.0-flash",
  secretName: "gemini-default",
  timeoutMs: DEFAULT_TIMEOUT_MS,
  autoContinue: true,
  maxContinuationRounds: 2,
  groundingMode: "google_search"
};

const PROVIDER_PRESETS = [
  {
    provider: "openai-compatible",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKeyEnv: "OPENROUTER_API_KEY",
    notes: "Use model ids such as openai/gpt-4o-mini or anthropic/claude-3.5-sonnet."
  },
  {
    provider: "openai-compatible",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    notes: "Common model ids include deepseek-chat and deepseek-reasoner."
  },
  {
    provider: "openai-compatible",
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    apiKeyEnv: "GROQ_API_KEY",
    notes: "Uses OpenAI-compatible chat completions."
  },
  {
    provider: "openai-compatible",
    name: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    apiKeyEnv: "MISTRAL_API_KEY",
    notes: "Uses OpenAI-compatible chat completions."
  },
  {
    provider: "openai-compatible",
    name: "xAI",
    baseUrl: "https://api.x.ai/v1",
    apiKeyEnv: "XAI_API_KEY",
    notes: "Uses OpenAI-compatible chat completions."
  },
  {
    provider: "anthropic",
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    notes: "Uses the Messages API."
  },
  {
    provider: "google",
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    apiKeyEnv: "GEMINI_API_KEY",
    notes: "Native REST generateContent endpoint with x-goog-api-key."
  }
];

const messageSchema = {
  type: "object",
  properties: {
    role: {
      type: "string",
      enum: ["system", "user", "assistant"]
    },
    content: {
      type: "string"
    }
  },
  required: ["role", "content"],
  additionalProperties: false
};

const tools = [
  {
    name: "call_model",
    description: "Call an API-key authenticated LLM provider and return the model text.",
    inputSchema: {
      type: "object",
      properties: {
        profileName: {
          type: "string",
          description: "Named profile to use. Defaults to the configured default profile."
        },
        provider: {
          type: "string",
          enum: ["openai-compatible", "anthropic", "google"],
          description: "Provider API format."
        },
        model: {
          type: "string",
          description: "Provider model id, for example deepseek-chat or gemini-3-flash-preview."
        },
        prompt: {
          type: "string",
          description: "Single user prompt. Ignored when messages is supplied."
        },
        messages: {
          type: "array",
          description: "Chat messages. Roles may be system, user, or assistant.",
          items: messageSchema
        },
        executionMode: {
          type: "string",
          enum: ["raw", "review", "rewrite", "extract"],
          description: "Delegation intent selected by Codex before calling the external model."
        },
        groundingMode: {
          type: "string",
          enum: ["off", "google_search"],
          description: "Use off by default. Use google_search only when Gemini itself should perform Google Search grounding."
        },
        inputSource: {
          type: "string",
          enum: ["direct", "context"],
          description: "Whether the prompt is direct user input or conversation context passed through unchanged."
        },
        imageInputs: {
          type: "array",
          description: "Images to pass to Gemini. Supports local file paths or image URLs.",
          items: {
            type: "object",
            properties: {
              path: { type: "string" },
              url: { type: "string" },
              mimeType: { type: "string" }
            },
            additionalProperties: false
          }
        },
        strictDelegation: {
          type: "boolean",
          description: "When true, the caller must not pre-search, rewrite, or add facts before passing the request to Gemini. Defaults to true."
        },
        maxImages: {
          type: "integer",
          minimum: 1,
          maximum: 16,
          description: "Maximum number of imageInputs. Defaults to 4."
        },
        maxImageBytes: {
          type: "integer",
          minimum: 1024,
          maximum: 104857600,
          description: "Maximum bytes per image. Defaults to 10 MB."
        },
        apiKey: {
          type: "string",
          description: "API key. Prefer secretName or apiKeyEnv when possible."
        },
        apiKeyEnv: {
          type: "string",
          description: "Environment variable name containing the API key."
        },
        secretName: {
          type: "string",
          description: "Encrypted local secret name containing the API key."
        },
        masterKey: {
          type: "string",
          description: "Master password for passphrase-protected secrets. Local-user secrets do not need this."
        },
        masterKeyEnv: {
          type: "string",
          description: "Environment variable name containing the master password."
        },
        baseUrl: {
          type: "string",
          description: "Provider base URL. Gemini defaults to https://generativelanguage.googleapis.com/v1beta."
        },
        temperature: {
          type: "number",
          minimum: 0,
          maximum: 2
        },
        maxTokens: {
          type: "integer",
          minimum: 1,
          maximum: 200000
        },
        headers: {
          type: "object",
          description: "Additional HTTP headers. content-type is controlled by this server.",
          additionalProperties: {
            type: "string"
          }
        },
        extraBody: {
          type: "object",
          description: "Additional request body fields merged into the provider payload."
        },
        systemInstruction: {
          anyOf: [
            { type: "string" },
            { type: "object" }
          ],
          description: "Gemini system instruction as text or an official Content object."
        },
        generationConfig: {
          type: "object",
          description: "Gemini generationConfig object."
        },
        safetySettings: {
          type: "array",
          description: "Gemini safetySettings array.",
          items: { type: "object" }
        },
        rawContents: {
          type: "array",
          description: "Gemini contents array in the official REST shape. Overrides prompt/messages contents.",
          items: { type: "object" }
        },
        thinkingLevel: {
          type: "string",
          description: "Gemini thinkingConfig.thinkingLevel convenience value, for example low."
        },
        tools: {
          type: "array",
          description: "Gemini tools array in the official REST shape.",
          items: { type: "object" }
        },
        googleTools: {
          type: "array",
          description: "Alias for Gemini tools. Prefer tools for new calls.",
          items: { type: "object" }
        },
        toolConfig: {
          type: "object",
          description: "Gemini toolConfig object."
        },
        cachedContent: {
          type: "string",
          description: "Gemini cachedContent name, for example cachedContents/abc123."
        },
        timeoutMs: {
          type: "integer",
          minimum: 1000,
          maximum: 600000
        },
        autoContinue: {
          type: "boolean",
          description: "Automatically continue Gemini responses that appear truncated. Defaults to the profile setting or true."
        },
        maxContinuationRounds: {
          type: "integer",
          minimum: 0,
          maximum: 10,
          description: "Maximum automatic continuation rounds. Defaults to the profile setting or 2."
        },
        outputMetaFooter: {
          type: "boolean",
          description: "Append provider/model/token metadata to visible text. Structured metadata is always returned."
        },
        fallbackProfileName: {
          type: "string",
          description: "Fallback profile to try if the selected profile call fails."
        },
        fallbackProfiles: {
          type: "array",
          description: "Ordered fallback profiles to try if the selected profile call fails.",
          items: { type: "string" }
        },
        returnRaw: {
          type: "boolean",
          description: "Include the raw provider JSON in the response."
        }
      },
      additionalProperties: false
    }
  },
  {
    name: "config_get",
    description: "Return the current model profile configuration without secrets.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "config_set_default_profile",
    description: "Set the default model profile name.",
    inputSchema: {
      type: "object",
      properties: {
        profileName: {
          type: "string"
        }
      },
      required: ["profileName"],
      additionalProperties: false
    }
  },
  {
    name: "profile_set",
    description: "Create or update a named model profile. Profiles reference secrets by name and never store plaintext API keys.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        provider: { type: "string", enum: ["openai-compatible", "anthropic", "google"] },
        model: { type: "string" },
        secretName: { type: "string" },
        apiKeyEnv: { type: "string" },
        baseUrl: { type: "string" },
        executionMode: { type: "string", enum: ["raw", "review", "rewrite", "extract"] },
        groundingMode: { type: "string", enum: ["off", "google_search"] },
        inputSource: { type: "string", enum: ["direct", "context"] },
        strictDelegation: { type: "boolean" },
        maxImages: { type: "integer", minimum: 1, maximum: 16 },
        maxImageBytes: { type: "integer", minimum: 1024, maximum: 104857600 },
        timeoutMs: { type: "integer", minimum: 1000, maximum: 600000 },
        temperature: { type: "number", minimum: 0, maximum: 2 },
        maxTokens: { type: "integer", minimum: 1, maximum: 200000 },
        thinkingLevel: { type: "string" },
        generationConfig: { type: "object" },
        safetySettings: { type: "array", items: { type: "object" } },
        systemInstruction: {
          anyOf: [
            { type: "string" },
            { type: "object" }
          ]
        },
        tools: { type: "array", items: { type: "object" } },
        toolConfig: { type: "object" },
        cachedContent: { type: "string" },
        autoContinue: { type: "boolean" },
        maxContinuationRounds: { type: "integer", minimum: 0, maximum: 10 },
        outputMetaFooter: { type: "boolean" },
        fallbackProfileName: { type: "string" },
        fallbackProfiles: { type: "array", items: { type: "string" } },
        headers: { type: "object", additionalProperties: { type: "string" } },
        extraBody: { type: "object" },
        setDefault: { type: "boolean" }
      },
      required: ["name"],
      additionalProperties: false
    }
  },
  {
    name: "profile_delete",
    description: "Delete a named model profile.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" }
      },
      required: ["name"],
      additionalProperties: false
    }
  },
  {
    name: "profile_list",
    description: "List configured model profiles.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "secret_set",
    description: "Encrypt and store an API key locally. Defaults to Windows local-user protection; passphrase mode uses AES-256-GCM.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Secret name, for example gemini-default."
        },
        apiKey: {
          type: "string",
          description: "Plaintext API key to encrypt. Avoid this in chat because tool arguments may be retained."
        },
        apiKeyEnv: {
          type: "string",
          description: "Environment variable name containing the API key to encrypt."
        },
        masterKey: {
          type: "string",
          description: "Master password for passphrase protection. Not needed for local-user protection."
        },
        masterKeyEnv: {
          type: "string",
          description: "Environment variable name containing the master password."
        },
        provider: {
          type: "string",
          description: "Optional provider metadata."
        },
        baseUrl: {
          type: "string",
          description: "Optional provider base URL metadata."
        },
        model: {
          type: "string",
          description: "Optional default model metadata."
        },
        protection: {
          type: "string",
          enum: ["local-user", "passphrase"],
          description: "Secret protection mode. Defaults to local-user unless masterKey/masterKeyEnv is supplied."
        },
        overwrite: {
          type: "boolean",
          description: "Defaults to true. Set false to fail when the secret already exists."
        }
      },
      required: ["name"],
      additionalProperties: false
    }
  },
  {
    name: "secret_get",
    description: "Verify and return masked metadata for an encrypted local API key.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string"
        },
        masterKey: {
          type: "string",
          description: "Master password for passphrase-protected secrets. Local-user secrets do not need this."
        },
        masterKeyEnv: {
          type: "string",
          description: "Environment variable name containing the master password."
        }
      },
      required: ["name"],
      additionalProperties: false
    }
  },
  {
    name: "secret_migrate_local_user",
    description: "Migrate a passphrase-protected secret to Windows local-user protection. Prefer the local migration script so the master key does not enter chat.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string"
        },
        masterKey: {
          type: "string",
          description: "Master password for the existing passphrase-protected secret."
        },
        masterKeyEnv: {
          type: "string",
          description: "Environment variable name containing the master password."
        }
      },
      required: ["name"],
      additionalProperties: false
    }
  },
  {
    name: "secret_delete",
    description: "Delete a locally encrypted API key.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string"
        }
      },
      required: ["name"],
      additionalProperties: false
    }
  },
  {
    name: "secret_list",
    description: "List locally stored encrypted API key names and metadata.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "provider_presets",
    description: "Return common provider base URLs and API key environment variable names.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  }
];

export async function handleRequest(message) {
  switch (message.method) {
    case "initialize":
      return {
        protocolVersion: message.params?.protocolVersion ?? "2024-11-05",
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: SERVER_NAME,
          version: SERVER_VERSION
        }
      };
    case "ping":
      return {};
    case "tools/list":
      return { tools };
    case "tools/call":
      return handleToolCall(message.params ?? {});
    case "resources/list":
      return { resources: [] };
    case "prompts/list":
      return { prompts: [] };
    default:
      throw rpcError(-32601, `Method not found: ${message.method}`);
  }
}

export async function handleToolCall(params) {
  const name = params.name;
  const args = params.arguments ?? {};

  switch (name) {
    case "provider_presets":
      return textResult(JSON.stringify({ presets: PROVIDER_PRESETS }, null, 2), {
        presets: PROVIDER_PRESETS
      });
    case "config_get":
      return handleConfigGet();
    case "config_set_default_profile":
      return handleConfigSetDefaultProfile(args);
    case "profile_set":
      return handleProfileSet(args);
    case "profile_delete":
      return handleProfileDelete(args);
    case "profile_list":
      return handleProfileList();
    case "secret_set":
      return handleSecretSet(args);
    case "secret_get":
      return handleSecretGet(args);
    case "secret_migrate_local_user":
      return handleSecretMigrateLocalUser(args);
    case "secret_delete":
      return handleSecretDelete(args);
    case "secret_list":
      return handleSecretList();
    case "call_model": {
      const result = await callModel(args);
      const responseText = formatModelResponseText(result, args.returnRaw);
      return textResult(responseText, result);
    }
    default:
      throw rpcError(-32602, `Unknown tool: ${name}`);
  }
}

export async function callModel(args) {
  const originalArgs = args;
  args = resolveCallArgs(args);
  const fallbackArgs = resolveFallbackCallArgs(originalArgs, args);
  const attempts = [args, ...fallbackArgs];
  const fallbackFailures = [];

  for (let index = 0; index < attempts.length; index += 1) {
    const attemptArgs = attempts[index];

    try {
      const result = await callModelAttempt(attemptArgs);

      return fallbackFailures.length
        ? {
            ...result,
            fallbackUsed: true,
            fallbackFailures
          }
        : result;
    } catch (error) {
      if (index >= attempts.length - 1) {
        if (fallbackFailures.length) {
          fallbackFailures.push(publicModelFailure(attemptArgs, error));
          throw rpcError(-32603, `All configured model profiles failed: ${formatModelFailures(fallbackFailures)}`);
        }

        throw error;
      }

      fallbackFailures.push(publicModelFailure(attemptArgs, error));
    }
  }

  throw rpcError(-32603, "Model call failed before any profile could be attempted.");
}

async function callModelAttempt(args) {
  requireString(args.provider, "provider");
  requireString(args.model, "model");

  const allowEmptyMessages = args.provider === "google" && Array.isArray(args.rawContents) && args.rawContents.length > 0;
  const messages = normalizeMessages(args, { allowEmpty: allowEmptyMessages });
  const apiKey = resolveApiKey(args);
  const timeoutMs = clampInteger(args.timeoutMs, 1000, 600000, DEFAULT_TIMEOUT_MS);

  if (typeof fetch !== "function") {
    throw new Error("Node.js 18 or newer is required because this server uses global fetch.");
  }
  if (args.groundingMode === "google_search" && args.provider !== "google") {
    throw rpcError(-32602, "groundingMode 'google_search' is currently supported only for provider 'google'.");
  }
  if (hasImageInputs(args) && args.provider !== "google") {
    throw rpcError(-32602, "imageInputs are currently supported only for provider 'google'.");
  }

  switch (args.provider) {
    case "openai-compatible":
      return withProfileName(await callOpenAiCompatible(args, messages, apiKey, timeoutMs), args);
    case "anthropic":
      return withProfileName(await callAnthropic(args, messages, apiKey, timeoutMs), args);
    case "google":
      return withProfileName(await callGoogle(args, messages, apiKey, timeoutMs), args);
    default:
      throw rpcError(-32602, `Unsupported provider: ${args.provider}`);
  }
}

function resolveFallbackCallArgs(originalArgs, resolvedArgs) {
  const fallbackProfileNames = normalizeFallbackProfileNames(resolvedArgs)
    .filter((profileName) => profileName !== resolvedArgs.profileName);
  const uniqueProfileNames = [...new Set(fallbackProfileNames)];

  return uniqueProfileNames.map((profileName) => resolveCallArgs({
    ...originalArgs,
    profileName,
    fallbackProfileName: undefined,
    fallbackProfiles: undefined
  }));
}

function withProfileName(result, args) {
  const withProfile = {
    ...result,
    profileName: result.profileName ?? args.profileName
  };

  return enrichModelResult(withProfile, args);
}

function enrichModelResult(result, args) {
  const modelInfo = {
    provider: result.provider ?? args.provider,
    model: result.model ?? args.model,
    profileName: result.profileName ?? args.profileName
  };
  const tokenUsage = normalizeTokenUsage(modelInfo.provider, result.usage);

  return removeUndefined({
    ...result,
    modelInfo,
    tokenUsage,
    delegation: buildDelegationInfo(args),
    outputMetaFooter: resolveOutputMetaFooter(args),
    configWarning: args.configWarning
  });
}

function buildDelegationInfo(args) {
  return {
    executionMode: args.executionMode ?? "raw",
    groundingMode: args.groundingMode ?? "off",
    inputSource: args.inputSource ?? "direct",
    imageCount: Array.isArray(args.imageInputs) ? args.imageInputs.length : 0,
    strictDelegation: args.strictDelegation !== false,
    codexPreprocessedFacts: false
  };
}

function normalizeTokenUsage(provider, usage) {
  const empty = {
    input: null,
    output: null,
    total: null,
    accounting: "billable_sum",
    raw: usage ?? null
  };

  if (!isPlainObject(usage)) {
    return empty;
  }

  if (provider === "openai-compatible") {
    return {
      input: integerOrNull(usage.prompt_tokens),
      output: integerOrNull(usage.completion_tokens),
      total: integerOrNull(usage.total_tokens) ?? sumKnown(usage.prompt_tokens, usage.completion_tokens),
      accounting: "billable_sum",
      raw: usage
    };
  }

  if (provider === "anthropic") {
    return {
      input: integerOrNull(usage.input_tokens),
      output: integerOrNull(usage.output_tokens),
      total: sumKnown(usage.input_tokens, usage.output_tokens),
      accounting: "billable_sum",
      raw: usage
    };
  }

  if (provider === "google") {
    return {
      input: integerOrNull(usage.promptTokenCount),
      output: integerOrNull(usage.candidatesTokenCount),
      total: integerOrNull(usage.totalTokenCount) ?? sumKnown(usage.promptTokenCount, usage.candidatesTokenCount),
      accounting: "billable_sum",
      raw: usage
    };
  }

  return empty;
}

function integerOrNull(value) {
  return Number.isInteger(value) ? value : null;
}

function sumKnown(...values) {
  const integers = values.filter(Number.isInteger);
  return integers.length ? integers.reduce((sum, value) => sum + value, 0) : null;
}

function findLastIndex(values, predicate) {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (predicate(values[index], index)) {
      return index;
    }
  }

  return -1;
}

function resolveOutputMetaFooter(args) {
  return args.outputMetaFooter !== false;
}

function formatModelResponseText(result, returnRaw) {
  const baseText = returnRaw
    ? `${result.text}\n\nRaw response:\n${JSON.stringify(result.raw, null, 2)}`
    : result.text;

  return result.outputMetaFooter === false
    ? baseText
    : `${baseText}\n\n${formatModelMetaFooter(result)}`;
}

function formatModelMetaFooter(result) {
  const usage = result.tokenUsage ?? {};
  const info = result.modelInfo ?? {};

  return [
    "---",
    `模型: ${info.provider ?? "unknown"} / ${info.model ?? "unknown"}`,
    `Profile: ${info.profileName ?? "unknown"}`,
    `Tokens: input=${formatTokenValue(usage.input)}, output=${formatTokenValue(usage.output)}, total=${formatTokenValue(usage.total)}`
  ].join("\n");

  return [
    "---",
    `模型: ${info.provider ?? "unknown"} / ${info.model ?? "unknown"}`,
    `Profile: ${info.profileName ?? "unknown"}`,
    `Tokens: input=${formatTokenValue(usage.input)}, output=${formatTokenValue(usage.output)}, total=${formatTokenValue(usage.total)}`
  ].join("\n");
}

function formatTokenValue(value) {
  return Number.isInteger(value) ? String(value) : "unknown";
}

function publicModelFailure(args, error) {
  return {
    profileName: args.profileName,
    provider: args.provider,
    model: args.model,
    message: redactSensitive(error?.message || "Unknown error", [])
  };
}

function formatModelFailures(failures) {
  return failures
    .map((failure) => `${failure.profileName || "unknown"} (${failure.provider || "unknown"}/${failure.model || "unknown"}): ${failure.message}`)
    .join("; ");
}

async function callOpenAiCompatible(args, messages, apiKey, timeoutMs) {
  const baseUrl = trimTrailingSlash(
    args.baseUrl ||
      process.env.OPENAI_COMPATIBLE_BASE_URL ||
      process.env.OPENAI_BASE_URL ||
      "https://api.openai.com/v1"
  );
  const url = `${baseUrl}/chat/completions`;
  const body = {
    model: args.model,
    messages,
    stream: false,
    ...optionalNumber("temperature", args.temperature),
    ...optionalInteger("max_tokens", args.maxTokens),
    ...(isPlainObject(args.extraBody) ? args.extraBody : {})
  };

  const raw = await postJson(url, body, {
    Authorization: `Bearer ${apiKey}`,
    ...safeHeaders(args.headers)
  }, timeoutMs, [apiKey], args);
  const text = raw?.choices?.[0]?.message?.content ?? raw?.choices?.[0]?.text ?? "";

  return {
    provider: "openai-compatible",
    model: args.model,
    baseUrl,
    text,
    usage: raw?.usage,
    raw
  };
}

async function callAnthropic(args, messages, apiKey, timeoutMs) {
  const baseUrl = trimTrailingSlash(args.baseUrl || process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com/v1");
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  const anthropicMessages = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.content
    }));

  const body = {
    model: args.model,
    messages: anthropicMessages,
    max_tokens: clampInteger(args.maxTokens, 1, 200000, 1024),
    ...optionalNumber("temperature", args.temperature),
    ...(system ? { system } : {}),
    ...(isPlainObject(args.extraBody) ? args.extraBody : {})
  };

  const raw = await postJson(`${baseUrl}/messages`, body, {
    "x-api-key": apiKey,
    "anthropic-version": process.env.ANTHROPIC_VERSION || "2023-06-01",
    ...safeHeaders(args.headers)
  }, timeoutMs, [apiKey], args);
  const text = Array.isArray(raw?.content)
    ? raw.content
        .filter((part) => part?.type === "text")
        .map((part) => part.text)
        .join("")
    : "";

  return {
    provider: "anthropic",
    model: args.model,
    baseUrl,
    text,
    usage: raw?.usage,
    raw
  };
}

async function callGoogle(args, messages, apiKey, timeoutMs) {
  args = await prepareGoogleArgs(args, timeoutMs);
  const maxContinuationRounds = args.autoContinue === false
    ? 0
    : clampInteger(args.maxContinuationRounds, 0, 10, 2);
  const texts = [];
  const responses = [];
  const finishReasons = [];
  let continuationRounds = 0;
  let currentArgs = args;
  let currentMessages = messages;
  let request = null;
  let shouldContinue = false;

  for (let round = 0; round <= maxContinuationRounds; round += 1) {
    request = buildGoogleRequest(currentArgs, currentMessages, apiKey);
    const raw = await postJson(request.url, request.body, request.headers, timeoutMs, [apiKey], currentArgs);
    const text = extractGoogleText(raw);
    const finishReason = raw?.candidates?.[0]?.finishReason ?? "UNKNOWN";

    texts.push(text);
    responses.push(raw);
    finishReasons.push(finishReason);
    shouldContinue = shouldContinueGoogle(raw, text, currentArgs);

    if (!shouldContinue || round >= maxContinuationRounds) {
      break;
    }

    continuationRounds += 1;
    currentMessages = buildContinuationMessages(messages, texts.join(""));
    currentArgs = {
      ...args,
      prompt: undefined,
      rawContents: undefined
    };
  }

  const text = texts.join("");
  const raw = responses.length === 1
    ? responses[0]
    : {
        responses,
        finishReasons
      };

  return {
    provider: "google",
    model: args.model,
    profileName: args.profileName,
    baseUrl: request?.baseUrl,
    text,
    usage: mergeGoogleUsage(responses),
    continuationRounds,
    finishReasons,
    possiblyTruncated: Boolean(shouldContinue && continuationRounds >= maxContinuationRounds),
    raw
  };
}

async function prepareGoogleArgs(args, timeoutMs) {
  if (Array.isArray(args.rawContents) && args.rawContents.length > 0 && hasImageInputs(args)) {
    throw rpcError(-32602, "imageInputs cannot be combined with rawContents. Put image parts directly in rawContents or remove rawContents.");
  }

  const prepared = {
    ...args
  };

  if (args.groundingMode === "google_search") {
    prepared.tools = ensureGoogleSearchTool(Array.isArray(args.tools) ? args.tools : args.googleTools);
    prepared.googleTools = undefined;
  }

  if (hasImageInputs(args)) {
    prepared.resolvedImageParts = await resolveImageParts(args.imageInputs, args, timeoutMs);
  }

  return prepared;
}

function ensureGoogleSearchTool(tools) {
  const normalizedTools = Array.isArray(tools) ? [...tools] : [];
  const hasGoogleSearch = normalizedTools.some((tool) => isPlainObject(tool) && (
    isPlainObject(tool.google_search) ||
    isPlainObject(tool.googleSearch)
  ));

  return hasGoogleSearch
    ? normalizedTools
    : [...normalizedTools, { google_search: {} }];
}

function hasImageInputs(args) {
  return Array.isArray(args.imageInputs) && args.imageInputs.length > 0;
}

function extractGoogleText(raw) {
  return Array.isArray(raw?.candidates?.[0]?.content?.parts)
    ? raw.candidates[0].content.parts.map((part) => part.text ?? "").join("")
    : "";
}

function shouldContinueGoogle(raw, text, args) {
  if (!text) {
    return false;
  }

  const finishReason = raw?.candidates?.[0]?.finishReason;
  if (finishReason === "MAX_TOKENS") {
    return true;
  }

  const maxOutputTokens = getGoogleMaxOutputTokens(args);
  const candidateTokens = raw?.usageMetadata?.candidatesTokenCount;

  return Number.isInteger(maxOutputTokens) &&
    Number.isInteger(candidateTokens) &&
    candidateTokens >= Math.floor(maxOutputTokens * 0.9);
}

function getGoogleMaxOutputTokens(args) {
  if (Number.isInteger(args.maxTokens)) {
    return args.maxTokens;
  }
  if (Number.isInteger(args.generationConfig?.maxOutputTokens)) {
    return args.generationConfig.maxOutputTokens;
  }

  return null;
}

function buildContinuationMessages(originalMessages, accumulatedText) {
  const systemMessages = originalMessages.filter((message) => message.role === "system");
  const nonSystemMessages = originalMessages.filter((message) => message.role !== "system");

  return [
    ...systemMessages,
    ...nonSystemMessages,
    {
      role: "assistant",
      content: accumulatedText
    },
    {
      role: "user",
      content: "请从上一条回答被中断的位置继续，只输出后续内容，不要重复已经输出的内容。"
    }
  ];
}

function mergeGoogleUsage(responses) {
  if (responses.length === 1) {
    return responses[0]?.usageMetadata;
  }

  return responses.reduce((merged, response) => {
    const usage = response?.usageMetadata;
    if (!usage) {
      return merged;
    }

    for (const [key, value] of Object.entries(usage)) {
      if (typeof value === "number") {
        merged[key] = (merged[key] ?? 0) + value;
      }
    }

    return merged;
  }, {});
}

export function buildGoogleRequest(args, messages, apiKey) {
  const baseUrl = trimTrailingSlash(args.baseUrl || process.env.GOOGLE_AI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta");
  const modelPath = toGoogleModelPath(args.model);
  const body = buildGoogleBody(args, messages);

  return {
    baseUrl,
    url: `${baseUrl}/${encodePathPreservingSlash(modelPath)}:generateContent`,
    headers: {
      "x-goog-api-key": apiKey,
      ...safeHeaders(args.headers)
    },
    body
  };
}

export function buildGoogleBody(args, messages) {
  const systemText = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  const body = {
    contents: buildGoogleContents(args, messages)
  };
  const systemInstruction = normalizeGoogleSystemInstruction(args.systemInstruction, systemText);
  const generationConfig = buildGoogleGenerationConfig(args);

  if (systemInstruction) {
    body.systemInstruction = systemInstruction;
  }
  if (Object.keys(generationConfig).length > 0) {
    body.generationConfig = generationConfig;
  }
  if (Array.isArray(args.safetySettings)) {
    body.safetySettings = args.safetySettings;
  }
  const geminiTools = Array.isArray(args.tools) ? args.tools : args.googleTools;
  if (Array.isArray(geminiTools)) {
    body.tools = geminiTools;
  }
  if (isPlainObject(args.toolConfig)) {
    body.toolConfig = args.toolConfig;
  }
  if (typeof args.cachedContent === "string" && args.cachedContent.trim()) {
    body.cachedContent = args.cachedContent.trim();
  }

  return {
    ...body,
    ...(isPlainObject(args.extraBody) ? args.extraBody : {})
  };
}

function buildGoogleContents(args, messages) {
  if (Array.isArray(args.rawContents) && args.rawContents.length > 0) {
    return args.rawContents;
  }

  const nonSystemMessages = messages.filter((message) => message.role !== "system");
  const lastUserIndex = findLastIndex(nonSystemMessages, (message) => message.role !== "assistant");
  const imageParts = Array.isArray(args.resolvedImageParts) ? args.resolvedImageParts : [];

  return nonSystemMessages.map((message, index) => {
    const parts = [{ text: message.content }];
    if (index === lastUserIndex && imageParts.length) {
      parts.unshift(...imageParts);
    }

    return {
      role: message.role === "assistant" ? "model" : "user",
      parts
    };
  });
}

function normalizeGoogleSystemInstruction(systemInstruction, fallbackText) {
  if (typeof systemInstruction === "string" && systemInstruction.trim()) {
    return {
      parts: [{ text: systemInstruction.trim() }]
    };
  }

  if (isPlainObject(systemInstruction)) {
    return systemInstruction;
  }

  if (fallbackText) {
    return {
      parts: [{ text: fallbackText }]
    };
  }

  return null;
}

function buildGoogleGenerationConfig(args) {
  const generationConfig = {
    ...(isPlainObject(args.generationConfig) ? args.generationConfig : {})
  };

  if (typeof args.temperature === "number" && Number.isFinite(args.temperature)) {
    generationConfig.temperature = args.temperature;
  }
  if (Number.isInteger(args.maxTokens)) {
    generationConfig.maxOutputTokens = args.maxTokens;
  }
  if (typeof args.thinkingLevel === "string" && args.thinkingLevel.trim()) {
    generationConfig.thinkingConfig = {
      ...(isPlainObject(generationConfig.thinkingConfig) ? generationConfig.thinkingConfig : {}),
      thinkingLevel: args.thinkingLevel.trim()
    };
  }

  return generationConfig;
}

async function resolveImageParts(imageInputs, args, timeoutMs) {
  if (!Array.isArray(imageInputs)) {
    return [];
  }

  const maxImages = clampInteger(args.maxImages, 1, 16, DEFAULT_MAX_IMAGES);
  const maxImageBytes = clampInteger(args.maxImageBytes, 1024, 100 * 1024 * 1024, DEFAULT_MAX_IMAGE_BYTES);

  if (imageInputs.length > maxImages) {
    throw rpcError(-32602, `imageInputs supports at most ${maxImages} image(s).`);
  }

  const parts = [];
  for (let index = 0; index < imageInputs.length; index += 1) {
    const input = imageInputs[index];
    if (!isPlainObject(input)) {
      throw rpcError(-32602, `imageInputs[${index}] must be an object.`);
    }
    parts.push(await resolveImagePart(input, index, maxImageBytes, timeoutMs));
  }

  return parts;
}

async function resolveImagePart(input, index, maxImageBytes, timeoutMs) {
  const hasPath = typeof input.path === "string" && input.path.trim();
  const hasUrl = typeof input.url === "string" && input.url.trim();

  if (hasPath === hasUrl) {
    throw rpcError(-32602, `imageInputs[${index}] must provide exactly one of path or url.`);
  }

  if (hasPath) {
    const filePath = resolve(input.path.trim());
    const bytes = readFileSync(filePath);
    assertImageSize(bytes.length, maxImageBytes, `imageInputs[${index}]`);
    const mimeType = normalizeImageMimeType(input.mimeType, filePath);
    return inlineImagePart(bytes, mimeType);
  }

  return downloadImagePart(input.url.trim(), input.mimeType, index, maxImageBytes, timeoutMs);
}

async function downloadImagePart(urlText, explicitMimeType, index, maxImageBytes, timeoutMs) {
  let url;
  try {
    url = new URL(urlText);
  } catch {
    throw rpcError(-32602, `imageInputs[${index}].url must be a valid URL.`);
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw rpcError(-32602, `imageInputs[${index}].url must use http or https.`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const contentLength = Number.parseInt(response.headers.get("content-length") ?? "", 10);
    if (Number.isInteger(contentLength)) {
      assertImageSize(contentLength, maxImageBytes, `imageInputs[${index}]`);
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    assertImageSize(bytes.length, maxImageBytes, `imageInputs[${index}]`);
    const mimeType = normalizeImageMimeType(explicitMimeType || response.headers.get("content-type"), url.pathname);
    return inlineImagePart(bytes, mimeType);
  } catch (error) {
    if (error?.name === "AbortError") {
      throw rpcError(-32603, `Timed out downloading imageInputs[${index}] after ${timeoutMs} ms.`);
    }
    throw rpcError(-32603, `Could not download imageInputs[${index}]: ${error?.message ?? "Unknown error"}`);
  } finally {
    clearTimeout(timer);
  }
}

function inlineImagePart(bytes, mimeType) {
  return {
    inline_data: {
      mime_type: mimeType,
      data: Buffer.from(bytes).toString("base64")
    }
  };
}

function assertImageSize(byteLength, maxImageBytes, label) {
  if (byteLength > maxImageBytes) {
    throw rpcError(-32602, `${label} is ${byteLength} bytes, above maxImageBytes ${maxImageBytes}.`);
  }
}

function normalizeImageMimeType(value, pathHint) {
  const explicit = typeof value === "string"
    ? value.split(";")[0].trim().toLowerCase()
    : "";
  const mimeType = explicit || mimeTypeFromPath(pathHint);

  if (!["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"].includes(mimeType)) {
    throw rpcError(-32602, `Unsupported image MIME type '${mimeType || "unknown"}'. Supported types: image/png, image/jpeg, image/webp, image/heic, image/heif.`);
  }

  return mimeType;
}

function mimeTypeFromPath(pathHint) {
  switch (extname(pathHint || "").toLowerCase()) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".heic":
      return "image/heic";
    case ".heif":
      return "image/heif";
    default:
      return "";
  }
}

function handleConfigGet() {
  const config = readConfigStore();
  const result = publicConfig(config);

  return textResult(JSON.stringify(result, null, 2), result);
}

function handleConfigSetDefaultProfile(args) {
  const profileName = normalizeProfileName(args.profileName);
  const config = readConfigStore();
  ensureConfigWritable(config);

  if (!config.profiles[profileName]) {
    throw rpcError(-32602, `Profile '${profileName}' was not found.`);
  }

  config.defaultProfile = profileName;
  writeConfigStore(config);

  const result = publicConfig(config);
  return textResult(`Default profile set to '${profileName}'.`, result);
}

function handleProfileSet(args) {
  const name = normalizeProfileName(args.name);
  const config = readConfigStore();
  ensureConfigWritable(config);
  const existing = config.profiles[name] ?? {};
  const profile = sanitizeProfile({
    ...existing,
    ...pickDefinedProfileFields(args)
  });

  config.profiles[name] = profile;
  if (args.setDefault === true) {
    config.defaultProfile = name;
  }
  writeConfigStore(config);

  const result = {
    profileName: name,
    profile: publicProfile(profile),
    defaultProfile: config.defaultProfile
  };
  return textResult(JSON.stringify(result, null, 2), result);
}

function handleProfileDelete(args) {
  const name = normalizeProfileName(args.name);
  const config = readConfigStore();
  ensureConfigWritable(config);
  const deleted = Boolean(config.profiles[name]);

  if (name === DEFAULT_PROFILE_NAME || name === GROUNDED_PROFILE_NAME) {
    throw rpcError(-32602, `Profile '${name}' is built in and cannot be deleted.`);
  }
  if (["gemini-grounded-lite", "gemini-grounded-20-flash"].includes(name)) {
    throw rpcError(-32602, `Profile '${name}' is built in and cannot be deleted.`);
  }
  if (deleted) {
    delete config.profiles[name];
    if (config.defaultProfile === name) {
      config.defaultProfile = DEFAULT_PROFILE_NAME;
    }
    writeConfigStore(config);
  }

  return textResult(deleted ? `Deleted profile '${name}'.` : `Profile '${name}' did not exist.`, {
    deleted,
    defaultProfile: config.defaultProfile
  });
}

function handleProfileList() {
  const config = readConfigStore();
  const profiles = Object.entries(config.profiles)
    .map(([name, profile]) => ({
      name,
      ...publicProfile(profile)
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
  const result = {
    defaultProfile: config.defaultProfile,
    profiles
  };

  return textResult(JSON.stringify(result, null, 2), result);
}

function resolveCallArgs(args) {
  const config = readConfigStore();
  const explicitArgs = removeUndefined(args);
  const requestedProfile = typeof args.profileName === "string" && args.profileName.trim()
    ? normalizeProfileName(args.profileName)
    : config.defaultProfile;
  const profile = config.profiles[requestedProfile];

  if (!profile) {
    throw rpcError(-32602, `Profile '${requestedProfile}' was not found.`);
  }

  const merged = removeUndefined({
    outputMetaFooter: config.outputMetaFooter,
    ...profile,
    ...explicitArgs,
    profileName: requestedProfile,
    configWarning: config.configWarning
  });

  if (explicitArgs.provider && profile.provider && explicitArgs.provider !== profile.provider) {
    for (const providerSpecificField of ["model", "secretName", "apiKeyEnv", "baseUrl"]) {
      if (!Object.prototype.hasOwnProperty.call(explicitArgs, providerSpecificField)) {
        delete merged[providerSpecificField];
      }
    }
  }

  const normalized = normalizeDelegationArgs(merged);

  if (shouldAutoSwitchToGroundedProfile(normalized, explicitArgs)) {
    return resolveGroundedCallArgs(config, explicitArgs);
  }

  return normalized;
}

function resolveGroundedCallArgs(config, explicitArgs) {
  const groundedProfileName = normalizeProfileName(config.groundedProfileName ?? GROUNDED_PROFILE_NAME);
  const groundedProfile = config.profiles[groundedProfileName] ?? (
    groundedProfileName === GROUNDED_PROFILE_NAME ? DEFAULT_GROUNDED_PROFILE : null
  );

  if (!groundedProfile) {
    throw rpcError(-32602, `Grounded profile '${groundedProfileName}' was not found.`);
  }

  return normalizeDelegationArgs(removeUndefined({
    outputMetaFooter: config.outputMetaFooter,
    ...groundedProfile,
    ...explicitArgs,
    profileName: groundedProfileName,
    groundingMode: "google_search",
    configWarning: config.configWarning
  }));
}

function shouldAutoSwitchToGroundedProfile(args, explicitArgs) {
  if (args.groundingMode !== "google_search") {
    return false;
  }

  return !explicitArgs.profileName &&
    !explicitArgs.provider &&
    !explicitArgs.model &&
    !explicitArgs.baseUrl;
}

function readConfigStore() {
  const configPath = getConfigPath();
  const defaults = defaultConfigStore();

  if (!existsSync(configPath)) {
    return defaults;
  }

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(configPath, "utf8"));
    if (!isPlainObject(parsed)) {
      throw new Error("Config store must be a JSON object.");
    }
    return normalizeConfigStore(parsed, defaults);
  } catch (error) {
    return configStoreWithWarning(defaults, configPath, error);
  }
}

function configStoreWithWarning(defaults, configPath, error) {
  return {
    ...defaults,
    configWarning: {
      configPath,
      message: `config.json 格式错误，已使用默认配置。${error?.message ?? "Unknown error"}`
    }
  };
}

function ensureConfigWritable(config) {
  if (config.configWarning) {
    throw rpcError(-32603, `${config.configWarning.message} 请先手动修复 config.json；插件不会覆盖损坏的配置文件。`);
  }
}

function writeConfigStore(config) {
  const configPath = getConfigPath();
  mkdirSync(dirname(configPath), { recursive: true });
  const tempPath = `${configPath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(publicConfigForStorage(config), null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  renameSync(tempPath, configPath);
}

function defaultConfigStore() {
  return {
    version: CONFIG_STORE_VERSION,
    defaultProfile: DEFAULT_PROFILE_NAME,
    groundedProfileName: GROUNDED_PROFILE_NAME,
    outputMetaFooter: true,
    profiles: {
      [DEFAULT_PROFILE_NAME]: { ...DEFAULT_PROFILE },
      [GROUNDED_PROFILE_NAME]: { ...DEFAULT_GROUNDED_PROFILE },
      "gemini-grounded-lite": { ...DEFAULT_GROUNDED_LITE_PROFILE },
      "gemini-grounded-20-flash": { ...DEFAULT_GROUNDED_20_FLASH_PROFILE }
    }
  };
}

function normalizeConfigStore(parsed, defaults) {
  const profiles = {
    ...defaults.profiles
  };

  if (isPlainObject(parsed.profiles)) {
    for (const [name, profile] of Object.entries(parsed.profiles)) {
      if (!isPlainObject(profile)) {
        continue;
      }
      profiles[normalizeProfileName(name)] = sanitizeProfile(profile);
    }
  }
  normalizeBuiltInGroundedProfiles(profiles);

  const defaultProfile = typeof parsed.defaultProfile === "string" && profiles[parsed.defaultProfile]
    ? parsed.defaultProfile
    : defaults.defaultProfile;
  const groundedProfileName = typeof parsed.groundedProfileName === "string" && parsed.groundedProfileName.trim()
    ? normalizeProfileName(parsed.groundedProfileName)
    : defaults.groundedProfileName;

  return {
    version: parsed.version ?? CONFIG_STORE_VERSION,
    defaultProfile,
    groundedProfileName,
    outputMetaFooter: typeof parsed.outputMetaFooter === "boolean" ? parsed.outputMetaFooter : defaults.outputMetaFooter,
    profiles
  };
}

function normalizeBuiltInGroundedProfiles(profiles) {
  profiles[GROUNDED_PROFILE_NAME] = normalizeBuiltInGroundedProfile(
    profiles[GROUNDED_PROFILE_NAME],
    DEFAULT_GROUNDED_PROFILE
  );
  profiles["gemini-grounded-lite"] = normalizeBuiltInGroundedProfile(
    profiles["gemini-grounded-lite"],
    DEFAULT_GROUNDED_LITE_PROFILE
  );
  profiles["gemini-grounded-20-flash"] = normalizeBuiltInGroundedProfile(
    profiles["gemini-grounded-20-flash"],
    DEFAULT_GROUNDED_20_FLASH_PROFILE
  );
}

function normalizeBuiltInGroundedProfile(profile, defaults) {
  const merged = {
    ...defaults,
    ...profile,
    provider: "google",
    secretName: profile?.secretName ?? defaults.secretName,
    groundingMode: "google_search"
  };

  if (merged.model === "gemini-3-flash-preview") {
    merged.model = defaults.model;
  }

  if (defaults.fallbackProfiles && !Array.isArray(merged.fallbackProfiles)) {
    merged.fallbackProfiles = defaults.fallbackProfiles;
  }
  delete merged.thinkingLevel;
  if (isPlainObject(merged.generationConfig) && isPlainObject(merged.generationConfig.thinkingConfig)) {
    merged.generationConfig = {
      ...merged.generationConfig
    };
    delete merged.generationConfig.thinkingConfig;
  }

  return merged;
}

function publicConfig(config) {
  return {
    version: config.version,
    defaultProfile: config.defaultProfile,
    groundedProfileName: config.groundedProfileName,
    outputMetaFooter: config.outputMetaFooter,
    configPath: getConfigPath(),
    configWarning: config.configWarning,
    profiles: Object.fromEntries(
      Object.entries(config.profiles).map(([name, profile]) => [name, publicProfile(profile)])
    )
  };
}

function publicConfigForStorage(config) {
  return {
    version: config.version ?? CONFIG_STORE_VERSION,
    defaultProfile: config.defaultProfile,
    groundedProfileName: config.groundedProfileName ?? GROUNDED_PROFILE_NAME,
    outputMetaFooter: typeof config.outputMetaFooter === "boolean" ? config.outputMetaFooter : true,
    profiles: Object.fromEntries(
      Object.entries(config.profiles).map(([name, profile]) => [name, sanitizeProfile(profile)])
    )
  };
}

function publicProfile(profile) {
  return sanitizeProfile(profile);
}

function sanitizeProfile(profile) {
  const clean = pickDefinedProfileFields(profile);

  if (clean.provider && !["openai-compatible", "anthropic", "google"].includes(clean.provider)) {
    throw rpcError(-32602, `Unsupported provider in profile: ${clean.provider}`);
  }
  if (clean.secretName) {
    clean.secretName = normalizeSecretName(clean.secretName);
  }
  if (clean.fallbackProfileName) {
    clean.fallbackProfileName = normalizeProfileName(clean.fallbackProfileName);
  }
  if (Array.isArray(clean.fallbackProfiles)) {
    clean.fallbackProfiles = [...new Set(clean.fallbackProfiles.map((name) => normalizeProfileName(name)))];
  }
  if (clean.apiKey || clean.masterKey) {
    throw rpcError(-32602, "Profiles must not store plaintext apiKey or masterKey.");
  }

  return clean;
}

function pickDefinedProfileFields(source) {
  return removeUndefined({
    provider: optionalTrimmedString(source.provider),
    model: optionalTrimmedString(source.model),
    secretName: optionalTrimmedString(source.secretName),
    apiKeyEnv: optionalTrimmedString(source.apiKeyEnv),
    baseUrl: optionalTrimmedString(source.baseUrl),
    executionMode: optionalTrimmedString(source.executionMode),
    groundingMode: optionalTrimmedString(source.groundingMode),
    inputSource: optionalTrimmedString(source.inputSource),
    strictDelegation: typeof source.strictDelegation === "boolean" ? source.strictDelegation : undefined,
    maxImages: Number.isInteger(source.maxImages) ? source.maxImages : undefined,
    maxImageBytes: Number.isInteger(source.maxImageBytes) ? source.maxImageBytes : undefined,
    timeoutMs: Number.isInteger(source.timeoutMs) ? source.timeoutMs : undefined,
    temperature: typeof source.temperature === "number" && Number.isFinite(source.temperature) ? source.temperature : undefined,
    maxTokens: Number.isInteger(source.maxTokens) ? source.maxTokens : undefined,
    thinkingLevel: optionalTrimmedString(source.thinkingLevel),
    systemInstruction: typeof source.systemInstruction === "string"
      ? optionalTrimmedString(source.systemInstruction)
      : isPlainObject(source.systemInstruction) ? source.systemInstruction : undefined,
    generationConfig: isPlainObject(source.generationConfig) ? source.generationConfig : undefined,
    safetySettings: Array.isArray(source.safetySettings) ? source.safetySettings : undefined,
    tools: Array.isArray(source.tools) ? source.tools : undefined,
    toolConfig: isPlainObject(source.toolConfig) ? source.toolConfig : undefined,
    cachedContent: optionalTrimmedString(source.cachedContent),
    headers: isPlainObject(source.headers) ? safeProfileHeaders(source.headers) : undefined,
    extraBody: isPlainObject(source.extraBody) ? source.extraBody : undefined,
    autoContinue: typeof source.autoContinue === "boolean" ? source.autoContinue : undefined,
    maxContinuationRounds: Number.isInteger(source.maxContinuationRounds) ? source.maxContinuationRounds : undefined,
    outputMetaFooter: typeof source.outputMetaFooter === "boolean" ? source.outputMetaFooter : undefined,
    fallbackProfileName: optionalTrimmedString(source.fallbackProfileName),
    fallbackProfiles: Array.isArray(source.fallbackProfiles)
      ? source.fallbackProfiles.map(optionalTrimmedString).filter(Boolean)
      : undefined
  });
}

function normalizeDelegationArgs(source) {
  const args = { ...source };

  args.executionMode = normalizeEnumValue(args.executionMode, EXECUTION_MODES, "executionMode", "raw");
  args.groundingMode = normalizeEnumValue(args.groundingMode, GROUNDING_MODES, "groundingMode", "off");
  args.inputSource = normalizeEnumValue(args.inputSource, INPUT_SOURCES, "inputSource", "direct");
  args.strictDelegation = args.strictDelegation !== false;
  args.maxImages = clampInteger(args.maxImages, 1, 16, DEFAULT_MAX_IMAGES);
  args.maxImageBytes = clampInteger(args.maxImageBytes, 1024, 100 * 1024 * 1024, DEFAULT_MAX_IMAGE_BYTES);

  return args;
}

function normalizeEnumValue(value, allowed, name, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  if (typeof value !== "string" || !allowed.has(value)) {
    throw rpcError(-32602, `${name} must be one of: ${[...allowed].join(", ")}.`);
  }
  return value;
}

function normalizeFallbackProfileNames(source) {
  const names = [];

  if (source.fallbackProfileName) {
    names.push(source.fallbackProfileName);
  }
  if (Array.isArray(source.fallbackProfiles)) {
    names.push(...source.fallbackProfiles);
  }

  return [...new Set(names.map((name) => normalizeProfileName(name)))];
}

function normalizeProfileName(name) {
  requireString(name, "profileName");
  const normalized = name.trim();

  if (!/^[A-Za-z0-9_.-]{1,128}$/.test(normalized)) {
    throw rpcError(-32602, "Profile name must be 1-128 characters and contain only letters, numbers, dots, underscores, or hyphens.");
  }

  return normalized;
}

function getConfigPath() {
  return process.env.CODEX_GEMINI_LLMCALLER_CONFIG_PATH ||
    process.env.MULTI_MODEL_CONFIG_PATH ||
    DEFAULT_CONFIG_PATH;
}

function handleSecretSet(args) {
  const name = normalizeSecretName(args.name);
  const apiKey = resolveSecretSetApiKey(args);
  const protection = resolveSecretProtection(args);
  const masterKey = protection === "passphrase" ? resolveMasterKey(args) : null;
  const store = readSecretsStore();
  const overwrite = args.overwrite !== false;

  if (!overwrite && store.secrets[name]) {
    throw rpcError(-32602, `Secret '${name}' already exists.`);
  }

  const now = new Date().toISOString();
  const encrypted = protection === "passphrase"
    ? encryptSecretValue(apiKey, masterKey)
    : encryptSecretValueLocalUser(apiKey);
  const existing = store.secrets[name];

  store.secrets[name] = {
    version: 1,
    name,
    provider: optionalTrimmedString(args.provider),
    baseUrl: optionalTrimmedString(args.baseUrl),
    model: optionalTrimmedString(args.model),
    fingerprint: fingerprintSecret(apiKey),
    keyPreview: maskSecret(apiKey),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    encrypted
  };
  writeSecretsStore(store);

  const result = publicSecretRecord(store.secrets[name]);
  return textResult(`Stored encrypted secret '${name}'.`, {
    stored: true,
    secret: result
  });
}

function resolveSecretSetApiKey(args) {
  if (typeof args.apiKeyEnv === "string" && args.apiKeyEnv.trim()) {
    const envName = args.apiKeyEnv.trim();
    const value = process.env[envName];
    if (!value) {
      throw rpcError(-32602, `Environment variable ${envName} is not set.`);
    }
    return value.trim();
  }

  if (typeof args.apiKey === "string" && args.apiKey.trim()) {
    return args.apiKey.trim();
  }

  throw rpcError(-32602, "An API key is required. Use apiKeyEnv, the local secret-import script, or inline apiKey only for low-risk local testing.");
}

function resolveSecretProtection(args) {
  if (args.protection === "local-user") {
    return "local-user";
  }
  if (args.protection === "passphrase") {
    return "passphrase";
  }
  if (
    (typeof args.masterKey === "string" && args.masterKey.trim()) ||
    (typeof args.masterKeyEnv === "string" && args.masterKeyEnv.trim()) ||
    process.env.CODEX_GEMINI_LLMCALLER_MASTER_KEY ||
    process.env.MULTI_MODEL_MASTER_KEY
  ) {
    return "passphrase";
  }

  return "local-user";
}

function handleSecretGet(args) {
  const name = normalizeSecretName(args.name);
  const record = getSecretRecord(name);
  const apiKey = decryptSecretRecord(record, resolveMasterKeyForRecord(args, record), name);
  const result = {
    ...publicSecretRecord(record),
    canDecrypt: true,
    keyPreview: maskSecret(apiKey)
  };

  return textResult(JSON.stringify(result, null, 2), result);
}

function handleSecretMigrateLocalUser(args) {
  const name = normalizeSecretName(args.name);
  const result = migrateSecretToLocalUser(name, resolveMasterKey(args));

  return textResult(`Migrated secret '${name}' to local-user protection.`, {
    migrated: true,
    secret: result
  });
}

function handleSecretDelete(args) {
  const name = normalizeSecretName(args.name);
  const store = readSecretsStore();
  const deleted = Boolean(store.secrets[name]);

  if (deleted) {
    delete store.secrets[name];
    writeSecretsStore(store);
  }

  return textResult(deleted ? `Deleted secret '${name}'.` : `Secret '${name}' did not exist.`, {
    deleted,
    name
  });
}

function handleSecretList() {
  const store = readSecretsStore();
  const secrets = Object.values(store.secrets)
    .map(publicSecretRecord)
    .sort((left, right) => left.name.localeCompare(right.name));

  return textResult(JSON.stringify({ secrets }, null, 2), { secrets });
}

function resolveApiKey(args) {
  if (typeof args.apiKey === "string" && args.apiKey.trim()) {
    return args.apiKey.trim();
  }

  if (typeof args.apiKeyEnv === "string" && args.apiKeyEnv.trim()) {
    const envName = args.apiKeyEnv.trim();
    const value = process.env[envName];
    if (!value) {
      throw rpcError(-32602, `Environment variable ${envName} is not set.`);
    }
    return value;
  }

  if (typeof args.secretName === "string" && args.secretName.trim()) {
    const name = normalizeSecretName(args.secretName);
    const record = getSecretRecord(name);
    return decryptSecretRecord(record, resolveMasterKeyForRecord(args, record), name);
  }

  const envNamesByProvider = {
    "openai-compatible": [
      "CODEX_GEMINI_LLMCALLER_API_KEY",
      "MULTI_MODEL_API_KEY",
      "OPENAI_API_KEY",
      "OPENROUTER_API_KEY",
      "DEEPSEEK_API_KEY",
      "GROQ_API_KEY",
      "MISTRAL_API_KEY",
      "XAI_API_KEY"
    ],
    anthropic: ["ANTHROPIC_API_KEY", "CODEX_GEMINI_LLMCALLER_API_KEY", "MULTI_MODEL_API_KEY"],
    google: ["GEMINI_API_KEY", "GOOGLE_API_KEY", "CODEX_GEMINI_LLMCALLER_API_KEY", "MULTI_MODEL_API_KEY"]
  };
  const envNames = envNamesByProvider[args.provider] ?? ["CODEX_GEMINI_LLMCALLER_API_KEY", "MULTI_MODEL_API_KEY"];
  const envName = envNames.find((name) => process.env[name]);

  if (!envName) {
    throw rpcError(-32602, `No API key found. Pass apiKey, apiKeyEnv, secretName, or set one of: ${envNames.join(", ")}.`);
  }

  return process.env[envName];
}

export function encryptSecretValue(secretValue, masterKey) {
  requireString(secretValue, "secretValue");
  requireString(masterKey, "masterKey");

  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(masterKey, salt, 32);
  const cipher = createCipheriv(SECRET_ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(secretValue, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    protection: "passphrase",
    algorithm: SECRET_ALGORITHM,
    kdf: SECRET_KDF,
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64")
  };
}

export function encryptSecretValueLocalUser(secretValue) {
  requireString(secretValue, "secretValue");
  const ciphertext = runDpapiPowerShell("protect", secretValue);

  return {
    protection: LOCAL_USER_PROTECTION,
    algorithm: "windows-dpapi",
    ciphertext
  };
}

export function decryptSecretValue(encrypted, masterKey) {
  if (isLocalUserEncryptedSecret(encrypted)) {
    return decryptSecretValueLocalUser(encrypted);
  }

  requireString(masterKey, "masterKey");
  if (!isPlainObject(encrypted) || encrypted.algorithm !== SECRET_ALGORITHM || encrypted.kdf !== SECRET_KDF) {
    throw new Error("Unsupported encrypted secret format.");
  }

  const salt = Buffer.from(encrypted.salt, "base64");
  const iv = Buffer.from(encrypted.iv, "base64");
  const tag = Buffer.from(encrypted.tag, "base64");
  const ciphertext = Buffer.from(encrypted.ciphertext, "base64");
  const key = scryptSync(masterKey, salt, 32);
  const decipher = createDecipheriv(SECRET_ALGORITHM, key, iv);

  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function decryptSecretValueLocalUser(encrypted) {
  if (!isLocalUserEncryptedSecret(encrypted)) {
    throw new Error("Unsupported local-user encrypted secret format.");
  }

  return runDpapiPowerShell("unprotect", encrypted.ciphertext);
}

export function migrateSecretToLocalUser(name, masterKey) {
  const normalizedName = normalizeSecretName(name);
  const store = readSecretsStore();
  const record = store.secrets[normalizedName];

  if (!record) {
    throw rpcError(-32602, `Secret '${normalizedName}' was not found.`);
  }
  if (isLocalUserEncryptedSecret(record.encrypted)) {
    return publicSecretRecord(record);
  }

  const apiKey = decryptSecretRecord(record, masterKey, normalizedName);
  record.encrypted = encryptSecretValueLocalUser(apiKey);
  record.updatedAt = new Date().toISOString();
  store.secrets[normalizedName] = record;
  writeSecretsStore(store);

  return publicSecretRecord(record);
}

function decryptSecretRecord(record, masterKey, name) {
  try {
    return decryptSecretValue(record.encrypted, masterKey);
  } catch {
    throw rpcError(-32602, `Secret '${name}' could not be decrypted. Check masterKey, CODEX_GEMINI_LLMCALLER_MASTER_KEY, or MULTI_MODEL_MASTER_KEY.`);
  }
}

function readSecretsStore() {
  const secretsPath = getSecretsPath();

  if (!existsSync(secretsPath)) {
    return emptySecretsStore();
  }

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(secretsPath, "utf8"));
  } catch (error) {
    throw rpcError(-32603, `Could not read secrets store: ${error.message}`);
  }

  if (!isPlainObject(parsed) || !isPlainObject(parsed.secrets)) {
    throw rpcError(-32603, "Secrets store is invalid.");
  }

  return {
    version: parsed.version ?? SECRET_STORE_VERSION,
    secrets: parsed.secrets
  };
}

function writeSecretsStore(store) {
  const secretsPath = getSecretsPath();
  mkdirSync(dirname(secretsPath), { recursive: true });
  const tempPath = `${secretsPath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(store, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  renameSync(tempPath, secretsPath);
}

function emptySecretsStore() {
  return {
    version: SECRET_STORE_VERSION,
    secrets: {}
  };
}

function getSecretRecord(name) {
  const store = readSecretsStore();
  const record = store.secrets[name];

  if (!record) {
    throw rpcError(-32602, `Secret '${name}' was not found.`);
  }

  return record;
}

function getSecretsPath() {
  return process.env.CODEX_GEMINI_LLMCALLER_SECRETS_PATH ||
    process.env.MULTI_MODEL_SECRETS_PATH ||
    DEFAULT_SECRETS_PATH;
}

export function getStorePathsForTesting() {
  return {
    configPath: getConfigPath(),
    secretsPath: getSecretsPath()
  };
}

function resolveMasterKeyForRecord(args, record) {
  if (isLocalUserEncryptedSecret(record?.encrypted)) {
    return null;
  }

  return resolveMasterKey(args);
}

function resolveMasterKey(args) {
  if (typeof args.masterKeyEnv === "string" && args.masterKeyEnv.trim()) {
    const envName = args.masterKeyEnv.trim();
    const value = process.env[envName];
    if (!value) {
      throw rpcError(-32602, `Environment variable ${envName} is not set.`);
    }
    return value;
  }

  if (typeof args.masterKey === "string" && args.masterKey.trim()) {
    return args.masterKey;
  }

  if (process.env.CODEX_GEMINI_LLMCALLER_MASTER_KEY) {
    return process.env.CODEX_GEMINI_LLMCALLER_MASTER_KEY;
  }

  if (process.env.MULTI_MODEL_MASTER_KEY) {
    return process.env.MULTI_MODEL_MASTER_KEY;
  }

  throw rpcError(-32602, "A master key is required for this passphrase-protected secret. Pass masterKey, masterKeyEnv, or set CODEX_GEMINI_LLMCALLER_MASTER_KEY.");
}

function normalizeSecretName(name) {
  requireString(name, "name");
  const normalized = name.trim();

  if (!/^[A-Za-z0-9_.-]{1,128}$/.test(normalized)) {
    throw rpcError(-32602, "Secret name must be 1-128 characters and contain only letters, numbers, dots, underscores, or hyphens.");
  }

  return normalized;
}

function publicSecretRecord(record) {
  return {
    name: record.name,
    provider: record.provider,
    baseUrl: record.baseUrl,
    model: record.model,
    fingerprint: record.fingerprint,
    keyPreview: record.keyPreview,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    protection: record.encrypted?.protection ?? "passphrase",
    algorithm: record.encrypted?.algorithm,
    kdf: record.encrypted?.kdf
  };
}

function isLocalUserEncryptedSecret(encrypted) {
  return isPlainObject(encrypted) && (
    encrypted.protection === LOCAL_USER_PROTECTION ||
    encrypted.algorithm === "windows-dpapi"
  );
}

function runDpapiPowerShell(mode, input) {
  if (process.platform !== "win32") {
    throw new Error("local-user secret protection is currently supported only on Windows.");
  }

  const script = mode === "protect"
    ? [
        "$ErrorActionPreference = 'Stop'",
        "$plain = [Console]::In.ReadToEnd()",
        "$secure = ConvertTo-SecureString -String $plain -AsPlainText -Force",
        "ConvertFrom-SecureString -SecureString $secure"
      ].join("; ")
    : [
        "$ErrorActionPreference = 'Stop'",
        "$blob = [Console]::In.ReadToEnd()",
        "$secure = ConvertTo-SecureString -String $blob",
        "$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)",
        "try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }"
      ].join("; ");
  const result = spawnSync("powershell.exe", [
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    script
  ], {
    input,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 1024 * 1024
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim();
    throw new Error(`Windows local-user secret protection failed${detail ? `: ${detail}` : "."}`);
  }

  return String(result.stdout).replace(/\r?\n$/, "");
}

function maskSecret(value) {
  if (!value) {
    return "";
  }

  if (value.length <= 8) {
    return `${value.slice(0, 1)}...${value.slice(-1)}`;
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function fingerprintSecret(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

async function postJson(url, body, headers, timeoutMs, secretValues = [], callArgs = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...headers
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const text = await response.text();
    const payload = parseJsonOrText(text);

    if (!response.ok) {
      const detail = typeof payload === "string" ? payload : JSON.stringify(payload);
      throw new Error(redactSensitive(formatHttpErrorMessage(response, detail, callArgs), secretValues));
    }

    return payload;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs} ms.`);
    }
    if (shouldUsePowerShellHttpFallback(error)) {
      return postJsonViaPowerShell(url, body, headers, timeoutMs, secretValues, callArgs);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function formatHttpErrorMessage(response, detail, callArgs = {}) {
  const base = `HTTP ${response.status} ${response.statusText}: ${detail}`;

  if (response.status === 429 && callArgs.provider === "google" && callArgs.groundingMode === "google_search") {
    return [
      base,
      "Gemini Google Search grounding returned 429 RESOURCE_EXHAUSTED. This usually means the API key or Google Cloud project hit a Search grounding quota/rate limit, not that local API key decryption failed.",
      "Recommended actions: wait for quota recovery, reduce grounded calls, check AI Studio/Google Cloud billing and quota, or switch the grounded profile to gemini-2.5-flash / gemini-2.5-flash-lite / gemini-2.0-flash."
    ].join("\n");
  }

  if (response.status === 429) {
    return [
      base,
      "The provider returned 429 RESOURCE_EXHAUSTED or rate limited. Retry after the quota window recovers, reduce request frequency, or switch to a fallback profile."
    ].join("\n");
  }

  return base;
}

function shouldUsePowerShellHttpFallback(error) {
  return process.platform === "win32" && (
    error?.message === "fetch failed" ||
    error?.cause?.code === "UND_ERR_CONNECT_TIMEOUT" ||
    error?.cause?.code === "ECONNRESET" ||
    error?.cause?.code === "ETIMEDOUT"
  );
}

function postJsonViaPowerShell(url, body, headers, timeoutMs, secretValues, callArgs = {}) {
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "$encoded = [Console]::In.ReadToEnd()",
    "$json = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($encoded))",
    "$payload = $json | ConvertFrom-Json",
    "$headers = @{}",
    "foreach ($property in $payload.headers.PSObject.Properties) { $headers[$property.Name] = [string]$property.Value }",
    "$bodyBytes = [Convert]::FromBase64String($payload.bodyBase64)",
    "try {",
    "  $response = Invoke-WebRequest -Uri $payload.url -Method Post -Headers $headers -Body $bodyBytes -ContentType 'application/json' -TimeoutSec $payload.timeoutSec -UseBasicParsing",
    "  $responseBytes = [Text.Encoding]::UTF8.GetBytes($response.Content)",
    "  [Console]::Out.Write([Convert]::ToBase64String($responseBytes))",
    "} catch {",
    "  $status = $null",
    "  $content = ''",
    "  if ($_.Exception.Response) {",
    "    $status = [int]$_.Exception.Response.StatusCode",
    "    try {",
    "      $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())",
    "      $content = $reader.ReadToEnd()",
    "    } catch {}",
    "  }",
    "  $errorPayload = @{ status = $status; message = $_.Exception.Message; content = $content } | ConvertTo-Json -Depth 20 -Compress",
    "  [Console]::Error.Write($errorPayload)",
    "  exit 1",
    "}"
  ].join("; ");
  const payload = JSON.stringify({
    url,
    headers: {
      "content-type": "application/json",
      ...headers
    },
    bodyBase64: Buffer.from(JSON.stringify(body), "utf8").toString("base64"),
    timeoutSec: Math.max(1, Math.ceil(timeoutMs / 1000))
  });
  const encodedPayload = Buffer.from(payload, "utf8").toString("base64");
  const result = spawnSync("powershell.exe", [
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    script
  ], {
    input: encodedPayload,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const detail = parseJsonOrText(result.stderr.trim());
    const status = integerOrNull(detail?.status);
    const content = isPlainObject(detail)
      ? detail.content || detail.message || "Unknown error"
      : result.stderr.trim() || result.stdout.trim();
    const responseLike = {
      status: status ?? 0,
      statusText: status ? "PowerShell HTTP fallback" : ""
    };
    const message = isPlainObject(detail)
      ? `PowerShell HTTP fallback failed${status ? ` with ${formatHttpErrorMessage(responseLike, content, callArgs)}` : `: ${content}`}`
      : `PowerShell HTTP fallback failed: ${result.stderr.trim() || result.stdout.trim()}`;
    throw new Error(redactSensitive(message, secretValues));
  }

  const responseText = Buffer.from(result.stdout.trim(), "base64").toString("utf8");
  return parseJsonOrText(responseText);
}

function normalizeMessages(args, options = {}) {
  if (Array.isArray(args.messages) && args.messages.length > 0) {
    return args.messages.map((message, index) => {
      if (!isPlainObject(message)) {
        throw rpcError(-32602, `messages[${index}] must be an object.`);
      }
      requireString(message.role, `messages[${index}].role`);
      requireString(message.content, `messages[${index}].content`);
      if (!["system", "user", "assistant"].includes(message.role)) {
        throw rpcError(-32602, `messages[${index}].role must be system, user, or assistant.`);
      }
      return {
        role: message.role,
        content: message.content
      };
    });
  }

  if (typeof args.prompt === "string" && args.prompt.trim()) {
    return [
      {
        role: "user",
        content: args.prompt
      }
    ];
  }

  if (options.allowEmpty) {
    return [];
  }

  throw rpcError(-32602, "Either prompt or messages is required.");
}

function textResult(text, structuredContent) {
  return {
    content: [
      {
        type: "text",
        text: text || ""
      }
    ],
    structuredContent
  };
}

function parseJsonOrText(text) {
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function requireString(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw rpcError(-32602, `${name} must be a non-empty string.`);
  }
}

function optionalNumber(name, value) {
  return typeof value === "number" && Number.isFinite(value) ? { [name]: value } : {};
}

function optionalInteger(name, value) {
  return Number.isInteger(value) ? { [name]: value } : {};
}

function clampInteger(value, min, max, fallback) {
  if (!Number.isInteger(value)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, value));
}

function safeHeaders(headers) {
  if (!isPlainObject(headers)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(headers)
      .filter(([key, value]) => typeof key === "string" && typeof value === "string")
      .filter(([key]) => key.toLowerCase() !== "content-type")
  );
}

function safeProfileHeaders(headers) {
  const disallowed = new Set(["authorization", "x-api-key", "x-goog-api-key", "api-key"]);
  const clean = safeHeaders(headers);
  const blocked = Object.keys(clean).filter((key) => disallowed.has(key.toLowerCase()));

  if (blocked.length) {
    throw rpcError(-32602, `Profiles must not store secret-bearing headers: ${blocked.join(", ")}. Store the key as a secretName instead.`);
  }

  return clean;
}

function optionalTrimmedString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function removeUndefined(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
  );
}

function trimTrailingSlash(value) {
  return String(value).replace(/\/+$/, "");
}

function toGoogleModelPath(model) {
  const normalized = String(model).replace(/^\/+/, "");
  return normalized.startsWith("models/") ? normalized : `models/${normalized}`;
}

function encodePathPreservingSlash(value) {
  return value.split("/").map((segment) => encodeURIComponent(segment)).join("/");
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function redactSensitive(value, secretValues) {
  let output = String(value);

  for (const secretValue of secretValues) {
    if (typeof secretValue === "string" && secretValue) {
      output = output.split(secretValue).join("[REDACTED]");
    }
  }

  return output
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[REDACTED_GOOGLE_API_KEY]")
    .replace(/sk-[0-9A-Za-z_-]{20,}/g, "[REDACTED_API_KEY]");
}

function rpcError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function toRpcError(error) {
  return {
    code: Number.isInteger(error?.code) ? error.code : -32603,
    message: error?.message || "Internal error"
  };
}

function writeResponse(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

async function handleLine(line) {
  let message;
  try {
    message = JSON.parse(line);
  } catch (error) {
    writeResponse({
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32700,
        message: `Parse error: ${error.message}`
      }
    });
    return;
  }

  if (!Object.prototype.hasOwnProperty.call(message, "id")) {
    return;
  }

  try {
    const result = await handleRequest(message);
    writeResponse({
      jsonrpc: "2.0",
      id: message.id,
      result
    });
  } catch (error) {
    writeResponse({
      jsonrpc: "2.0",
      id: message.id,
      error: toRpcError(error)
    });
  }
}

function startServer() {
  let buffer = "";

  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    buffer += chunk;
    let newlineIndex = buffer.indexOf("\n");

    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      newlineIndex = buffer.indexOf("\n");

      if (!line) {
        continue;
      }

      handleLine(line).catch((error) => {
        writeResponse({
          jsonrpc: "2.0",
          id: null,
          error: toRpcError(error)
        });
      });
    }
  });

  process.stdin.on("end", () => {
    const line = buffer.trim();
    if (line) {
      handleLine(line).catch((error) => {
        writeResponse({
          jsonrpc: "2.0",
          id: null,
          error: toRpcError(error)
        });
      });
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === MODULE_PATH) {
  startServer();
}
