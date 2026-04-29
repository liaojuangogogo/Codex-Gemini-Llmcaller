# Codex-Gemini-Llmcaller 用户文档

`Codex-Gemini-Llmcaller` 用于在 Codex 会话中调用 Gemini 或其他 API-key 模型。普通用户安装一次后即可直接使用；高级用户通过本地 `config.json` 配置模型、超时、token、自动续写、fallback 和输出元信息。

## 1. 默认使用

安装并重启 Codex Desktop 后，直接在会话中说：

```text
用 Gemini 检查一下这个回答。
```

默认使用 `gemini-default` profile 和同名本地加密 secret。

你也可以在插件页把插件添加到会话后使用：

```text
@Codex-Gemini-Llmcaller 检查上面的回答。
```

插件页添加方式：

1. 左侧进入“插件”。
2. 顶部选择“插件”页签。
3. 在插件源下拉中选择 `Codex-Gemini-Llmcaller Local Plugins`。
4. 找到 `Codex-Gemini-Llmcaller`，点击 `+`。
5. 选择“在对话中试用”或添加到当前会话。

## 2. 本地配置文件

普通用户配置请编辑安装目录中的文件：

```text
$HOME/plugins/Codex-Gemini-Llmcaller/.data/config.json
```

插件运行时会固定读取这个用户级 `.data/`，即使 Codex Desktop 把插件代码复制到 `$HOME/.codex/plugins/cache/` 运行，也不会把 secret 查找位置切到 cache 目录。Windows PowerShell 支持这种正斜杠路径。不要把 `.data/` 提交到 GitHub。

示例配置：

```json
{
  "version": 1,
  "defaultProfile": "gemini-default",
  "outputMetaFooter": true,
  "profiles": {
    "gemini-default": {
      "provider": "google",
      "model": "gemini-3-flash-preview",
      "secretName": "gemini-default",
      "timeoutMs": 120000,
      "thinkingLevel": "low",
      "autoContinue": true,
      "maxContinuationRounds": 2
    }
  }
}
```

## 3. 自定义 Profile

你可以在 `profiles` 中添加更多 profile：

```json
{
  "version": 1,
  "defaultProfile": "gemini-review",
  "outputMetaFooter": true,
  "profiles": {
    "gemini-review": {
      "provider": "google",
      "model": "gemini-3-flash-preview",
      "secretName": "gemini-default",
      "timeoutMs": 180000,
      "maxTokens": 4096,
      "thinkingLevel": "low",
      "generationConfig": {
        "temperature": 0.2
      },
      "autoContinue": true,
      "maxContinuationRounds": 3,
      "fallbackProfiles": ["gemini-backup"]
    },
    "gemini-backup": {
      "provider": "google",
      "model": "gemini-3-flash-preview",
      "secretName": "gemini-default",
      "timeoutMs": 180000,
      "outputMetaFooter": false
    }
  }
}
```

常用字段：

- `provider`
- `model`
- `secretName`
- `apiKeyEnv`
- `baseUrl`
- `timeoutMs`
- `maxTokens`
- `temperature`
- `thinkingLevel`
- `generationConfig`
- `safetySettings`
- `systemInstruction`
- `tools`
- `toolConfig`
- `cachedContent`
- `autoContinue`
- `maxContinuationRounds`
- `outputMetaFooter`
- `fallbackProfileName`
- `fallbackProfiles`

profile 不允许保存 `Authorization`、`x-api-key`、`x-goog-api-key`、`api-key` 这类携带密钥的 header。请使用 `secretName`。

## 4. 输出元信息

默认情况下，模型回答末尾会追加审计信息：

```text
---
模型: google / gemini-3-flash-preview
Profile: gemini-default
Tokens: input=12, output=34, total=46
```

如果自动化流程需要纯净文本输出，可以在配置中关闭：

```json
{
  "outputMetaFooter": false
}
```

关闭后，可见文本不追加 footer；结构化结果仍包含 `modelInfo` 和 `tokenUsage`。

优先级：

```text
单次调用参数 > profile.outputMetaFooter > 顶层 outputMetaFooter > true
```

自动续写触发多轮请求时，token 统计采用 `billable_sum`：把每轮 API 返回的 input、output、total 相加。这反映 API 消耗，不代表最终上下文窗口大小。

## 5. 配置文件容错

如果 `config.json` 写坏，例如 JSON 少逗号，插件不会覆盖该文件，也不会让 MCP server 直接崩溃。它会临时降级到内置 `gemini-default` 配置，并在结构化结果中返回 `configWarning`。

请手动修复 `config.json` 后继续使用自定义配置。

## 6. API key 安全模型

- 不要在会话中粘贴真实 API key。
- 不要把 API key 放进命令行参数。
- 推荐使用 `node ./setup.mjs` 隐藏录入。
- 非交互场景可用 `--api-key-env GEMINI_API_KEY` 从本地环境变量读取。
- 本地 `.data/secrets.json` 只保存加密内容，不保存明文 API key。
- `secret_get` 只验证是否可解密，不返回明文 key。

## 7. 不应上传 GitHub 的文件

以下是本地生成或可能含敏感信息的文件/目录：

```text
./.tmp/
./plugins/Codex-Gemini-Llmcaller/.data/
$HOME/plugins/Codex-Gemini-Llmcaller/.data/secrets.json
$HOME/plugins/Codex-Gemini-Llmcaller/.data/config.json
$HOME/plugins/multi-model-api/.data/
$HOME/.agents/plugins/marketplace.json
$HOME/.agents/plugins/marketplace.json.bak
```

上传前建议执行：

```powershell
node ./plugins/Codex-Gemini-Llmcaller/scripts/release-check.mjs
```

## 8. 自测

基础自测：

```powershell
node ./plugins/Codex-Gemini-Llmcaller/scripts/self-test.mjs
```

真实 Gemini 调用自测：

```powershell
node ./plugins/Codex-Gemini-Llmcaller/scripts/self-test.mjs --real-gemini
```

更多测试用例见：

```text
./plugins/Codex-Gemini-Llmcaller/TEST_CASES.zh-CN.md
```
