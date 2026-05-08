# Codex-Gemini-Llmcaller 用户文档

`Codex-Gemini-Llmcaller` 用于在 Codex 会话中调用 Gemini 或其他 API-key 模型。普通用户安装一次后即可直接使用；高级用户通过本地 `config.json` 配置模型、超时、token、自动续写、fallback 和输出元信息。

## 1. 按模型使用

安装并重启 Codex Desktop 后，可以按模型表达意图。

### 1.1 Gemini 默认模型

适合普通问答、图片输入、需要 Google Search grounding 的联网场景：

```text
用 Gemini 检查一下这个回答。
```

默认使用 `gemini-default` profile 和同名本地加密 secret。

如果明确需要联网：

```text
用 Gemini 联网查询今天的公开信息后回答。
```

如果需要联网，插件会自动使用 `gemini-grounded` profile。内置联网降级顺序是：

```text
gemini-2.5-flash -> gemini-2.5-flash-lite -> gemini-2.0-flash
```

这样避免把 `gemini-3-flash-preview` 作为默认联网模型，降低 preview 模型在 Search grounding 场景下触发 429 的概率。

联网内置 profile 不带 `thinkingLevel`。部分 Gemini 2.5 Flash grounding 调用不支持 `thinkingConfig.thinkingLevel`，保留该字段会导致 `Thinking level is not supported for this model`。

### 1.2 DeepSeek

适合核对 Codex 回答、方案评审、低成本文本审查：

```text
用 DeepSeek 检查一下这个回答。
```

默认使用 `deepseek-default` profile。需要更强 reasoning 时：

```text
用 DeepSeek Pro 检查上面的方案，返回主要风险和修改建议。
```

对应使用 `deepseek-pro` profile。DeepSeek 不支持 Gemini Google Search grounding 和图片输入；需要联网或图片时应使用 Gemini。

### 1.3 自动路由

如果希望插件自己选择模型和是否联网：

```text
让插件自动选择合适模型，检查上面的回答是否合理。
```

这类请求应使用 `routingMode: "auto"`。自动路由会在可用时优先用 DeepSeek 做上文核对；遇到今天、最新、天气、新闻、价格、搜索、联网、实时等信息时切到 Gemini grounded；遇到图片输入时使用 Gemini。

你也可以在插件页把插件添加到会话后使用：

```text
@Codex-Gemini-Llmcaller 检查上面的回答。
```

插件页添加方式：

1. 左侧进入“插件”。
2. 顶部选择“插件”页签。
3. 在插件源下拉中选择 `Codex-Gemini-Llmcaller Local Plugins`。
4. 找到 `Codex-Gemini-Llmcaller`，点击 `+`。
5. 选择“在对话中试用”或添加到当前会话。

## 2. 多模型初始化

默认初始化命令只配置 Gemini：

```powershell
node ./setup.mjs
```

如果要同时配置 Gemini 和 DeepSeek：

```powershell
node ./setup.mjs --providers gemini,deepseek
```

如果只配置 DeepSeek，并把默认 profile 设为 `deepseek-default`：

```powershell
node ./setup.mjs --providers deepseek --default-profile deepseek-default
```

非交互模式可以只传环境变量名，不要把 API key 作为命令行参数：

```powershell
node ./setup.mjs --providers gemini,deepseek --api-key-env gemini=GEMINI_API_KEY,deepseek=DEEPSEEK_API_KEY --refresh-secrets --yes
```

初始化逻辑会按 provider 检查对应 secret 是否已存在且可解密；如果已存在，默认会跳过该 provider 的 API key 输入。要替换旧 key，使用 `--refresh-secrets`。脚本默认会在写入 profile 后对每个 provider 做一次轻量真实 API 验证，确认 key、权限、余额/配额、模型和网络链路可用。只有离线安装或明确不希望产生真实调用时，才使用 `--skip-api-validate`。`--install-only` 只安装插件和注册 marketplace，不初始化 secret 或 profile，也不做 API 验证。

自动化环境可以提前由系统注入 `GEMINI_API_KEY`、`DEEPSEEK_API_KEY`。日常本地刷新 key 时，优先直接运行交互式命令，由脚本隐藏录入：

