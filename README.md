# Codex-Llmcaller

`Codex-Llmcaller` 是一个本地 Codex 插件，用于在会话中通过加密保存的 API key 调用 Gemini、DeepSeek 和其他大模型服务。默认安装后可直接使用 Gemini，也支持通过初始化参数或本地配置文件接入多模型、自定义模型、超时时间、token、fallback、自动续写、联网 grounding 和图片输入。

## 快速安装

第一次使用建议按下面顺序操作。

1. 准备 Node.js 18+、Windows PowerShell、Codex Desktop，以及需要使用的 provider API key。
2. 完全退出 Codex Desktop。
3. 在本项目仓库根目录打开 PowerShell。
4. 运行环境检查：

```powershell
node ./setup.mjs --check-only
```

5. 初始化插件和 API key。

只使用 Gemini：

```powershell
node ./setup.mjs
```

同时使用 Gemini 和 DeepSeek：

```powershell
node ./setup.mjs --providers gemini,deepseek
```

脚本会隐藏录入 API key，把插件安装到用户级插件目录，写入 marketplace，只保存加密后的 secret，并做一次轻量真实 API 验证。

6. 完全重启 Codex Desktop。
7. 在“插件”页选择 `Codex-Llmcaller Local Plugins`，找到 `Codex-Llmcaller`，点击 `+` 添加到会话。
8. 如果插件源没有出现，手动添加插件市场：来源选择本项目仓库根目录或 `https://github.com/liaojuangogogo/Codex-Llmcaller`，Git 引用本地留空、GitHub 填 `refs/heads/main`，稀疏路径留空。

不要只稀疏加载 `.agents/plugins`，否则客户端可能只读到 marketplace 条目，却找不到实际插件包，导致安装按钮置灰。完整步骤见 [安装指南](./INSTALL.zh-CN.md)。

## 使用方式

默认 Gemini：

```text
用 Gemini 检查一下这个回答。
```

DeepSeek：

```text
用 DeepSeek 检查一下这个回答。
```

DeepSeek 高质量核对：

```text
用 DeepSeek Pro 检查上面的方案，返回主要问题和修改建议。
```

自动路由：

```text
让插件自动选择合适模型，检查上面的回答是否合理。
```

联网或图片场景应使用 Gemini：

```text
用 Gemini 联网查询今天的公开信息后回答。
用 Gemini 看这张截图并指出问题。
```

把插件添加到会话后，也可以用 mention 方式调用：

```text
@Codex-Llmcaller 检查上面的回答。
```

如果需要稳定指定模型，也可以在调用参数中使用 `profileName`：`gemini-default`、`gemini-upgrade`、`gemini-grounded`、`gemini-grounded-upgrade`、`deepseek-default`、`deepseek-pro`。

## 联网与降级

普通问题默认不联网。涉及“今天、最新、天气、新闻、价格、联网、搜索、实时”等信息时，插件会让 Gemini 使用 Google Search grounding，而不是由 Codex 先查资料。

联网 profile 默认使用 `gemini-3.1-flash-lite`。需要更强模型时可升级到 `gemini-3-flash-preview`，联网 fallback 顺序为 `gemini-grounded`、`gemini-grounded-upgrade`、`gemini-grounded-lite`、`gemini-grounded-20-flash`。如果联网调用返回 `HTTP 429 RESOURCE_EXHAUSTED`，通常是 Search grounding 配额或速率限制，插件会返回明确错误并尝试配置的 fallback。

## DeepSeek

插件已按 DeepSeek 官方 OpenAI-compatible Chat Completions 接口接入：

```json
{
  "provider": "openai-compatible",
  "model": "deepseek-v4-flash",
  "baseUrl": "https://api.deepseek.com",
  "apiKeyEnv": "DEEPSEEK_API_KEY"
}
```

内置 profile：

- `deepseek-default`：`deepseek-v4-flash`，默认启用 thinking，`reasoningEffort: "high"`
- `deepseek-pro`：`deepseek-v4-pro`，启用 thinking，`reasoningEffort: "high"`

核对 Codex 之前回答时，插件默认使用紧凑的 `outputMode: "json"`，避免外部模型的长评语回流到 Codex 上下文。

## 输出模式

`call_model` 支持以下输出控制：

- `full`：在聊天中返回完整模型文本。
- `json`：要求 review 调用返回紧凑结构化 JSON，并解析到 `outputJson`。
- `summary`：要求 review 调用返回简短自然语言摘要。
- `preview`：只返回有限长度预览，并记录截断元数据。
- `file`：把完整模型输出保存到当前工作区 `.tmp/model-results/`，聊天中只返回短预览和保存路径。

可使用 `provider_capabilities` 查看 Gemini、DeepSeek、Anthropic 和 OpenAI-compatible provider 的路由能力表。

默认调用保持 profile 兼容行为。需要插件自主选择模型或是否联网时，可显式传 `routingMode: "auto"`。

## 自测

```powershell
node ./plugins/Codex-Llmcaller/scripts/self-test.mjs
```

完成初始化安装后，可执行真实 Gemini 调用自测：

```powershell
node ./plugins/Codex-Llmcaller/scripts/self-test.mjs --real-gemini
```

也可以指定真实 profile：

```powershell
node ./plugins/Codex-Llmcaller/scripts/self-test.mjs --real-profile deepseek-default
```

## 文档入口

- 安装指南：`./INSTALL.zh-CN.md`
- 用户文档：`./USER_GUIDE.zh-CN.md`
- 测试用例：`./TEST_CASES.zh-CN.md`
