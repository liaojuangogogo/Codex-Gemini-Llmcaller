# Codex-Gemini-Llmcaller 开发与部署记录

本文记录已经落地的开发、测试、安装和部署变更。以后每次代码、脚本、配置、测试、文档或 skill 有修改，都必须同步更新本文件；提交前需要检查本文件记录是否覆盖本次 diff。

记录要求：

- 只记录已完成并验证的内容；未完成事项写入 `ROADMAP.zh-CN.md`。
- 不记录 API key、secret 明文、用户级敏感文件内容或包含敏感信息的日志。
- 每条记录包含提交、变更范围、主要内容、验证结果和部署影响。

## 2026-05-08

### 本次提交：Backfill development deployment log

变更范围：

- `development-deployment-log.md`
- `AGENTS.md`

主要内容：

- 新增开发与部署记录文档，使用用户指定的 `development-deployment-log.md` 文件名。
- 补录近期已完成但未记录的开发节点，包括 DeepSeek 接入、多输出模式、provider registry、多模型初始化、自动路由、模型区分使用说明和初始化验证优化。
- 在 `AGENTS.md` 中补充工作流要求：以后每次涉及代码、脚本、配置、测试、文档或 skill 修改时，必须同步更新 `development-deployment-log.md`。

验证结果：

```powershell
node .\plugins\Codex-Gemini-Llmcaller\scripts\server.test.mjs
node .\plugins\Codex-Gemini-Llmcaller\scripts\self-test.mjs
node .\plugins\Codex-Gemini-Llmcaller\scripts\release-check.mjs
git diff --check
```

结果：通过。

部署影响：

- 无运行时安装影响；这是流程与记录文档变更。

### 19872e1 Improve multi-provider setup validation

变更范围：

- `setup.mjs`
- `README.md`
- `INSTALL.zh-CN.md`
- `USER_GUIDE.zh-CN.md`
- `TEST_CASES.zh-CN.md`
- `plugins/Codex-Gemini-Llmcaller/skills/Codex-Gemini-Llmcaller/SKILL.md`

主要内容：

- 新增 `--refresh-secrets`，强制重新录入或重新导入 provider API key，解决旧 secret 可解密但真实 key 已失效时被跳过的问题。
- 初始化默认对每个 provider 的默认 profile 做一次轻量真实 API 验证，用于确认 key、模型权限、余额/配额和网络链路可用。
- 新增 `--skip-api-validate`，用于离线安装、代理未配置或明确不希望产生真实 provider 调用的场景。
- 文档和 skill 补充多模型初始化、刷新旧 key、验证失败处理和跳过验证说明。

验证结果：

```powershell
node .\setup.mjs --help
node .\setup.mjs --check-only
git diff --check
node .\plugins\Codex-Gemini-Llmcaller\scripts\server.test.mjs
node .\plugins\Codex-Gemini-Llmcaller\scripts\self-test.mjs
node .\plugins\Codex-Gemini-Llmcaller\scripts\release-check.mjs
```

结果：通过。

部署影响：

- 需要运行 `node .\setup.mjs --providers gemini,deepseek --refresh-secrets` 安装新版初始化逻辑并刷新 key。
- 安装后需要完全重启 Codex Desktop。

### ba52b31 Document model-specific usage

变更范围：

- `README.md`
- `INSTALL.zh-CN.md`
- `USER_GUIDE.zh-CN.md`
- `TEST_CASES.zh-CN.md`
- `plugins/Codex-Gemini-Llmcaller/skills/Codex-Gemini-Llmcaller/SKILL.md`

主要内容：

- 使用方法按模型区分：Gemini 默认模型、Gemini 联网/图片、DeepSeek、DeepSeek Pro 和自动路由。
- 文档明确 `deepseek-default` 适合中文核对、评价、改写、推理类场景。
- 文档明确 `deepseek-pro` 适合更强推理或复杂评审场景。
- skill 增加模型选择规则：用户明确说 DeepSeek 时使用 `deepseek-default`，说 DeepSeek Pro 或强推理时使用 `deepseek-pro`，涉及联网或图片时使用 Gemini。

验证结果：

```powershell
node .\plugins\Codex-Gemini-Llmcaller\scripts\server.test.mjs
node .\plugins\Codex-Gemini-Llmcaller\scripts\self-test.mjs
node .\plugins\Codex-Gemini-Llmcaller\scripts\release-check.mjs
git diff --check
```

结果：通过。

部署影响：

- 需要重新运行 `node .\setup.mjs --yes` 并完全重启 Codex Desktop。

### 7bb66cf Add opt-in automatic routing mode

变更范围：

- `plugins/Codex-Gemini-Llmcaller/scripts/server.mjs`
- `plugins/Codex-Gemini-Llmcaller/scripts/router.mjs`
- `plugins/Codex-Gemini-Llmcaller/scripts/server.test.mjs`
- 中文文档与 skill

主要内容：

- 新增显式可选 `routingMode: "auto"`，默认仍为 `profile`，保持旧行为兼容。
- 自动路由支持 fresh/current 请求切到 Gemini grounded，图片请求切到 Gemini，上文核对 review 且 DeepSeek 可用时切到 `deepseek-default`。
- API key 解析在 secret 缺失时支持回退到 provider-aware 环境变量。
- 测试覆盖 DeepSeek 上文核对自动路由和 Gemini fresh request grounding 自动路由。

验证结果：

```powershell
node .\plugins\Codex-Gemini-Llmcaller\scripts\server.test.mjs
node .\plugins\Codex-Gemini-Llmcaller\scripts\self-test.mjs
node .\plugins\Codex-Gemini-Llmcaller\scripts\release-check.mjs
```