```powershell
node ./setup.mjs --providers gemini,deepseek --refresh-secrets
```

不要在 PowerShell 历史里写入真实 API key。

## 3. 本地配置文件

普通用户配置请编辑安装目录中的文件：

```text
$HOME/plugins/Codex-Gemini-Llmcaller/.data/config.json
```

插件运行时会固定读取这个用户级 `.data/`，即使 Codex Desktop 把插件代码复制到 `$HOME/.codex/plugins/cache/` 运行，也不会把 secret 查找位置切到 cache 目录。Windows PowerShell 支持这种正斜杠路径。不要把 `.data/` 提交到 GitHub。

示例配置：

```json
{
  "version": 1,
  "defaultProfile": "gemini-default",
  "outputMetaFooter": true,
  "profiles": {
    "gemini-default": {
      "provider": "google",
      "model": "gemini-3-flash-preview",
      "secretName": "gemini-default",
      "timeoutMs": 120000,
      "thinkingLevel": "low",
      "autoContinue": true,
      "maxContinuationRounds": 2
    }
  }
}
```

## 4. 自定义 Profile

你可以在 `profiles` 中添加更多 profile：

```json
{
  "version": 1,
  "defaultProfile": "gemini-review",
  "outputMetaFooter": true,
  "profiles": {
    "gemini-review": {
      "provider": "google",
      "model": "gemini-3-flash-preview",
      "secretName": "gemini-default",
      "timeoutMs": 180000,
      "maxTokens": 4096,
      "thinkingLevel": "low",
      "generationConfig": {
        "temperature": 0.2
      },
      "autoContinue": true,
      "maxContinuationRounds": 3,
      "fallbackProfiles": ["gemini-backup"]
    },
    "gemini-backup": {
      "provider": "google",
      "model": "gemini-3-flash-preview",
      "secretName": "gemini-default",
      "timeoutMs": 180000,
      "outputMetaFooter": false
    }
  }
}
```

常用字段：

- `provider`
- `providerId`
- `model`
- `secretName`
- `apiKeyEnv`
- `baseUrl`
- `timeoutMs`
- `maxTokens`
- `temperature`
- `thinkingLevel`
- `generationConfig`
- `safetySettings`
- `systemInstruction`
- `tools`
- `toolConfig`
- `cachedContent`
- `routingMode`
- `autoContinue`
- `maxContinuationRounds`
- `outputMetaFooter`
- `fallbackProfileName`
- `fallbackProfiles`

`provider` 表示调用协议，例如 `google`、`openai-compatible`、`anthropic`。`providerId` 表示具体服务商，例如 `gemini`、`deepseek`、`openrouter`，用于路由能力判断和环境变量优先级选择。旧 profile 没有 `providerId` 时，插件会根据 `baseUrl`、`model`、`apiKeyEnv` 或 `secretName` 推断。

`routingMode` 默认为 `profile`，保持旧版兼容，不主动改变默认 profile。设置为 `auto` 时，插件会根据请求做基础路由：

- 涉及今天、最新、天气、新闻、价格、搜索、联网、实时等内容时，自动切到 Gemini grounded profile。
- 带图片输入时，优先使用支持 `imageInputs` 的 Gemini profile。
- 核对上文回答且本地已有 DeepSeek key 或环境变量时，优先使用 `deepseek-default`。

示例：

```json
{
  "routingMode": "auto",
  "executionMode": "review",
  "inputSource": "context",
  "messages": [
    {
      "role": "user",
      "content": "请检查上面的 Codex 回答是否合理。"
    }
  ]
}
```

profile 不允许保存 `Authorization`、`x-api-key`、`x-goog-api-key`、`api-key` 这类携带密钥的 header。请使用 `secretName`。

## 5. 输出元信息

默认情况下，模型回答末尾会追加审计信息：

```text
---
模型: google / gemini-3-flash-preview
Profile: gemini-default
Tokens: input=12, output=34, total=46
```

如果自动化流程需要纯净文本输出，可以在配置中关闭：

