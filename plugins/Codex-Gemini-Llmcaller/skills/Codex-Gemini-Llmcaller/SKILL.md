---
name: Codex-Gemini-Llmcaller
description: 当用户明确要求调用 Gemini、DeepSeek 或其他外部模型，比较模型结果，检查回答，配置模型 profile，或管理本地加密 API key 时，使用本地 Codex-Gemini-Llmcaller MCP server。
---

# Codex-Gemini-Llmcaller

仅当用户明确要求使用 Gemini、DeepSeek 或其他外部模型，比较模型结果，检查回答，配置模型 profile，或管理加密 API key 时使用本 skill。

## 严格委托边界

当用户要求 Gemini 或其他外部模型回答、审查、检查、改写、补充、搜索或检查图片时，Codex 只负责路由，不代替外部模型回答。

- 调用外部模型前，不要使用 Codex 自己的 web、weather、search、shell、文件读取或其他工具收集事实。
- 调用外部模型前，不要替外部模型改写、总结、验证或添加结论。
- 除非来自外部模型结果，不要添加“已验证事实”“我检查过”“当前天气”等表述。
- 原样传递用户请求和必要的对话上下文。
- 如果外部模型工具不可用或调用失败，返回明确错误，不要由 Codex 冒充外部模型回答。
- shell 只能作为当前会话没有直接暴露 MCP tool 时的本地调用包装器，不能用来收集事实材料。
- 使用本地兜底包装器时，必须输出 MCP tool 的格式化文本。不要只调用 `callModel()` 并打印 `.text`，否则会丢失模型和 token footer。优先使用 `handleToolCall({ name: "call_model", arguments })` 并输出 `result.content[0].text`，或使用 `scripts/call-model-local.mjs` 从 stdin 读取 JSON 参数。

## 模式选择

自行选择模式，不要求用户说出参数名。

- `executionMode: "raw"`：回答、介绍、解释、写作、翻译。
- `executionMode: "review"`：检查、审查、核对、验证、判断是否有问题。
- `executionMode: "rewrite"`：改写、润色、翻译、缩短。
- `executionMode: "extract"`：抽取、转换为 JSON、表格或列表。
- `inputSource: "context"`：请求引用上文或之前回答时使用；否则使用 `direct`。
- 对检查上文回答的 review 请求，默认使用 `outputMode: "json"`，除非用户明确要求完整外部模型原文。JSON 应保持紧凑，包含 `verdict`、`severity`、`confidence`、`issues`、`suggested_correction` 和 `need_full_review`。
- 对长报告或长审查，如果用户不需要在聊天中直接看到完整外部模型文本，使用 `outputMode: "file"`。插件会把完整输出保存到当前工作区 `.tmp/model-results/`，并只返回路径和短预览。

默认不传 `routingMode`，保持配置的默认 profile。如果用户明确要求“自动选择模型/是否联网/路由判断”，可传 `routingMode: "auto"`，让插件按请求选择 DeepSeek review、Gemini grounded 或图片能力 profile。

默认 `groundingMode: "off"`。只有当用户意图需要新鲜或外部信息，例如今天、最新、当前天气、新闻、价格、实时、搜索、联网、在线等，才使用 `groundingMode: "google_search"`。联网必须使用 Gemini 自身的 Google Search grounding，不能由 Codex 先搜索。

当用户要求外部模型检查截图、图片、照片、本地图片或 URL 图片时，使用 `imageInputs`。插件支持给 Gemini 传本地路径和图片 URL。不要描述未被外部模型看到的图片。

## 普通调用

普通场景调用 `call_model`，传入已选择的模式字段以及 `prompt` 或 `messages`。不要要求用户说出 `secretName` 或 `gemini-default`。server 会解析配置中的默认 profile，初始为 `gemini-default`。

按模型体现使用方式：

