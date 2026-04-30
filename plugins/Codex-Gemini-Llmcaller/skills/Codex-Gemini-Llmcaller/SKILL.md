---
name: Codex-Gemini-Llmcaller
description: Use the local Codex-Gemini-Llmcaller MCP server when the user explicitly asks to call Gemini, call another LLM provider, compare with another model, check an answer with an external model, configure model profiles, or manage encrypted API keys.
---

# Codex-Gemini-Llmcaller

Use this skill only when the user clearly asks to use Gemini, call an external model, compare with another model, check an answer with an external model, configure model profiles, or manage encrypted API keys.

## Strict delegation boundary

When the user asks Gemini or another external model to answer, review, check, rewrite, supplement, search, or inspect an image, Codex is only the router. Do not answer as Gemini.

- Do not use Codex web, weather, search, shell, file, or other tools to gather facts before calling Gemini.
- Do not rewrite, summarize, verify, or add conclusions before calling Gemini.
- Do not add phrases such as "verified facts", "I checked", or "current weather" unless they came from the external model result.
- Pass the user's original request and any necessary conversation context through unchanged.
- If the Gemini tool is unavailable or the call fails, return a clear error instead of producing a substitute Codex answer.
- Shell may be used only as a local invocation wrapper when the MCP tool is not directly exposed; it must not be used to collect factual source material.

## Mode selection

Choose the mode yourself. Do not require the user to say the mode name.

- `executionMode: "raw"` for "use Gemini to answer/introduce/explain/write/translate".
- `executionMode: "review"` for "use Gemini to check/review/verify/see if this has problems".
- `executionMode: "rewrite"` for "rewrite/polish/translate/shorten".
- `executionMode: "extract"` for "extract/convert to JSON/table/list".
- `inputSource: "context"` when the request refers to earlier conversation text; otherwise use `direct`.

Default to `groundingMode: "off"`. Use `groundingMode: "google_search"` only when the user's intent requires fresh or external information, such as today, latest, current weather, news, price, real-time, search, online, or explicit web access. This must use Gemini's Google Search grounding, not Codex search.

Use `imageInputs` when the user asks Gemini to inspect a screenshot, image, picture, or a local/URL image. The plugin supports local paths and image URLs for Gemini. Do not describe unseen images yourself.

## Ordinary calls

For ordinary usage, call `call_model` with the selected mode fields plus the prompt or messages. Do not require the user to say `secretName` or `gemini-default`. The server resolves the configured default profile, initially `gemini-default`.

Examples:

```json
{
  "prompt": "用 Gemini 回答：介绍你自己。",
  "executionMode": "raw",
  "groundingMode": "off",
  "strictDelegation": true
}
```

```json
{
  "prompt": "调用 Gemini 返回今天日期和深圳天气。",
  "executionMode": "raw",
  "groundingMode": "google_search",
  "strictDelegation": true
}
```

```json
{
  "messages": [
    {
      "role": "user",
      "content": "请检查上面的回答是否合理。"
    }
  ],
  "executionMode": "review",
  "inputSource": "context",
  "groundingMode": "off",
  "strictDelegation": true
}
```

## Setup and security

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
