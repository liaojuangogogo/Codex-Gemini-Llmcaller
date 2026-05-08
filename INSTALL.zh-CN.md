# Codex-Llmcaller 安装指南

## 1. 安装前要求

- Windows
- Node.js 18 或更高版本
- Windows PowerShell
- Codex Desktop
- Codex Desktop 已对本地项目/插件目录授权“完全访问权限”

请在安装前完全退出 Codex Desktop，避免插件文件被占用。

## 2. 一键初始化

在仓库根目录执行：

```powershell
node ./setup.mjs
```

脚本默认初始化 Gemini，会隐藏录入 Gemini API key，并完成以下工作：

- 复制 `./plugins/Codex-Llmcaller` 到当前用户插件目录。
- 保留目标目录已有 `.data/`，避免覆盖已有加密 secret。
- 如果发现旧 `$HOME/plugins/Codex-Gemini-Llmcaller/.data/` 或 `$HOME/plugins/multi-model-api/.data/`，且新目录还没有 `.data/`，自动迁移旧加密数据。
- 在目标插件目录写入使用绝对 `server.mjs` 路径的 `.mcp.json`，避免客户端启动 MCP server 时受工作目录影响。
- 创建或合并更新 `$HOME/.agents/plugins/marketplace.json`。
- 清理本插件在 `$HOME/.codex/plugins/cache/` 下的旧缓存，避免客户端继续加载旧版本。

完成后重启 Codex Desktop。

如果要同时初始化 Gemini 和 DeepSeek：

```powershell
node ./setup.mjs --providers gemini,deepseek
```

脚本会按 provider 顺序分别隐藏录入 key，并写入不同 secret：

- Gemini: `gemini-default`
- DeepSeek: `deepseek-default`

写入 profile 后，脚本默认会对每个 provider 做一次轻量真实 API 验证。验证请求只要求模型回复 `OK`，用于确认 key、模型、权限、余额/配额和网络链路实际可用。

如果已有 secret 但需要重新录入或替换旧 key：

```powershell
node ./setup.mjs --providers gemini,deepseek --refresh-secrets
```

如果只想安装或更新文件，不做真实 API 验证：

```powershell
node ./setup.mjs --providers gemini,deepseek --skip-api-validate
```

如果只初始化 DeepSeek 并设为默认 profile：

```powershell
node ./setup.mjs --providers deepseek --default-profile deepseek-default
```

如果同时初始化 Gemini 和 DeepSeek，但希望全局默认走 DeepSeek：

```powershell
node ./setup.mjs --providers gemini,deepseek --default-profile deepseek-default
```

如果只安装或更新插件文件，不录入 API key，也不写入 profile：

```powershell
node ./setup.mjs --install-only --yes
```

## 3. 非交互安装

如果希望从本地环境变量读取 API key：

```powershell
node ./setup.mjs --api-key-env GEMINI_API_KEY --yes
```

多模型非交互初始化可以按 provider 指定环境变量名：

```powershell
node ./setup.mjs --providers gemini,deepseek --api-key-env gemini=GEMINI_API_KEY,deepseek=DEEPSEEK_API_KEY --refresh-secrets --yes
```

`--refresh-secrets` 会覆盖已有同名 secret，适合修复旧 key 可解密但实际不可用的情况。不要把 API key 作为命令行参数传入，也不要粘贴到会话中。

自动化环境可以提前由系统注入 `GEMINI_API_KEY`、`DEEPSEEK_API_KEY`。日常本地刷新 key 时，优先直接运行交互式命令，由脚本隐藏录入：

```powershell
node ./setup.mjs --providers gemini,deepseek --refresh-secrets
```

不要在 PowerShell 历史里写入真实 API key。

## 4. 在插件页添加到会话

推荐先用初始化脚本完成本地安装、API key 录入和 marketplace 注册：

```powershell
node ./setup.mjs --providers gemini,deepseek
```

完成后完全重启 Codex Desktop。如果插件源已经出现：

1. 打开 Codex Desktop。
2. 左侧点击“插件”。
3. 顶部选择“插件”页签。
4. 在插件源下拉中选择 `Codex-Llmcaller Local Plugins`。
5. 在 Productivity 分类下找到 `Codex-Llmcaller`。
6. 点击 `+`。
7. 选择“在对话中试用”，或把插件添加到当前会话。

添加后可以在会话中说：

```text
@Codex-Llmcaller 检查上面的回答。
```