```json
{
  "outputMetaFooter": false
}
```

关闭后，可见文本不追加 footer；结构化结果仍包含 `modelInfo` 和 `tokenUsage`。

优先级：

```text
单次调用参数 > profile.outputMetaFooter > 顶层 outputMetaFooter > true
```

自动续写触发多轮请求时，token 统计采用 `billable_sum`：把每轮 API 返回的 input、output、total 相加。这反映 API 消耗，不代表最终上下文窗口大小。

## 6. 配置文件容错

如果 `config.json` 写坏，例如 JSON 少逗号，插件不会覆盖该文件，也不会让 MCP server 直接崩溃。它会临时降级到内置 `gemini-default` 配置，并在结构化结果中返回 `configWarning`。

请手动修复 `config.json` 后继续使用自定义配置。

## 7. 联网 429 处理

联网调用会启用 Gemini 的 Google Search grounding。它和普通 Gemini 调用不是同一种消耗，可能因为搜索 grounding 配额、RPM、TPM 或 RPD 限制返回：

```text
HTTP 429 RESOURCE_EXHAUSTED
```

插件会把这类错误标注为 Search grounding 配额/速率限制，并按 profile 的 `fallbackProfiles` 尝试降级模型。内置联网 profile 默认使用：

```json
{
  "gemini-grounded": {
    "provider": "google",
    "model": "gemini-2.5-flash",
    "secretName": "gemini-default",
    "groundingMode": "google_search",
    "fallbackProfiles": ["gemini-grounded-lite", "gemini-grounded-20-flash"]
  },
  "gemini-grounded-lite": {
    "provider": "google",
    "model": "gemini-2.5-flash-lite",
    "secretName": "gemini-default",
    "groundingMode": "google_search"
  },
  "gemini-grounded-20-flash": {
    "provider": "google",
    "model": "gemini-2.0-flash",
    "secretName": "gemini-default",
    "groundingMode": "google_search"
  }
}
```

如果全部 fallback 仍然 429，说明当前 API key 或 Google Cloud 项目的联网 grounding 配额已经耗尽。处理方式：

- 等待配额窗口恢复。
- 降低联网调用频率。
- 检查 AI Studio / Google Cloud 的 billing 和 quota。
- 临时改为不联网调用。
- 使用另一个具备可用联网配额的 API key。

## 8. API key 安全模型

- 不要在会话中粘贴真实 API key。
- 不要把 API key 放进命令行参数。
- 推荐使用 `node ./setup.mjs` 隐藏录入。
- 非交互场景可用 `--api-key-env GEMINI_API_KEY` 从本地环境变量读取。
- 多模型非交互场景可用 `--api-key-env gemini=GEMINI_API_KEY,deepseek=DEEPSEEK_API_KEY`。
- 旧 key 需要替换时使用 `--refresh-secrets`，不要先手动编辑 `secrets.json`。
- 本地 `.data/secrets.json` 只保存加密内容，不保存明文 API key。
- `secret_get` 只验证是否可解密，不返回明文 key。

## 9. 不应上传 GitHub 的文件

以下是本地生成或可能含敏感信息的文件/目录：

```text
./.tmp/
./plugins/Codex-Gemini-Llmcaller/.data/
$HOME/plugins/Codex-Gemini-Llmcaller/.data/secrets.json
$HOME/plugins/Codex-Gemini-Llmcaller/.data/config.json
$HOME/plugins/multi-model-api/.data/
$HOME/.agents/plugins/marketplace.json
$HOME/.agents/plugins/marketplace.json.bak
```

上传前建议执行：

```powershell
node ./plugins/Codex-Gemini-Llmcaller/scripts/release-check.mjs
```

## 10. 自测

基础自测：

```powershell
node ./plugins/Codex-Gemini-Llmcaller/scripts/self-test.mjs
```

真实 Gemini 调用自测：

```powershell
node ./plugins/Codex-Gemini-Llmcaller/scripts/self-test.mjs --real-gemini
```

指定真实 profile 调用自测：

