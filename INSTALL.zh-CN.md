# Codex-Llmcaller 安装指南

本文按“第一次使用”的实际顺序说明安装步骤。不要在聊天、命令行参数、日志或仓库文件中粘贴真实 API key。

## 1. 准备工作

安装前先确认以下条件：

- Windows。
- Node.js 18 或更高版本。
- Windows PowerShell。
- 已安装 Codex Desktop。
- Codex Desktop 已对本项目仓库或用户级插件目录授权“完全访问权限”。
- 已准备需要使用的 provider API key，例如 Gemini API key，或 Gemini + DeepSeek API key。

开始前请完全退出 Codex Desktop。这样可以避免旧插件进程占用文件，也能让后续重启时加载新版本。

## 2. 打开仓库终端

在 PowerShell 中进入本项目仓库根目录。后续命令都应在仓库根目录执行。

只检查环境、不安装，可以先运行：

```powershell
node ./setup.mjs --check-only
```

看到 `Environment check passed.` 后，再继续初始化。

## 3. 初始化插件和 API key

如果只需要 Gemini，运行：

```powershell
node ./setup.mjs
```

如果第一次就要同时配置 Gemini 和 DeepSeek，推荐运行：

```powershell
node ./setup.mjs --providers gemini,deepseek
```

脚本会按 provider 顺序隐藏录入 API key，并完成以下工作：

- 复制 `./plugins/Codex-Llmcaller` 到当前用户的插件目录。
- 保留目标目录已有 `.data/`，避免覆盖已有加密 secret。
- 如发现旧插件的数据目录，且新目录还没有 `.data/`，会自动迁移旧加密数据。
- 写入可稳定启动 MCP server 的 `.mcp.json`。
- 创建或合并更新用户级 marketplace。
- 清理 Codex Desktop 的旧插件缓存，避免继续加载旧版本。
- 写入 profile 后，对每个 provider 做一次轻量真实 API 验证。

API 验证只要求模型回复 `OK`，用于确认 key、模型、权限、余额/配额和网络链路实际可用。

## 4. 选择可选初始化方式

如果已有 secret，但需要重新录入或替换旧 key：

```powershell
node ./setup.mjs --providers gemini,deepseek --refresh-secrets
```

如果只想安装或更新插件文件，不录入 API key，也不写入 profile：

```powershell
node ./setup.mjs --install-only --yes
```

如果只配置 DeepSeek，并把全局默认 profile 设为 DeepSeek：

```powershell
node ./setup.mjs --providers deepseek --default-profile deepseek-default
```

如果同时配置 Gemini 和 DeepSeek，但希望未明确指定模型时默认走 DeepSeek：

```powershell
node ./setup.mjs --providers gemini,deepseek --default-profile deepseek-default
```

如果当前网络不能访问 provider，或只是离线安装，可以临时跳过真实 API 验证：

```powershell
node ./setup.mjs --providers gemini,deepseek --skip-api-validate
```

跳过验证只表示安装流程不调用外部 API，不代表 key 或模型一定可用。

## 5. 非交互初始化

自动化环境可以提前注入环境变量，然后让脚本只读取环境变量名。不要把真实 API key 写进命令行。

只导入 Gemini：

```powershell
node ./setup.mjs --api-key-env GEMINI_API_KEY --yes
```

同时导入 Gemini 和 DeepSeek：

```powershell
node ./setup.mjs --providers gemini,deepseek --api-key-env gemini=GEMINI_API_KEY,deepseek=DEEPSEEK_API_KEY --refresh-secrets --yes
```

日常本地刷新 key 时，优先使用交互式隐藏录入：

```powershell
node ./setup.mjs --providers gemini,deepseek --refresh-secrets
```

## 6. 重启 Codex Desktop

初始化完成后，完全启动或重启 Codex Desktop。必须重启，客户端才会重新读取 marketplace、插件缓存和 MCP 配置。

## 7. 在 Codex Desktop 添加插件到会话

