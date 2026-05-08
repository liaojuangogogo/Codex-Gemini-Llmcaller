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

初始化会按 `--providers` 的顺序逐个隐藏录入 API key，写入本地加密 secret 后立即用每个 provider 的默认 profile 做一次轻量真实调用验证。这样可以在安装阶段发现 key 复制错误、权限不足、余额/配额不足或模型不可用等问题。

如果已有 secret 但需要替换旧 key：

```powershell
node ./setup.mjs --providers gemini,deepseek --refresh-secrets
```

如果要用本地环境变量导入多个 provider 的 key，避免 key 出现在命令行参数中：

```powershell
node ./setup.mjs --providers gemini,deepseek --api-key-env gemini=GEMINI_API_KEY,deepseek=DEEPSEEK_API_KEY --refresh-secrets --yes
```

只有在离线安装、代理未配置或明确不想产生验证调用时，才使用：

```powershell
node ./setup.mjs --providers gemini,deepseek --skip-api-validate
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

在 Codex 的插件页把插件添加到会话后也可使用：

1. 先运行 `node ./setup.mjs --providers gemini,deepseek`，完成安装、API key 录入和 marketplace 注册。
2. 完全重启 Codex Desktop。
3. 左侧进入“插件”，顶部选择“插件”页签。
4. 在插件源下拉中选择本地插件源，例如 `Codex-Gemini-Llmcaller Local Plugins`。
5. 找到 `Codex-Gemini-Llmcaller`，点击 `+`。
6. 在会话中试用或添加到当前会话，然后说：

```text
@Codex-Gemini-Llmcaller 检查上面的回答。
```

如果新版 Codex Desktop 没有自动显示本地插件源，可以点击“管理”旁的“创建”菜单，选择添加插件市场：

- 本地仓库方式：来源填 `E:\Git\Codex-Gemini-Llmcaller`，Git 引用留空，稀疏路径填 `.agents/plugins`。
- GitHub 方式：来源填 `https://github.com/liaojuangogogo/Codex-Gemini-Llmcaller`，Git 引用填 `refs/heads/main`，稀疏路径填 `.agents/plugins`。

如果本地仓库方式提示添加失败，再把来源改为 `E:\Git\Codex-Gemini-Llmcaller\.agents\plugins`，稀疏路径留空。无论用哪种方式添加插件市场，API key 仍需要通过 `setup.mjs` 初始化到本机加密 secret。

如果需要稳定指定模型，也可以在调用参数中使用 `profileName`：`gemini-default`、`gemini-grounded`、`deepseek-default`、`deepseek-pro`。

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