- 用户说 Gemini：使用默认 Gemini profile；联网或图片场景优先 Gemini。
- 用户说 DeepSeek：使用 `profileName: "deepseek-default"`。
- 用户说 DeepSeek Pro、强推理、高质量评审：使用 `profileName: "deepseek-pro"`。
- 用户说自动选择模型、自动判断是否联网、路由判断：使用 `routingMode: "auto"`。
- 用户只说外部模型但没有指定模型：保持默认 profile，不主动切换，除非用户要求自动路由。

如果用户明确要求 DeepSeek，优先使用 `profileName: "deepseek-default"`；高质量或 reasoning 场景可使用 `profileName: "deepseek-pro"`。如果用户要求联网搜索或图片理解，DeepSeek 不支持 Gemini Google Search grounding 和 `imageInputs`，应改用支持该能力的 Gemini profile。

当前会话未直接暴露 `call_model` MCP tool 时，使用本地包装脚本，不要手动 import `callModel()`：

```powershell
@'
{
  "prompt": "用 Gemini 回答：介绍你自己。",
  "executionMode": "raw",
  "groundingMode": "off",
  "strictDelegation": true
}
'@ | node ./scripts/call-model-local.mjs
```

包装脚本会输出与 MCP tool 一致的格式化文本；当 `outputMetaFooter` 启用时，末尾包含模型、profile 和 token footer。

示例：

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
  "profileName": "deepseek-default",
  "prompt": "用 DeepSeek 检查上面的回答。",
  "executionMode": "review",
  "inputSource": "context",
  "outputMode": "json",
  "strictDelegation": true
}
```

```json
{
  "profileName": "deepseek-pro",
  "prompt": "用 DeepSeek Pro 检查上面的方案，返回主要风险和修改建议。",
  "executionMode": "review",
  "inputSource": "context",
  "outputMode": "json",
  "strictDelegation": true
}
```

```json
{
  "routingMode": "auto",
  "messages": [
    {
      "role": "user",
      "content": "请检查上面的回答是否合理。"
    }
  ],
  "executionMode": "review",
  "inputSource": "context",
  "groundingMode": "off",
  "outputMode": "json",
  "strictDelegation": true
}
```

## 安装与安全

不要要求用户在聊天中粘贴真实 API key。首次设置时，引导用户运行：

```powershell
node ./setup.mjs
```

初始化 DeepSeek 或多模型时，可引导用户在本地终端运行：

```powershell
node ./setup.mjs --providers deepseek --default-profile deepseek-default
```

```powershell
node ./setup.mjs --providers gemini,deepseek
```

secret 默认使用 Windows 当前用户保护并本地保存。设置完成后，调用应使用 profile 或 `secretName`；插件会在本地解密。

Gemini 调用默认支持自动续写。如果 Gemini 响应以 `MAX_TOKENS` 结束或接近配置的输出上限，插件会继续请求并合并结果。只有用户明确要求单次原始调用时，才使用 `autoContinue: false`。

profile 可以定义 fallback profile。选定 profile 调用失败时，server 会按 `fallbackProfileName` 或 `fallbackProfiles` 顺序重试，并在结构化结果中返回 `fallbackUsed` 和 `fallbackFailures`。不要在 profile headers 中保存 API key；应使用 `secretName`。

高级 provider 值：

- Gemini：`provider: "google"`。
- OpenAI-compatible：`provider: "openai-compatible"`，并配置 provider 的 `baseUrl`。
- DeepSeek：`provider: "openai-compatible"`，`baseUrl: "https://api.deepseek.com"`，模型可用 `deepseek-v4-flash` 或 `deepseek-v4-pro`。
- Anthropic：`provider: "anthropic"`。

新 profile 可带 `providerId` 表示具体服务商，例如 `gemini`、`deepseek`、`openrouter`。旧 profile 没有 `providerId` 时，插件会根据 `baseUrl`、`model`、`apiKeyEnv` 或 `secretName` 推断。

重复使用时优先配置 profile；一次性覆盖时再使用显式参数。

需要选择 provider/profile 前，可使用 `provider_capabilities` 查看路由能力表。