重启后，如果插件源已经出现：

1. 打开 Codex Desktop。
2. 左侧进入“插件”。
3. 顶部选择“插件”页签。
4. 在插件源下拉中选择 `Codex-Llmcaller Local Plugins`。
5. 在 Productivity 分类下找到 `Codex-Llmcaller`。
6. 点击 `+`。
7. 选择“在对话中试用”，或添加到当前会话。

添加后可以在会话中说：

```text
@Codex-Llmcaller 检查上面的回答。
```

## 8. 手动添加插件市场

如果插件源没有自动出现，可以手动添加插件市场：

1. 打开 Codex Desktop 的“插件”页。
2. 点击右上角“管理”旁的“创建”菜单。
3. 选择“添加插件市场”。
4. 按以下方式填写。
5. 点击“添加市场”，等待插件源出现在下拉列表中。
6. 回到插件列表，把 `Codex-Llmcaller` 添加到会话。

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

## 9. 验证是否可用

插件添加到会话后，可以先做一个不联网的简单检查：

```text
用 Gemini 检查一下这个回答。
```

如果已初始化 DeepSeek，也可以测试：

```text
用 DeepSeek 检查一下这个回答。
```

需要联网或图片时使用 Gemini：

```text
用 Gemini 联网查询今天的公开信息后回答。
用 Gemini 看这张截图并指出问题。
```

自动路由场景可以说：

```text
让插件自动选择合适模型，检查上面的回答是否合理。
```

普通请求默认不联网。涉及“今天、最新、天气、新闻、价格、联网、搜索、实时”等信息时，插件会让 Gemini 使用 Google Search grounding；Codex 不会先查资料再喂给 Gemini。

## 10. 常见故障

如果初始化阶段提示 `Provider API validation failed`，说明插件文件、profile 和加密 secret 已经写入，但至少一个 provider 不能完成真实 API 调用。常见原因是 key 复制错误、key 已失效、模型权限不足、余额/配额不足或网络代理问题。修复 key 后重新运行：

```powershell
node ./setup.mjs --providers gemini,deepseek --refresh-secrets
```

如果提示文件被占用，请完全退出 Codex Desktop 和正在编辑插件目录的编辑器后重试。

如果提示 marketplace JSON 解析失败，脚本会先生成 `marketplace.json.bak`。请手动修复原 JSON 后重新运行：

```powershell
node ./setup.mjs
```

如果插件卡片可见但安装按钮置灰，优先检查手动添加插件市场时“稀疏路径”是否为空。只加载 `.agents/plugins` 会导致客户端找不到实际插件包。

如果插件标签能出现但 `call_model` 工具没有暴露，重点确认 Codex Desktop 有“完全访问权限”，并完全重启 Codex Desktop。

如果其他会话提示 `Secret 'gemini-default' was not found`，通常是客户端从插件缓存运行了副本，但 secret 保存在用户级插件目录。新版插件默认会固定读取 `$HOME/plugins/Codex-Llmcaller/.data/`，重启 Codex Desktop 后应能恢复。

如果仍然报同样错误，请完全退出 Codex Desktop 后重新运行：

```powershell
node ./setup.mjs --providers gemini,deepseek --yes
```

## 11. 当前内置模型

- `gemini-default`：`gemini-3.1-flash-lite`
- `gemini-upgrade`：`gemini-3-flash-preview`
- `gemini-grounded`：`gemini-3.1-flash-lite`
- `gemini-grounded-upgrade`：`gemini-3-flash-preview`
- `gemini-grounded-lite`：`gemini-2.5-flash-lite`
- `gemini-grounded-20-flash`：`gemini-2.0-flash`
- `deepseek-default`：`deepseek-v4-flash`
- `deepseek-pro`：`deepseek-v4-pro`

如果要让 Codex Desktop 使用仓库中的新版本，重新运行 `setup.mjs` 后必须完全重启 Codex Desktop。
