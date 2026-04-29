# Codex-Gemini-Llmcaller

`Codex-Gemini-Llmcaller` 是一个本地 Codex 插件，用于在会话中通过加密保存的 API key 调用 Gemini 和其他大模型服务。默认安装后可直接使用 Gemini，也支持通过本地配置文件自定义模型、超时时间、token、fallback 和自动续写。

## 快速安装

克隆仓库后，在仓库根目录运行：

```powershell
node ./setup.mjs
```

初始化脚本会检查 Node.js、Windows PowerShell 和目标目录写入权限，隐藏录入 Gemini API key，将插件安装到当前用户的 Codex 插件目录，写入用户级 marketplace，并且只保存加密后的 secret。

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

## 自测

```powershell
node ./plugins/Codex-Gemini-Llmcaller/scripts/self-test.mjs
```

完成初始化安装后，可执行真实 Gemini 调用自测：

```powershell
node ./plugins/Codex-Gemini-Llmcaller/scripts/self-test.mjs --real-gemini
```

## 文档入口

- 安装指南：`./plugins/Codex-Gemini-Llmcaller/INSTALL.zh-CN.md`
- 用户文档：`./plugins/Codex-Gemini-Llmcaller/USER_GUIDE.zh-CN.md`
- 测试用例：`./plugins/Codex-Gemini-Llmcaller/TEST_CASES.zh-CN.md`
