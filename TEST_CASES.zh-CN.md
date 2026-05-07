# Codex-Gemini-Llmcaller 测试用例

以下命令默认在仓库根目录执行。

## 1. 环境检查

```powershell
node ./plugins/Codex-Gemini-Llmcaller/scripts/check-env.mjs
```

预期：

- Node.js 版本不低于 18。
- Windows 和 PowerShell 检查通过。
- 用户级插件目录和 marketplace 目录可写。

## 2. 发布检查

```powershell
node ./plugins/Codex-Gemini-Llmcaller/scripts/release-check.mjs
```

预期：

- JSON 文件可解析。
- 仓库内没有开发机绝对路径。
- `./.tmp/` 和 `./plugins/Codex-Gemini-Llmcaller/.data/` 内没有待上传文件。
- `.gitignore` 忽略 `.tmp/`，插件 `.gitignore` 忽略 `.data/`。

## 3. 本地回归

```powershell
node ./plugins/Codex-Gemini-Llmcaller/scripts/self-test.mjs
```

预期：

- 所有脚本语法检查通过。
- MCP smoke 通过。
- secret 加解密、Gemini 请求构造、多模型 profile、provider registry、自动续写、fallback、token usage 和配置容错测试通过。

## 4. 初始化安装

```powershell
node ./setup.mjs
```

预期：

- 隐藏输入 Gemini API key。
- 用户级目录 `$HOME/plugins/Codex-Gemini-Llmcaller` 存在。
- 目标 `.mcp.json` 中 `args[0]` 是绝对 `server.mjs` 路径。
- 用户级 marketplace 包含 `Codex-Gemini-Llmcaller`。
- `.data/secrets.json` 不包含明文 API key。
- `$HOME/.codex/plugins/cache/codex-gemini-llmcaller-local/Codex-Gemini-Llmcaller` 旧缓存被清理，重启客户端后会重新生成新版本缓存。

多模型初始化：

```powershell
node ./setup.mjs --providers gemini,deepseek
```

预期：

- 依次隐藏输入 Gemini 和 DeepSeek API key。
- 生成或复用 `gemini-default`、`deepseek-default` secret。
- 写入 Gemini 与 DeepSeek 内置 profile。
- 不覆盖已有可解密 secret。

只初始化 DeepSeek 并设为默认 profile：

```powershell
node ./setup.mjs --providers deepseek --default-profile deepseek-default
```

预期：

- 隐藏输入 DeepSeek API key。
- 默认 profile 为 `deepseek-default`。

## 5. 旧数据迁移

前置条件：

- `$HOME/plugins/multi-model-api/.data/` 存在。
- `$HOME/plugins/Codex-Gemini-Llmcaller/.data/` 不存在。

执行：

```powershell
node ./setup.mjs
```

预期：

- 新目录自动获得旧 `.data/`。
- 旧 `$HOME/plugins/multi-model-api` 不被删除。
- 如旧 secret 可解密，脚本跳过 API key 输入。

## 6. 非交互安装

```powershell
$env:GEMINI_API_KEY="你的本地key"
node ./setup.mjs --api-key-env GEMINI_API_KEY --yes
Remove-Item Env:\GEMINI_API_KEY
```

预期：

- 不通过命令行参数暴露 key。
- 安装完成。
- secret 加密保存。

多模型非交互安装：

```powershell
$env:GEMINI_API_KEY="你的本地key"
$env:DEEPSEEK_API_KEY="你的本地key"
node ./setup.mjs --providers gemini,deepseek --api-key-env gemini=GEMINI_API_KEY,deepseek=DEEPSEEK_API_KEY --yes
Remove-Item Env:\GEMINI_API_KEY
Remove-Item Env:\DEEPSEEK_API_KEY
```

预期：

- 每个 provider 从对应环境变量读取 API key。
- `secrets.json` 不包含明文 API key。

## 7. 真实 Gemini

```powershell
node ./plugins/Codex-Gemini-Llmcaller/scripts/self-test.mjs --real-gemini
```

预期：

