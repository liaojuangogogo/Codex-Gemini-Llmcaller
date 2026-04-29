---
name: Codex-Gemini-Llmcaller
description: Use the local Codex-Gemini-Llmcaller MCP server when the user explicitly asks to call Gemini, call another LLM provider, compare with another model, check an answer with an external model, configure model profiles, or manage encrypted API keys.
---

# Codex-Gemini-Llmcaller

Use this skill only when the user clearly asks to use Gemini, call an external model, compare with another model, check an answer with an external model, configure model profiles, or manage encrypted API keys.

For ordinary usage, call `call_model` with only the prompt or messages. Do not require the user to say `secretName` or `gemini-default`. The server resolves the configured default profile, initially `gemini-default`.

Do not ask the user to paste a real API key into chat. For first-time setup, direct the user to run:

```powershell
node ./setup.mjs
```

Secrets are stored locally with Windows current-user protection by default. After setup, calls should use profiles or `secretName`; the plugin performs local decryption internally.

Gemini calls support automatic continuation by default. If a Gemini response ends with `MAX_TOKENS` or appears close to the configured output limit, the plugin continues and merges the answer. Use `autoContinue: false` only when the user explicitly wants raw single-shot behavior.

Profiles can define fallback profiles. If the selected profile call fails, the server tries `fallbackProfileName` or `fallbackProfiles` in order and reports `fallbackUsed` plus `fallbackFailures` in structured output. Do not store API keys in profile headers; use `secretName`.

Advanced provider values:

- Gemini: `provider: "google"`
- OpenAI-compatible: `provider: "openai-compatible"` plus provider `/v1` `baseUrl`
- Anthropic: `provider: "anthropic"`

Prefer profiles for repeated usage. Use explicit arguments only for one-off overrides.