```powershell
node ./plugins/Codex-Gemini-Llmcaller/scripts/self-test.mjs --real-profile deepseek-default
```

更多测试用例见：

```text
./TEST_CASES.zh-CN.md
```

## 11. 兜底调用显示模型与用量

正常情况下，Codex 会直接调用插件暴露的 `call_model` MCP 工具，回答末尾会按 `outputMetaFooter` 显示模型、profile 和 token 用量。

如果当前会话没有直接暴露 `call_model`，Codex 可能会通过本地脚本兜底调用。兜底时必须使用插件的格式化输出，不能只打印 `callModel().text`。推荐方式是在插件目录下执行：

```powershell
@'
{
  "prompt": "用 Gemini 回答：只输出 OK。",
  "executionMode": "raw",
  "groundingMode": "off",
  "strictDelegation": true
}
'@ | node ./scripts/call-model-local.mjs
```

该脚本内部调用 `handleToolCall("call_model")`，会输出与 MCP 工具一致的可见文本，包括模型和 token footer。

## 12. DeepSeek

插件已按 DeepSeek 官方 OpenAI-compatible Chat Completions 接口接入 DeepSeek。

官方配置要点：

- `provider`: `openai-compatible`
- `baseUrl`: `https://api.deepseek.com`
- API key 环境变量：`DEEPSEEK_API_KEY`
- 推荐模型：`deepseek-v4-flash`、`deepseek-v4-pro`

内置 profile：

```text
deepseek-default -> deepseek-v4-flash, thinkingMode 关闭
deepseek-pro     -> deepseek-v4-pro, thinkingMode 启用
```

如果要使用本地加密 secret，建议通过初始化命令把 DeepSeek API key 保存为 `deepseek-default`。不要把真实 API key 粘贴到聊天、命令行参数、日志或仓库文件中。

```powershell
node ./setup.mjs --providers deepseek --default-profile deepseek-default
```

一次性显式调用示例：

```json
{
  "provider": "openai-compatible",
  "model": "deepseek-v4-flash",
  "baseUrl": "https://api.deepseek.com",
  "apiKeyEnv": "DEEPSEEK_API_KEY",
  "prompt": "请简短解释这个方案。",
  "executionMode": "raw",
  "groundingMode": "off"
}
```

用于核对 Codex 之前回答时，插件会优先使用紧凑的 `outputMode: "json"`，减少长评语回流到 Codex 上下文：

```json
{
  "profileName": "deepseek-default",
  "messages": [
    {
      "role": "user",
      "content": "请检查上面的 Codex 回答是否合理。"
    }
  ],
  "executionMode": "review",
  "inputSource": "context",
  "outputMode": "json"
}
```

如果要启用 DeepSeek thinking，可在 profile 或单次调用中设置：

```json
{
  "thinkingMode": "enabled",
  "reasoningEffort": "high"
}
```

DeepSeek 不提供 Gemini Google Search grounding。需要联网搜索时仍应使用支持联网的 Gemini grounded profile，或配置具备联网能力的其他 provider/profile。

## 13. 输出模式

`call_model` 支持以下输出模式，用于控制返回给 Codex 的文本长度：

- `full`: 直接返回完整模型文本。
- `json`: review 场景默认模式，要求模型返回紧凑 JSON，并在结构化结果中提供 `outputJson`。
- `summary`: 要求 review 场景返回简短自然语言摘要。
- `preview`: 只返回有限长度预览，结构化结果中包含 `outputPreview` 截断信息。
- `file`: 完整模型输出写入当前工作区 `.tmp/model-results/`，聊天里只返回文件路径和短预览。

`file` 模式适合长报告、长代码审查和需要降低 Codex 上下文占用的场景。默认不会写用户级插件目录。

示例：

```json
{
  "profileName": "deepseek-default",
  "prompt": "请生成一份较长的评审报告。",
  "outputMode": "file",
  "previewChars": 800
}
```

可用 `provider_capabilities` 查看路由能力表，包括 Gemini、DeepSeek、Anthropic 和 OpenAI-compatible provider 是否支持 JSON、图片、联网 grounding、thinking 等能力。