- 使用已安装的 `gemini-default` secret 调用 Gemini。
- 返回非空文本。
- 结果不含明文 API key。

真实 profile 自测：

```powershell
node ./plugins/Codex-Gemini-Llmcaller/scripts/self-test.mjs --real-profile deepseek-default
```

预期：

- 使用已安装的 `deepseek-default` secret 调用 DeepSeek。
- 返回非空文本。
- 结果不含明文 API key。

## 8. 客户端验证

先确认 Codex Desktop 已对本地项目/插件目录授权“完全访问权限”，然后重启客户端。

直接使用：

```text
用 Gemini 回答：只输出 OK。
```

预期：不需要说明 `secretName`，插件自动使用 Gemini 默认 profile。

DeepSeek：

```text
用 DeepSeek 检查上面的回答。
```

预期：使用 `deepseek-default` profile。

DeepSeek Pro：

```text
用 DeepSeek Pro 检查上面的方案。
```

预期：使用 `deepseek-pro` profile。

自动路由：

```text
让插件自动选择合适模型，检查上面的回答是否合理。
```

预期：调用中体现 `routingMode: "auto"`，并按场景选择 profile。

插件页添加方式：

1. 左侧进入“插件”。
2. 顶部选择“插件”页签。
3. 插件源下拉选择 `Codex-Gemini-Llmcaller Local Plugins`。
4. 找到 `Codex-Gemini-Llmcaller`，点击 `+`。
5. 在会话中说：

```text
@Codex-Gemini-Llmcaller 检查上面的回答。
```

预期：插件可在当前会话中调用，不需要手动 import `server.mjs`。

## 9. 兜底调用 footer 验证

如果当前会话没有直接暴露 `call_model`，可在已安装插件目录中验证兜底脚本：

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

预期：

- 输出来自 Gemini。
- 如果 `outputMetaFooter` 为 `true`，末尾包含 `模型`、`Profile`、`Tokens`。
- 不应只输出裸 `result.text`。

## 10. 联网 429 与模型降级

联网请求触发 `HTTP 429 RESOURCE_EXHAUSTED` 时，预期行为：

- 错误信息明确说明这是 Gemini Google Search grounding 配额/速率限制。
- 如果 profile 配置了 `fallbackProfiles`，插件继续尝试 fallback。
- 内置联网 fallback 顺序为 `gemini-2.5-flash`、`gemini-2.5-flash-lite`、`gemini-2.0-flash`。
- 如果全部 fallback 都失败，返回可读错误，不由 Codex 冒充 Gemini 回答。

## 11. DeepSeek 模拟回归

`server.test.mjs` 已覆盖 DeepSeek 官方 OpenAI-compatible 请求形状，不需要真实 DeepSeek API key：

- 默认 DeepSeek 基础地址：`https://api.deepseek.com`
- 推荐模型：`deepseek-v4-flash`
- `outputMode: "json"` 时发送 `response_format: { "type": "json_object" }`
- `thinkingMode: "enabled"` 时发送 `thinking: { "type": "enabled" }`
- DeepSeek 402/422/429/503 会返回更明确的错误说明

执行：

```powershell
node ./plugins/Codex-Gemini-Llmcaller/scripts/server.test.mjs
```

## 12. 输出模式与能力表回归

`server.test.mjs` 已覆盖：

- `outputMode: "preview"` 只返回截断预览。
- `outputMode: "file"` 把完整模型输出写入测试目录，并只返回路径和预览。
- `provider_capabilities` 返回 Gemini、DeepSeek、Anthropic、OpenAI-compatible 的路由能力表。
- DeepSeek profile 带有 `providerId: "deepseek"`，删除内置 DeepSeek profile 会被拒绝。
- 显式 DeepSeek 调用优先使用 `DEEPSEEK_API_KEY`，不会误用 `OPENAI_API_KEY`。
- `routingMode: "auto"` 在核对上文时可选择 `deepseek-default`，在新鲜信息请求中可自动启用 Gemini grounded profile。

执行：

```powershell
node ./plugins/Codex-Gemini-Llmcaller/scripts/server.test.mjs
```
