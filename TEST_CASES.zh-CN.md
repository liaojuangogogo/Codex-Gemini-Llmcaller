# Codex-Llmcaller 测试用例

以下命令默认在仓库根目录执行。

## 1. 环境检查

```powershell
node ./plugins/Codex-Llmcaller/scripts/check-env.mjs
```

预期：

- Node.js 版本不低于 18。
- Windows 和 PowerShell 检查通过。
- 用户级插件目录和 marketplace 目录可写。

## 2. 发布检查

```powershell
node ./plugins/Codex-Llmcaller/scripts/release-check.mjs
```

预期：

- JSON 文件可解析。
- 仓库内没有开发机绝对路径。
- `./.tmp/` 和 `./plugins/Codex-Llmcaller/.data/` 内没有待上传文件。
- `.gitignore` 忽略 `.tmp/`，插件 `.gitignore` 忽略 `.data/`。

## 3. 本地回归

```powershell
node ./plugins/Codex-Llmcaller/scripts/self-test.mjs
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
- 用户级目录 `$HOME/plugins/Codex-Llmcaller` 存在。
- 目标 `.mcp.json` 中 `args[0]` 是绝对 `server.mjs` 路径。
- 用户级 marketplace 包含 `Codex-Llmcaller`。
- `.data/secrets.json` 不包含明文 API key。
- `$HOME/.codex/plugins/cache/codex-llmcaller-local/Codex-Llmcaller` 旧缓存被清理，重启客户端后会重新生成新版本缓存。

多模型初始化：

```powershell
node ./setup.mjs --providers gemini,deepseek
```

预期：

- 依次隐藏输入 Gemini 和 DeepSeek API key。
- 生成或复用 `gemini-default`、`deepseek-default` secret。
- 写入 Gemini 与 DeepSeek 内置 profile。
- 不覆盖已有可解密 secret。
- 对 `gemini-default` 和 `deepseek-default` 各执行一次轻量真实 API 验证。

强制刷新已有 secret：

```powershell
node ./setup.mjs --providers gemini,deepseek --refresh-secrets
```

预期：

- 即使已有可解密 secret，也会重新录入或导入对应 provider 的 API key。
- 刷新后仍会执行轻量真实 API 验证。

跳过真实 API 验证：

```powershell
node ./setup.mjs --providers gemini,deepseek --skip-api-validate
```

预期：

- 完成安装、secret/profile 写入和 marketplace 注册。
- 不调用 provider API。

只初始化 DeepSeek 并设为默认 profile：

```powershell
node ./setup.mjs --providers deepseek --default-profile deepseek-default
```

预期：

- 隐藏输入 DeepSeek API key。
- 默认 profile 为 `deepseek-default`。

多 provider 初始化并显式设置全局默认 profile：

```powershell
node ./setup.mjs --providers gemini,deepseek --default-profile deepseek-default
```

预期：

- 同时写入 Gemini 和 DeepSeek profile。
- 初始化完成后 `defaultProfile` 为 `deepseek-default`。

## 5. 旧数据迁移

前置条件：

- `$HOME/plugins/Codex-Gemini-Llmcaller/.data/` 或 `$HOME/plugins/multi-model-api/.data/` 存在。
- `$HOME/plugins/Codex-Llmcaller/.data/` 不存在。

执行：

```powershell
node ./setup.mjs
```

预期：

- 新目录自动获得旧 `.data/`。
- 旧 `$HOME/plugins/Codex-Gemini-Llmcaller` 或 `$HOME/plugins/multi-model-api` 不被删除。
- 如旧 secret 可解密，脚本跳过 API key 输入。

## 6. 非交互安装

```powershell
node ./setup.mjs --api-key-env GEMINI_API_KEY --yes
```

预期：

- 不通过命令行参数暴露 key。
- 安装完成。
- secret 加密保存。

多模型非交互安装：

```powershell
node ./setup.mjs --providers gemini,deepseek --api-key-env gemini=GEMINI_API_KEY,deepseek=DEEPSEEK_API_KEY --refresh-secrets --yes
```

预期：

- 每个 provider 从对应环境变量读取 API key。
- `secrets.json` 不包含明文 API key。

## 7. 真实 Gemini

```powershell
node ./plugins/Codex-Llmcaller/scripts/self-test.mjs --real-gemini
```

预期：

- 使用已安装的 `gemini-default` secret 调用 Gemini。
- 返回非空文本。
- 结果不含明文 API key。

真实 profile 自测：

```powershell
node ./plugins/Codex-Llmcaller/scripts/self-test.mjs --real-profile deepseek-default
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