结果：通过。

部署影响：

- 需要重新运行 `node .\setup.mjs --yes` 并完全重启 Codex Desktop。

### 8b50481 Add provider registry and multi-model setup

变更范围：

- `setup.mjs`
- `plugins/Codex-Gemini-Llmcaller/scripts/provider-registry.mjs`
- `plugins/Codex-Gemini-Llmcaller/scripts/server.mjs`
- `plugins/Codex-Gemini-Llmcaller/scripts/router.mjs`
- `plugins/Codex-Gemini-Llmcaller/scripts/server.test.mjs`
- `plugins/Codex-Gemini-Llmcaller/scripts/self-test.mjs`
- `plugins/Codex-Gemini-Llmcaller/scripts/mcp-smoke.mjs`
- 中文文档与 skill

主要内容：

- 新增 provider registry，集中管理 provider specs、capability、内置 profile、环境变量优先级和 providerId 推断。
- 新增 DeepSeek 内置 profile：`deepseek-default`、`deepseek-pro`。
- `setup.mjs` 支持 `--providers gemini,deepseek`、`--default-profile deepseek-default`、多 provider `--api-key-env` 和 `--install-only`。
- `call_model`、`profile_set`、`secret_set` schema 支持 `providerId`。
- DeepSeek 显式调用优先使用 `DEEPSEEK_API_KEY`，避免误用 `OPENAI_API_KEY`。

验证结果：

```powershell
node .\plugins\Codex-Gemini-Llmcaller\scripts\server.test.mjs
node .\plugins\Codex-Gemini-Llmcaller\scripts\self-test.mjs
node .\plugins\Codex-Gemini-Llmcaller\scripts\release-check.mjs
```

结果：通过。

部署影响：

- 需要重新运行 `node .\setup.mjs --providers gemini,deepseek --yes` 并完全重启 Codex Desktop。

### 6f049ee Localize plugin output docs

变更范围：

- 中文文档
- skill 使用说明
- 插件可见输出相关说明

主要内容：

- 将新增文档和插件输出说明继续中文化。
- 补充输出模式、模型 footer、profile 使用和兜底调用说明。

验证结果：

```powershell
node .\plugins\Codex-Gemini-Llmcaller\scripts\server.test.mjs
node .\plugins\Codex-Gemini-Llmcaller\scripts\self-test.mjs
node .\plugins\Codex-Gemini-Llmcaller\scripts\release-check.mjs
```

结果：通过。

部署影响：

- 需要重新运行 `node .\setup.mjs --yes` 并完全重启 Codex Desktop。

### 379a87d Add compact output modes and capabilities

变更范围：

- `plugins/Codex-Gemini-Llmcaller/scripts/server.mjs`
- `plugins/Codex-Gemini-Llmcaller/scripts/router.mjs`
- `plugins/Codex-Gemini-Llmcaller/scripts/server.test.mjs`
- 中文文档与 roadmap

主要内容：

- 增加 `outputMode`：`full`、`summary`、`json`、`preview`、`file`。
- review + context 场景默认使用紧凑 JSON 输出，降低外部模型长文本回流到 Codex 上下文的额度消耗。
- `file` 模式把完整外部模型输出写入当前工作区 `.tmp/model-results/`，聊天中只返回短预览和路径。
- 新增 provider capability 信息，用于后续路由和能力判断。

验证结果：

```powershell
node .\plugins\Codex-Gemini-Llmcaller\scripts\server.test.mjs
node .\plugins\Codex-Gemini-Llmcaller\scripts\self-test.mjs
node .\plugins\Codex-Gemini-Llmcaller\scripts\release-check.mjs
```

结果：通过。

部署影响：

- 需要重新运行 `node .\setup.mjs --yes` 并完全重启 Codex Desktop。

### dd84bbe Add DeepSeek routing support

变更范围：

- `plugins/Codex-Gemini-Llmcaller/scripts/server.mjs`
- `plugins/Codex-Gemini-Llmcaller/scripts/router.mjs`
- `plugins/Codex-Gemini-Llmcaller/scripts/server.test.mjs`
- 中文文档

主要内容：

- 按 DeepSeek 官方 OpenAI-compatible Chat Completions 接口接入 DeepSeek。
- 增加 DeepSeek request shape、thinking 参数映射和 token usage 兼容。
- 增加 DeepSeek 错误分类，包括余额不足、参数不兼容、限流和服务过载等典型状态。

验证结果：

```powershell
node .\plugins\Codex-Gemini-Llmcaller\scripts\server.test.mjs
node .\plugins\Codex-Gemini-Llmcaller\scripts\self-test.mjs
node .\plugins\Codex-Gemini-Llmcaller\scripts\release-check.mjs
```

结果：通过。

部署影响：

- 需要重新运行 `node .\setup.mjs --yes` 并完全重启 Codex Desktop。

### 2f29ec9 Add roadmap and agent workflow notes

变更范围：

- `ROADMAP.zh-CN.md`
- `AGENTS.md`

主要内容：

- 新增改造需求与评估文档，记录低额度核对、路由模块化、接入其他模型、自主路由和失败降级等后续方向。
- 新增项目工作边界和 GitHub 同步要求。
- 明确每次修改后至少运行 server test、self-test 和 release-check，并同步到 GitHub。

验证结果：

```powershell
node .\plugins\Codex-Gemini-Llmcaller\scripts\server.test.mjs
node .\plugins\Codex-Gemini-Llmcaller\scripts\self-test.mjs
node .\plugins\Codex-Gemini-Llmcaller\scripts\release-check.mjs
```

结果：通过。

部署影响：

- 无运行时安装影响。
