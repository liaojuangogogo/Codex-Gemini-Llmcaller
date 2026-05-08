export const DEFAULT_TIMEOUT_MS = 120000;
export const DEFAULT_PROVIDER_ID = "gemini";
export const DEFAULT_PROFILE_NAME = "gemini-default";
export const GROUNDED_PROFILE_NAME = "gemini-grounded";

export const PROVIDER_SPECS = {
  gemini: {
    id: "gemini",
    displayName: "Google Gemini",
    provider: "google",
    defaultSecretName: "gemini-default",
    defaultApiKeyEnv: "GEMINI_API_KEY",
    apiKeyEnvNames: ["GEMINI_API_KEY", "GOOGLE_API_KEY", "CODEX_GEMINI_LLMCALLER_API_KEY", "MULTI_MODEL_API_KEY"],
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    setupPrompt: "Gemini API key: ",
    setupExample: "用 Gemini 检查一下这个回答。",
    capabilities: {
      chat: true,
      jsonOutput: true,
      images: true,
      googleSearchGrounding: true,
      thinkingLevel: true,
      thinkingMode: false,
      reasoningEffort: false
    },
    profiles: {
      "gemini-default": {
        providerId: "gemini",
        provider: "google",
        model: "gemini-3-flash-preview",
        secretName: "gemini-default",
        timeoutMs: DEFAULT_TIMEOUT_MS,
        thinkingLevel: "low",
        autoContinue: true,
        maxContinuationRounds: 2
      },
      "gemini-grounded": {
        providerId: "gemini",
        provider: "google",
        model: "gemini-2.5-flash",
        secretName: "gemini-default",
        timeoutMs: DEFAULT_TIMEOUT_MS,
        autoContinue: true,
        maxContinuationRounds: 2,
        groundingMode: "google_search",
        fallbackProfiles: ["gemini-grounded-lite", "gemini-grounded-20-flash"]
      },
      "gemini-grounded-lite": {
        providerId: "gemini",
        provider: "google",
        model: "gemini-2.5-flash-lite",
        secretName: "gemini-default",
        timeoutMs: DEFAULT_TIMEOUT_MS,
        autoContinue: true,
        maxContinuationRounds: 2,
        groundingMode: "google_search"
      },
      "gemini-grounded-20-flash": {
        providerId: "gemini",
        provider: "google",
        model: "gemini-2.0-flash",
        secretName: "gemini-default",
        timeoutMs: DEFAULT_TIMEOUT_MS,
        autoContinue: true,
        maxContinuationRounds: 2,
        groundingMode: "google_search"
      }
    }
  },
  deepseek: {
    id: "deepseek",
    displayName: "DeepSeek",
    provider: "openai-compatible",
    defaultSecretName: "deepseek-default",
    defaultApiKeyEnv: "DEEPSEEK_API_KEY",
    apiKeyEnvNames: ["DEEPSEEK_API_KEY", "CODEX_GEMINI_LLMCALLER_API_KEY", "MULTI_MODEL_API_KEY"],
    baseUrl: "https://api.deepseek.com",
    setupPrompt: "DeepSeek API key: ",
    setupExample: "用 DeepSeek 检查一下这个回答。",
    models: ["deepseek-v4-flash", "deepseek-v4-pro"],
    capabilities: {
      chat: true,
      jsonOutput: true,
      images: false,
      googleSearchGrounding: false,
      thinkingLevel: false,
      thinkingMode: true,
      reasoningEffort: true
    },
    profiles: {
      "deepseek-default": {
        providerId: "deepseek",
        provider: "openai-compatible",
        model: "deepseek-v4-flash",
        secretName: "deepseek-default",
        baseUrl: "https://api.deepseek.com",
        timeoutMs: DEFAULT_TIMEOUT_MS,
        maxTokens: 4096,
        thinkingMode: "enabled",
        reasoningEffort: "high",
        autoContinue: false
      },
      "deepseek-pro": {
        providerId: "deepseek",
        provider: "openai-compatible",
        model: "deepseek-v4-pro",
        secretName: "deepseek-default",
        baseUrl: "https://api.deepseek.com",
        timeoutMs: DEFAULT_TIMEOUT_MS,
        maxTokens: 4096,
        thinkingMode: "enabled",
        reasoningEffort: "high",
        autoContinue: false
      }
    }
  },
  openrouter: {
    id: "openrouter",
    displayName: "OpenRouter",
    provider: "openai-compatible",
    defaultSecretName: "openrouter-default",
    defaultApiKeyEnv: "OPENROUTER_API_KEY",
    apiKeyEnvNames: ["OPENROUTER_API_KEY", "CODEX_GEMINI_LLMCALLER_API_KEY", "MULTI_MODEL_API_KEY"],
    baseUrl: "https://openrouter.ai/api/v1",
    capabilities: {
      chat: true,
      jsonOutput: true,
      images: false,
      googleSearchGrounding: false,
      thinkingLevel: false,
      thinkingMode: false,
      reasoningEffort: false
    }
  },
  anthropic: {
    id: "anthropic",
    displayName: "Anthropic",
    provider: "anthropic",
    defaultSecretName: "anthropic-default",
    defaultApiKeyEnv: "ANTHROPIC_API_KEY",
    apiKeyEnvNames: ["ANTHROPIC_API_KEY", "CODEX_GEMINI_LLMCALLER_API_KEY", "MULTI_MODEL_API_KEY"],
    baseUrl: "https://api.anthropic.com/v1",
    capabilities: {
      chat: true,
      jsonOutput: false,
      images: false,
      googleSearchGrounding: false,
      thinkingLevel: false,
      thinkingMode: false,
      reasoningEffort: false
    }
  },
  groq: {
    id: "groq",
    displayName: "Groq",
    provider: "openai-compatible",
    defaultSecretName: "groq-default",
    defaultApiKeyEnv: "GROQ_API_KEY",
    apiKeyEnvNames: ["GROQ_API_KEY", "CODEX_GEMINI_LLMCALLER_API_KEY", "MULTI_MODEL_API_KEY"],
    baseUrl: "https://api.groq.com/openai/v1"
  },
  mistral: {
    id: "mistral",
    displayName: "Mistral",
    provider: "openai-compatible",
    defaultSecretName: "mistral-default",
    defaultApiKeyEnv: "MISTRAL_API_KEY",
    apiKeyEnvNames: ["MISTRAL_API_KEY", "CODEX_GEMINI_LLMCALLER_API_KEY", "MULTI_MODEL_API_KEY"],
    baseUrl: "https://api.mistral.ai/v1"
  },
  xai: {
    id: "xai",
    displayName: "xAI",
    provider: "openai-compatible",
    defaultSecretName: "xai-default",
    defaultApiKeyEnv: "XAI_API_KEY",
    apiKeyEnvNames: ["XAI_API_KEY", "CODEX_GEMINI_LLMCALLER_API_KEY", "MULTI_MODEL_API_KEY"],
    baseUrl: "https://api.x.ai/v1"
  }
};