如果新版 Codex Desktop 没有自动显示本地插件源，可以手动添加插件市场：

1. 在插件页点击右上角“管理”旁的“创建”菜单。
2. 选择“添加插件市场”。
3. 按以下任一方式填写。
4. 点击“添加市场”，等待插件市场出现在插件源列表中。

本地仓库方式：

```text
来源：本项目仓库根目录
Git 引用：（留空）
稀疏路径：（留空）
```

GitHub 方式：

```text
来源：https://github.com/liaojuangogogo/Codex-Llmcaller
Git 引用：refs/heads/main
稀疏路径：（留空）
```

不要只稀疏加载 `.agents/plugins`。本项目的 marketplace 条目会引用 `plugins/Codex-Llmcaller` 插件包；如果只加载 marketplace 目录，客户端可能显示插件卡片但无法解析插件包，安装按钮会置灰。

界面方式只负责让 Codex Desktop 发现插件市场。API key、profile 和本地加密 secret 仍由 `setup.mjs` 初始化；不要在界面、聊天或命令行参数中粘贴真实 API key。

## 5. 直接使用

如果插件已安装并且客户端已重启，也可以不手动添加插件，直接在会话中按模型说明使用。

默认 Gemini：

```text
用 Gemini 检查一下这个回答。
```

默认会使用 `gemini-default` profile，不需要每次说明 `secretName`。

DeepSeek：

```text
用 DeepSeek 检查一下这个回答。
```

默认使用 `deepseek-default`，并按 DeepSeek 官方思考模式启用 thinking；如果要更高质量或 Pro 模型，可说：

```text
用 DeepSeek Pro 检查上面的方案。
```

对应 `deepseek-pro` profile。

自动路由：

```text
让插件自动选择合适模型，检查上面的回答是否合理。
```

这类请求会使用 `routingMode: "auto"`，由插件根据场景选择 profile。

如果初始化时设置了 `--default-profile deepseek-default`，不明确指定模型时默认会使用 `deepseek-default`。也可以在调用时明确说使用 Gemini、DeepSeek，或通过 `profileName` 指定。

普通请求默认不联网。涉及“今天、最新、天气、新闻、价格、联网、搜索、实时”等信息时，插件会让 Gemini 使用 Google Search grounding；Codex 不会先查资料再喂给 Gemini。内置联网 profile 默认使用 `gemini-3.1-flash-lite`，需要更强模型时可升级到 `gemini-3-flash-preview`，并可继续 fallback 到 `gemini-2.5-flash-lite`、`gemini-2.0-flash`。

图片输入目前由 Gemini 支持；DeepSeek 内置 profile 不支持图片输入或 Google Search grounding。

## 6. 故障排查

只检查环境，不安装：

```powershell
node ./setup.mjs --check-only
```

如果提示文件被占用，请完全退出 Codex Desktop 和正在编辑插件目录的编辑器后重试。

如果初始化阶段提示 `Provider API validation failed`，说明插件文件、profile 和加密 secret 已经写入，但至少一个 provider 不能完成真实 API 调用。常见原因是 key 复制错误、key 已失效、模型权限不足、余额/配额不足或网络代理问题。修复 key 后重新运行：

```powershell
node ./setup.mjs --providers gemini,deepseek --refresh-secrets
```

如果只是离线安装或当前网络不能访问 provider，可以临时跳过验证：

```powershell
node ./setup.mjs --providers gemini,deepseek --skip-api-validate
```

如果提示 marketplace JSON 解析失败，脚本会先生成 `marketplace.json.bak`。请手动修复原 JSON 后重新运行：

```powershell
node ./setup.mjs
```

如果插件标签能出现但 `call_model` 工具没有暴露，重点检查目标插件目录中的 `.mcp.json` 是否使用了绝对 `server.mjs` 路径，并确认 Codex Desktop 有“完全访问权限”。

如果其他会话提示 `Secret 'gemini-default' was not found`，通常是客户端从 `$HOME/.codex/plugins/cache/` 运行了插件副本，但 secret 保存在用户级插件目录。新版插件默认会固定读取 `$HOME/plugins/Codex-Llmcaller/.data/`，重启 Codex Desktop 后应能恢复。

如果仍然报同样错误，请完全退出 Codex Desktop 后重新运行：

```powershell
node ./setup.mjs --yes
```

该命令会复用已有可解密 secret，并清理旧插件缓存。多模型场景下也可以使用：

```powershell
node ./setup.mjs --providers gemini,deepseek --yes
```
