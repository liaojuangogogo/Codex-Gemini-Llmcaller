# Codex-Gemini-Llmcaller 改造需求与评估

本文记录后续改造需求、设计取舍和优先级。目标是在保持严格委托边界和本地 secret 安全模型的前提下，降低 Codex 额度消耗，扩展多模型能力，并让插件具备更稳定的路由、联网和失败降级策略。

## 1. Codex 回答核对场景的低额度模式

### 需求

当用户要求“用 Gemini 检查 Codex 之前的回答是否合理”时，默认不要让外部模型返回长篇全文 review。插件应优先让外部模型完成完整判断，但只把结构化结论或短摘要返回给 Codex。

### 推荐输出结构

```json
{
  "verdict": "correct | mostly_correct | has_issues | incorrect | uncertain",
  "severity": "none | low | medium | high | critical",
  "confidence": 0.82,
  "issues": [
    {
      "title": "问题标题",
      "severity": "medium",
      "reason": "简短原因",
      "correction": "简短修正"
    }
  ],
  "missing_context": "缺少的关键前提，没有则为空",
  "suggested_correction": "限制长度的修正版",
  "need_full_review": false
}
```

### 字段限制

- `issues` 默认最多 5 条。
- 单条 `reason` 和 `correction` 应保持短句，避免长篇解释。
- `suggested_correction` 默认限制在约 300-500 中文字或等价 token 范围内。
- 只有当 `severity` 为 `high` 或 `critical`，且 `need_full_review` 为 `true` 时，才建议生成完整报告。

### 输出模式评估

| 模式 | 适用场景 | Codex 额度影响 | 评估 |
| --- | --- | --- | --- |
| `json` | 默认核对、自动化判断 | 低 | 最适合作为默认模式，信噪比高，便于 Codex 采纳修正 |
| `summary` | JSON 解析失败或用户只要结论 | 低 | 作为降级模式可靠 |
| `file + summary` | 长回答、复杂方案、完整审查报告 | 很低 | 完整报告写入项目内临时文件，聊天只返回摘要和路径 |
| `full` | 用户明确要求外部模型原文 | 高 | 不应作为默认模式 |

### 实现建议

- 新增 `outputMode: "full" | "summary" | "json" | "file" | "preview"`。
- 对 `executionMode: "review"` 且 `inputSource: "context"` 的请求，默认使用 `json` 或 `summary`。
- 对 JSON 解析失败场景，降级为 `summary` 文本，不中断调用。
- 如实现 `file` 模式，完整结果只能写入当前授权项目路径及其子路径，不能写用户级插件目录，除非用户明确要求。

## 2. 路由微服务化

### 需求

将“判断调用哪个模型、是否联网、如何降级、如何限制输出”等路由逻辑从单个 MCP tool handler 中拆出。必要时可以重构工具接口，使路由成为可测试、可配置、可演进的独立模块。

### 评估

当前插件已经支持 profile、provider、fallback、grounding 和 executionMode，但路由逻辑仍主要围绕 `call_model` 参数和 profile 合并展开。随着多模型接入和自动路由增加，继续堆在主 server 文件中会增加维护成本。

建议先做“模块化路由”，暂不急于拆成真正的常驻微服务进程：

- 第一阶段：在同一 MCP server 内拆出 `router` 模块，输入用户意图和约束，输出标准化 `ResolvedRoute`。
- 第二阶段：如果后续需要多个 MCP tool 共享路由、引入队列、缓存、审计或独立部署，再考虑进程级微服务。

### 建议边界

路由模块只做决策，不直接调用模型，不读取 secret，不写用户数据。

建议输出结构：

```json
{
  "profileName": "gemini-default",
  "provider": "google",
  "model": "gemini-3-flash-preview",
  "groundingMode": "off",
  "executionMode": "review",
  "outputMode": "json",
  "fallbackProfiles": ["gemini-review-lite"],
  "reason": "review context request, no fresh information required"
}
```

## 3. 接入其他模型

### 需求

在 Gemini 之外，继续支持并完善其他模型提供商，例如 OpenAI-compatible provider、Anthropic、OpenRouter、DeepSeek、Groq、Mistral、xAI 等。

### 评估

当前 server 已经有 `provider: "google" | "openai-compatible" | "anthropic"` 和 `provider_presets`，因此“接入其他模型”的底座已经存在。后续重点不是简单增加 provider 名称，而是让不同 provider 在路由、错误分类、联网能力、token 统计、工具支持上表现一致。

### 建议优先级

1. 完善 OpenAI-compatible 路径：不同服务的 base URL、模型 id、错误格式和 token usage 兼容性。
2. 完善 Anthropic 路径：Messages API 参数、max tokens、system prompt、错误分类。
3. 增加 provider capability 描述：是否支持联网、图片、tool use、JSON 输出、reasoning 参数、缓存。
4. 文档化常用 profile 模板，不内置任何 API key。

## 4. 自主路由：模型、联网与失败降级

### 需求

插件应能根据用户意图自主选择：

- 使用哪个 profile/model。
- 是否启用联网 grounding。
- 是否使用图片输入。
- 失败后如何按 provider/model/profile 降级。
- 输出完整结果、摘要、JSON 还是文件。

### 评估

该需求合理，但必须保留严格委托边界：

- Codex 可以判断“该如何调用外部模型”。
- 插件路由可以基于明确规则选择 profile 和 fallback。
- Codex 和插件都不应在调用外部模型前替外部模型搜索、整理事实或添加结论。

### 建议规则

| 用户意图 | 默认路由 |
| --- | --- |
| 普通问答、解释、写作 | 默认 profile，`groundingMode: "off"`，`outputMode: "full"` 或 `summary` |
| 核对 Codex 回答 | review profile，`groundingMode: "off"`，`outputMode: "json"` |
| 最新、今天、新闻、天气、价格、实时 | grounded profile，`groundingMode: "google_search"` |
| 图片、截图、照片检查 | 支持图片的 profile，附带 `imageInputs` |
| 长报告或复杂审查 | `outputMode: "file"` 加短摘要 |
| 失败、429、403、400 参数不兼容 | 按错误分类选择 fallback profile |

### 降级策略

- 429 quota/rate limit：优先切换同能力低成本或低配额压力 profile；如果是联网 grounding 429，应明确提示 grounding 配额问题。
- 403 permission/model access：切换到用户有权限的同 provider fallback，或提示检查模型权限。
- 400 unsupported parameter：移除不兼容参数后重试，例如 grounding 场景移除不支持的 thinking 配置。
- 5xx/network timeout：按 fallbackProfiles 顺序重试，并保留失败链路摘要。

## 5. 推荐实施顺序

1. 增加 `outputMode` 与 review 默认 `json/summary` 输出策略。
2. 为 review JSON 增加 `severity`、字段长度限制和解析失败降级。
3. 抽出路由模块，形成可单测的 `ResolvedRoute`。
4. 增加 provider capability 描述和多模型 profile 模板。
5. 扩展错误分类与 fallback 策略。
6. 评估是否需要进程级路由微服务；只有在模块化路由不足时再推进。

## 6. 风险与约束

- 不能把 API key 写入对话、命令行参数、日志或仓库文件。
- 默认不联网，只有用户意图明确需要新鲜或外部信息时才启用联网能力。
- 外部模型失败时必须返回明确错误，不能由 Codex 冒充外部模型回答。
- `file` 输出模式必须遵守当前项目授权边界，避免写入未授权路径。
- 路由自动化必须可解释，避免用户无法判断实际调用了哪个 provider/model。
