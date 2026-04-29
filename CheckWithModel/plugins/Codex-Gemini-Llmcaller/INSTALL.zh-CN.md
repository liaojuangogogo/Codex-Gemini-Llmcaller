# Codex-Gemini-Llmcaller 安装指南

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

脚本会隐藏录入 Gemini API key，并完成以下工作：

- 复制 `./plugins/Codex-Gemini-Llmcaller` 到当前用户插件目录。
- 保留目标目录已有 `.data/`，避免覆盖已有加密 secret。
- 如果发现旧 `$HOME/plugins/multi-model-api/.data/`，且新目录还没有 `.data/`，自动迁移旧加密数据。
- 在目标插件目录写入使用绝对 `server.mjs` 路径的 `.mcp.json`，避免客户端启动 MCP server 时受工作目录影响。
- 创建或合并更新 `$HOME/.agents/plugins/marketplace.json`。

完成后重启 Codex Desktop。

## 3. 非交互安装

如果希望从本地环境变量读取 API key：

```powershell
$env:GEMINI_API_KEY="你的本地key"
node ./setup.mjs --api-key-env GEMINI_API_KEY --yes
Remove-Item Env:\GEMINI_API_KEY
```

不要把 API key 作为命令行参数传入，也不要粘贴到会话中。

## 4. 在插件页添加到会话

如果你希望按界面方式添加插件：

1. 打开 Codex Desktop。
2. 左侧点击“插件”。
3. 顶部选择“插件”页签。
4. 在插件源下拉中选择 `Codex-Gemini-Llmcaller Local Plugins`。
5. 在 Productivity 分类下找到 `Codex-Gemini-Llmcaller`。
6. 点击 `+`。
7. 选择“在对话中试用”，或把插件添加到当前会话。

添加后可以在会话中说：

```text
@Codex-Gemini-Llmcaller 检查上面的回答。
```

## 5. 直接使用

如果插件已安装并且客户端已重启，也可以不手动添加插件，直接在会话中说：

```text
用 Gemini 检查一下这个回答。
```

默认会使用 `gemini-default` profile，不需要每次说明 `secretName`。

## 6. 故障排查

只检查环境，不安装：

```powershell
node ./setup.mjs --check-only
```

如果提示文件被占用，请完全退出 Codex Desktop 和正在编辑插件目录的编辑器后重试。

如果提示 marketplace JSON 解析失败，脚本会先生成 `marketplace.json.bak`。请手动修复原 JSON 后重新运行：

```powershell
node ./setup.mjs
```

如果插件标签能出现但 `call_model` 工具没有暴露，重点检查目标插件目录中的 `.mcp.json` 是否使用了绝对 `server.mjs` 路径，并确认 Codex Desktop 有“完全访问权限”。
