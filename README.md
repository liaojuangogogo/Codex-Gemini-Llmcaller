# Codex-Gemini-Llmcaller

`Codex-Gemini-Llmcaller` 是一个本地 Codex 插件，用于在会话中通过加密保存的 API key 调用 Gemini、DeepSeek 和其他大模型服务。默认安装后可直接使用 Gemini，也支持通过初始化参数或本地配置文件接入多模型、自定义模型、超时时间、token、fallback、自动续写、联网 grounding 和图片输入。

## 快速安装

克隆仓库后，在仓库根目录运行：

```powershell
node ./setup.mjs
```

初始化脚本会检查 Node.js、Windows PowerShell 和目标目录写入权限，默认隐藏录入 Gemini API key，将插件安装到当前用户的 Codex 插件目录，写入用户级 marketplace，并且只保存加密后的 secret。

如果要同时初始化 Gemini 和 DeepSeek：

```powershell
node ./setup.mjs --providers gemini,deepseek
```

如果只初始化 DeepSeek 并设为默认 profile：

```powershell
node ./setup.mjs --providers deepseek --default-profile deepseek-default
```

环境要求：

- Windows
- Node.js 18 或更高版本
- Windows PowerShell
- Codex Desktop
- Codex Desktop 已对本地项目/插件目录授权“完全访问权限”

如果没有完全访问权限，客户端可能无法读取用户级插件目录、启动 MCP server 或访问本地加密配置。

## 使用方式

方式一：直接在会话中叫 Gemini。

```text
用 Gemini 检查一下这个回答。
```

方式二：在 Codex 的插件页把插件添加到会话后使用。

1. 左侧进入“插件”。
2. 顶部选择“插件”页签。
3. 在插件源下拉中选择本地插件源，例如 `Codex-Gemini-Llmcaller Local Plugins`。
4. 找到 `Codex-Gemini-Llmcaller`，点击 `+`。
5. 在会话中试用或添加到当前会话，然后说：

```text
@Codex-Gemini-Llmcaller 检查上面的回答。
```

## 联网与降级

普通问题默认不联网。涉及“今天、最新、天气、新闻、价格、联网、搜索、实时”等信息时，插件会让 Gemini 使用 Google Search grounding，而不是由 Codex 先查资料。

联网 profile 默认使用 `gemini-2.5-flash`，并可降级到 `gemini-2.5-flash-lite`、`gemini-2.0-flash`。如果联网调用返回 `HTTP 429 RESOURCE_EXHAUSTED`，通常是 Search grounding 配额或速率限制，插件会返回明确错误并尝试配置的 fallback。

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

- `deepseek-default`：`deepseek-v4-flash`，关闭 thinking
- `deepseek-pro`：`deepseek-v4-pro`，启用 thinking

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
node ./plugins/Codex-Gemini-Llmcaller/scripts/self-test.mjs
```

完成初始化安装后，可执行真实 Gemini 调用自测：

```powershell
node ./plugins/Codex-Gemini-Llmcaller/scripts/self-test.mjs --real-gemini
```

也可以指定真实 profile：

```powershell
node ./plugins/Codex-Gemini-Llmcaller/scripts/self-test.mjs --real-profile deepseek-default
```

## 文档入口

- 安装指南：`./INSTALL.zh-CN.md`
- 用户文档：`./USER_GUIDE.zh-CN.md`
- 测试用例：`./TEST_CASES.zh-CN.md`
