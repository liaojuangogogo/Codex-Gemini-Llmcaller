export const OUTPUT_MODES = new Set(["full", "summary", "json", "preview"]);

const REVIEW_JSON_SYSTEM_INSTRUCTION = [
  "You are reviewing a previous assistant answer for correctness, completeness, and risk.",
  "Return only valid JSON with this shape:",
  "{",
  '  "verdict": "correct | mostly_correct | has_issues | incorrect | uncertain",',
  '  "severity": "none | low | medium | high | critical",',
  '  "confidence": 0.0,',
  '  "issues": [',
  '    { "title": "short title", "severity": "low | medium | high | critical", "reason": "brief reason", "correction": "brief correction" }',
  "  ],",
  '  "missing_context": "",',
  '  "suggested_correction": "",',
  '  "need_full_review": false',
  "}",
  "Limits: issues must contain at most 5 items. Keep reason and correction concise. Keep suggested_correction under about 300-500 Chinese characters or equivalent tokens.",
  "Do not include markdown fences or prose outside the JSON."
].join("\n");

const REVIEW_SUMMARY_SYSTEM_INSTRUCTION = [
  "You are reviewing a previous assistant answer for correctness, completeness, and risk.",
  "Return a concise review summary with verdict, severity, key issues, and a short correction if needed.",
  "Keep the response short and avoid long commentary unless the user explicitly requested a full review."
].join("\n");

export function resolveRoute(args, explicitArgs = {}) {
  const outputMode = args.outputMode ?? defaultOutputMode(args);
  const route = {
    executionMode: args.executionMode ?? "raw",
    groundingMode: args.groundingMode ?? "off",
    inputSource: args.inputSource ?? "direct",
    outputMode,
    profileName: args.profileName,
    provider: args.provider,
    model: args.model,
    reason: routeReason(args, outputMode, explicitArgs)
  };

  return {
    ...args,
    outputMode,
    route
  };
}

export function applyOutputModeToMessages(args, messages) {
  if (args.outputMode === "json" && args.executionMode === "review") {
    return prependSystemMessage(messages, REVIEW_JSON_SYSTEM_INSTRUCTION);
  }

  if (args.outputMode === "summary" && args.executionMode === "review") {
    return prependSystemMessage(messages, REVIEW_SUMMARY_SYSTEM_INSTRUCTION);
  }

  return messages;
}

export function parseJsonOutput(text) {
  if (typeof text !== "string" || !text.trim()) {
    return null;
  }

  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const jsonText = fenced ? fenced[1].trim() : trimmed;

  try {
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}

function defaultOutputMode(args) {
  if (args.executionMode === "review" && args.inputSource === "context") {
    return "json";
  }

  return "full";
}

function prependSystemMessage(messages, content) {
  return [
    {
      role: "system",
      content
    },
    ...messages
  ];
}

function routeReason(args, outputMode, explicitArgs) {
  if (outputMode === "json" && args.executionMode === "review" && args.inputSource === "context" && !explicitArgs.outputMode) {
    return "review context requests default to compact JSON output to reduce Codex context usage";
  }

  if (explicitArgs.outputMode) {
    return "outputMode was explicitly requested";
  }

  return "default routing";
}