1. 先执行初始化并完全重启 Codex Desktop：

```powershell
node ./setup.mjs --providers gemini,deepseek
```

2. 左侧进入“插件”。
3. 顶部选择“插件”页签。
4. 插件源下拉选择 `Codex-Llmcaller Local Plugins`。
5. 找到 `Codex-Llmcaller`，点击 `+`。
6. 在会话中说：

```text
@Codex-Llmcaller 检查上面的回答。
```

预期：插件可在当前会话中调用，不需要手动 import `server.mjs`。

新版 Codex Desktop 手动添加插件市场：

```text
本地仓库方式：
来源：本项目仓库根目录
Git 引用：（留空）
稀疏路径：（留空）

GitHub 方式：
来源：https://github.com/liaojuangogogo/Codex-Llmcaller
Git 引用：refs/heads/main
稀疏路径：（留空）
```

预期：不要只稀疏加载 `.agents/plugins`。客户端需要同时拿到 marketplace 文件和 `plugins/Codex-Llmcaller` 插件包，否则可能出现插件卡片可见但安装按钮置灰。

预期：添加市场成功后，插件源列表出现 `Codex-Llmcaller Local Plugins`，并可从该插件源添加 `Codex-Llmcaller`。界面添加市场不会录入 API key；真实调用前仍需要完成 `setup.mjs` 初始化。

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
- 内置联网 fallback 顺序为 `gemini-grounded`、`gemini-grounded-upgrade`、`gemini-grounded-lite`、`gemini-grounded-20-flash`。
- 如果全部 fallback 都失败，返回可读错误，不由 Codex 冒充 Gemini 回答。

## 11. DeepSeek 模拟回归

`server.test.mjs` 已覆盖 DeepSeek 官方 OpenAI-compatible 请求形状，不需要真实 DeepSeek API key：

- 默认 DeepSeek 基础地址：`https://api.deepseek.com`
- 推荐模型：`deepseek-v4-flash`
- `outputMode: "json"` 时发送 `response_format: { "type": "json_object" }`
- `thinkingMode: "enabled"` 时发送 `thinking: { "type": "enabled" }`
- `deepseek-default` 默认发送 `thinking: { "type": "enabled" }` 和 `reasoning_effort: "high"`；旧配置中内置 `deepseek-default` 如果仍为 `thinkingMode: "disabled"`，运行时会迁移为 enabled。
- DeepSeek 402/422/429/503 会返回更明确的错误说明

执行：

```powershell
node ./plugins/Codex-Llmcaller/scripts/server.test.mjs
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
node ./plugins/Codex-Llmcaller/scripts/server.test.mjs
```

## 13. Gemini 多模态输入回归

`server.test.mjs` 已覆盖：

- 旧 `imageInputs` 继续可用，并会被转换为 Gemini `inline_data`。
- 新 `mediaInputs` 支持文本补充、音频本地文件和预上传 `fileUri` 文档。
- `mediaInputs` 与 `rawContents` 不能混用，避免生成冲突的 Gemini contents。
- 非 Google provider 使用 `imageInputs` 或 `mediaInputs` 会返回明确错误。
- `routingMode: "auto"` 遇到音频、视频、文档等多模态输入时，会自动选择 Gemini profile。
- `provider_capabilities` 中 Gemini 标记支持 `images`、`audio`、`video`、`documents`，DeepSeek 对这些能力标记为不支持。

执行：

```powershell
node ./plugins/Codex-Llmcaller/scripts/server.test.mjs
```