export const BUILT_IN_PROFILES = Object.fromEntries(
  Object.values(PROVIDER_SPECS)
    .flatMap((spec) => Object.entries(spec.profiles ?? {}))
    .map(([name, profile]) => [name, { ...profile }])
);

export const BUILT_IN_PROFILE_NAMES = new Set(Object.keys(BUILT_IN_PROFILES));

export const PROVIDER_CAPABILITIES = {
  google: { ...PROVIDER_SPECS.gemini.capabilities },
  anthropic: { ...PROVIDER_SPECS.anthropic.capabilities },
  "openai-compatible": { ...PROVIDER_SPECS.openrouter.capabilities },
  gemini: { ...PROVIDER_SPECS.gemini.capabilities },
  deepseek: { ...PROVIDER_SPECS.deepseek.capabilities },
  openrouter: { ...PROVIDER_SPECS.openrouter.capabilities },
  groq: { ...PROVIDER_SPECS.openrouter.capabilities },
  mistral: { ...PROVIDER_SPECS.openrouter.capabilities },
  xai: { ...PROVIDER_SPECS.openrouter.capabilities }
};

export const PROVIDER_PRESETS = [
  {
    providerId: "openrouter",
    provider: "openai-compatible",
    name: "OpenRouter",
    baseUrl: PROVIDER_SPECS.openrouter.baseUrl,
    apiKeyEnv: PROVIDER_SPECS.openrouter.defaultApiKeyEnv,
    notes: "Use model ids such as openai/gpt-4o-mini or anthropic/claude-3.5-sonnet."
  },
  {
    providerId: "deepseek",
    provider: "openai-compatible",
    name: "DeepSeek",
    baseUrl: PROVIDER_SPECS.deepseek.baseUrl,
    apiKeyEnv: PROVIDER_SPECS.deepseek.defaultApiKeyEnv,
    models: PROVIDER_SPECS.deepseek.models,
    capabilities: {
      chatCompletions: true,
      jsonOutput: true,
      thinkingMode: true,
      images: false,
      grounding: false
    },
    notes: "Official OpenAI-compatible endpoint. Use deepseek-v4-flash for general chat and deepseek-v4-pro for higher quality."
  },
  {
    providerId: "groq",
    provider: "openai-compatible",
    name: "Groq",
    baseUrl: PROVIDER_SPECS.groq.baseUrl,
    apiKeyEnv: PROVIDER_SPECS.groq.defaultApiKeyEnv,
    notes: "Uses OpenAI-compatible chat completions."
  },
  {
    providerId: "mistral",
    provider: "openai-compatible",
    name: "Mistral",
    baseUrl: PROVIDER_SPECS.mistral.baseUrl,
    apiKeyEnv: PROVIDER_SPECS.mistral.defaultApiKeyEnv,
    notes: "Uses OpenAI-compatible chat completions."
  },
  {
    providerId: "xai",
    provider: "openai-compatible",
    name: "xAI",
    baseUrl: PROVIDER_SPECS.xai.baseUrl,
    apiKeyEnv: PROVIDER_SPECS.xai.defaultApiKeyEnv,
    notes: "Uses OpenAI-compatible chat completions."
  },
  {
    providerId: "anthropic",
    provider: "anthropic",
    name: "Anthropic",
    baseUrl: PROVIDER_SPECS.anthropic.baseUrl,
    apiKeyEnv: PROVIDER_SPECS.anthropic.defaultApiKeyEnv,
    notes: "Uses the Messages API."
  },
  {
    providerId: "gemini",
    provider: "google",
    name: "Google Gemini",
    baseUrl: PROVIDER_SPECS.gemini.baseUrl,
    apiKeyEnv: PROVIDER_SPECS.gemini.defaultApiKeyEnv,
    notes: "Native REST generateContent endpoint with x-goog-api-key."
  }
];

export function providerSpec(providerId) {
  return PROVIDER_SPECS[normalizeProviderId(providerId)];
}

export function setupProviderSpecs(providerIds) {
  return providerIds.map((providerId) => {
    const spec = providerSpec(providerId);
    if (!spec) {
      throw new Error(`Unsupported setup provider: ${providerId}`);
    }
    if (!spec.profiles || !Object.keys(spec.profiles).length) {
      throw new Error(`Provider '${providerId}' does not have built-in setup profiles yet.`);
    }
    return spec;
  });
}

export function normalizeProviderId(providerId) {
  return typeof providerId === "string" ? providerId.trim().toLowerCase() : "";
}

export function inferProviderId(args = {}) {
  const explicit = normalizeProviderId(args.providerId);
  if (explicit && PROVIDER_SPECS[explicit]) {
    return explicit;
  }

  const baseUrl = String(args.baseUrl || "").toLowerCase();
  const model = String(args.model || "").toLowerCase();
  const apiKeyEnv = String(args.apiKeyEnv || "").toUpperCase();
  const secretName = String(args.secretName || "").toLowerCase();

  if (baseUrl.includes("deepseek.com") || model.startsWith("deepseek-") || apiKeyEnv === "DEEPSEEK_API_KEY" || secretName.startsWith("deepseek-")) {
    return "deepseek";
  }
  if (baseUrl.includes("openrouter.ai") || apiKeyEnv === "OPENROUTER_API_KEY" || secretName.startsWith("openrouter-")) {
    return "openrouter";
  }
  if (baseUrl.includes("anthropic.com") || args.provider === "anthropic" || apiKeyEnv === "ANTHROPIC_API_KEY" || secretName.startsWith("anthropic-")) {
    return "anthropic";
  }
  if (baseUrl.includes("groq.com") || apiKeyEnv === "GROQ_API_KEY" || secretName.startsWith("groq-")) {
    return "groq";
  }
  if (baseUrl.includes("mistral.ai") || apiKeyEnv === "MISTRAL_API_KEY" || secretName.startsWith("mistral-")) {
    return "mistral";
  }
  if (baseUrl.includes("api.x.ai") || apiKeyEnv === "XAI_API_KEY" || secretName.startsWith("xai-")) {
    return "xai";
  }
  if (args.provider === "google" || model.startsWith("gemini-") || apiKeyEnv === "GEMINI_API_KEY" || apiKeyEnv === "GOOGLE_API_KEY" || secretName.startsWith("gemini-")) {
    return "gemini";
  }

  return "";
}

export function providerCapabilityKey(args = {}) {
  const inferred = inferProviderId(args);
  return inferred && PROVIDER_CAPABILITIES[inferred] ? inferred : args.provider;
}

export function envNamesForCall(args = {}) {
  const inferred = inferProviderId(args);
  const specNames = inferred && PROVIDER_SPECS[inferred]?.apiKeyEnvNames ? PROVIDER_SPECS[inferred].apiKeyEnvNames : [];
  const protocolNames = {
    "openai-compatible": ["CODEX_GEMINI_LLMCALLER_API_KEY", "MULTI_MODEL_API_KEY", "OPENAI_API_KEY", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "GROQ_API_KEY", "MISTRAL_API_KEY", "XAI_API_KEY"],
    anthropic: ["ANTHROPIC_API_KEY", "CODEX_GEMINI_LLMCALLER_API_KEY", "MULTI_MODEL_API_KEY"],
    google: ["GEMINI_API_KEY", "GOOGLE_API_KEY", "CODEX_GEMINI_LLMCALLER_API_KEY", "MULTI_MODEL_API_KEY"]
  }[args.provider] ?? ["CODEX_GEMINI_LLMCALLER_API_KEY", "MULTI_MODEL_API_KEY"];

  return [...new Set([...specNames, ...protocolNames])];
}

export function apiKeyEnvMap(value) {
  const map = {};
  if (typeof value !== "string" || !value.trim()) {
    return map;
  }

  for (const item of value.split(",")) {
    const trimmed = item.trim();
    if (!trimmed) {
      continue;
    }
    const [providerId, envName] = trimmed.split("=").map((part) => part?.trim()).filter(Boolean);
    if (providerId && envName) {
      map[normalizeProviderId(providerId)] = envName;
    } else if (providerId && !envName) {
      map[DEFAULT_PROVIDER_ID] = providerId;
    }
  }

  return map;
}
