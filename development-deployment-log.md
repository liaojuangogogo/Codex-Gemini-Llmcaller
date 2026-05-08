# Codex-Llmcaller 开发与部署记录

本文记录已经落地的开发、测试、安装和部署变更。以后每次代码、脚本、配置、测试、文档或 skill 有修改，都必须同步更新本文件；提交前需要检查本文件记录是否覆盖本次 diff。

记录要求：

- 只记录已完成并验证的内容；未完成事项写入 `ROADMAP.zh-CN.md`。
- 不记录 API key、secret 明文、用户级敏感文件内容或包含敏感信息的日志。
- 每条记录包含提交、变更范围、主要内容、验证结果和部署影响。

## 2026-05-08

### 本次提交：Update Gemini defaults and marketplace install docs

变更范围：
- `setup.mjs`
- `AGENTS.md`
- `README.md`
- `INSTALL.zh-CN.md`
- `USER_GUIDE.zh-CN.md`
- `TEST_CASES.zh-CN.md`
- `development-deployment-log.md`
- `plugins/Codex-Llmcaller/scripts/provider-registry.mjs`
- `plugins/Codex-Llmcaller/scripts/server.mjs`
- `plugins/Codex-Llmcaller/scripts/server.test.mjs`
- `plugins/Codex-Llmcaller/skills/Codex-Llmcaller/SKILL.md`

主要内容：
- 将 Gemini 默认 profile 调整为 `gemini-3.1-flash-lite`，新增 `gemini-upgrade` profile 指向 `gemini-3-flash-preview`。
- 将 Gemini 联网默认 profile 调整为 `gemini-3.1-flash-lite`，新增 `gemini-grounded-upgrade`，联网 fallback 顺序调整为 `gemini-grounded`、`gemini-grounded-upgrade`、`gemini-grounded-lite`、`gemini-grounded-20-flash`。
- 自动路由增加升级判断：复杂、高质量、强推理、严格审查、架构/安全/风险等请求会优先升级到 Gemini upgrade 或 DeepSeek Pro；普通核对仍优先走 `deepseek-default`。
- 保留旧 `gemini-grounded` 配置迁移：旧联网 profile 中的 `gemini-3-flash-preview` 或 `gemini-2.5-flash` 会在运行时规范化为新的 `gemini-3.1-flash-lite`，同时移除联网 profile 中不兼容的 thinking 配置。
- 修正 Codex Desktop 新版手动添加插件市场说明：本地仓库和 GitHub 方式都要求稀疏路径留空；文档不再暴露个人绝对路径，并说明只稀疏加载 `.agents/plugins` 会导致插件卡片可见但安装按钮置灰。
- 更新 skill、README、安装指南、用户指南和测试用例中的模型版本、升级/降级逻辑和插件市场安装说明。

验证结果：
```powershell
node .\plugins\Codex-Llmcaller\scripts\server.test.mjs
node .\plugins\Codex-Llmcaller\scripts\self-test.mjs
node .\plugins\Codex-Llmcaller\scripts\release-check.mjs
node .\setup.mjs --check-only
node .\setup.mjs --help
git diff --check
```

结果：通过。`git diff --check` 仅提示部分工作区文件在 Git 触碰时会从 LF 转为 CRLF，没有空白错误。

部署影响：
- 需要重新运行 `node .\setup.mjs --providers gemini,deepseek --yes` 并完全重启 Codex Desktop，才能让客户端加载新的插件代码、profile 默认值和 skill 文档。
- 已存在的用户级 `config.json` 不需要手动编辑；运行时会对内置 Gemini 联网 profile 做兼容迁移。
- 如果通过 Codex Desktop 手动添加插件市场，应使用仓库根目录或 GitHub 仓库地址，并保持稀疏路径为空。

### 本次提交：Rename project to Codex-Llmcaller

变更范围：

- `.agents/plugins/marketplace.json`
- `setup.mjs`
- `AGENTS.md`
- `README.md`
- `INSTALL.zh-CN.md`
- `USER_GUIDE.zh-CN.md`
- `TEST_CASES.zh-CN.md`
- `ROADMAP.zh-CN.md`
- `development-deployment-log.md`
- `plugins/Codex-Llmcaller/**`

主要内容：

- 项目和插件展示名称从 `Codex-Gemini-Llmcaller` 改为 `Codex-Llmcaller`，插件目录同步改为 `plugins/Codex-Llmcaller`，skill 目录同步改为 `skills/Codex-Llmcaller`。
- marketplace 名称改为 `codex-llmcaller-local`，插件源显示为 `Codex-Llmcaller Local Plugins`，插件元数据中的 GitHub 仓库 URL 改为 `https://github.com/liaojuangogogo/Codex-Llmcaller`。
- 初始化脚本继续支持 `--default-profile`，并在中文文档和测试用例中明确多 provider 初始化时可用 `--default-profile deepseek-default` 配置全局默认 profile。
- 增加改名兼容层：安装时会迁移旧 `$HOME/plugins/Codex-Gemini-Llmcaller/.data/` 或 `$HOME/plugins/multi-model-api/.data/`；运行时优先读取新 `CODEX_LLMCALLER_*` 环境变量，同时兼容旧 `CODEX_GEMINI_LLMCALLER_*` 和 `MULTI_MODEL_*`。
- 安装脚本会清理新旧插件 cache，并从 marketplace 中移除旧插件条目，避免客户端同时看到新旧插件。

验证结果：

```powershell
node .\plugins\Codex-Llmcaller\scripts\server.test.mjs
node .\plugins\Codex-Llmcaller\scripts\release-check.mjs
node .\setup.mjs --check-only
node .\plugins\Codex-Llmcaller\scripts\self-test.mjs
node .\setup.mjs --help
git diff --check
```

结果：通过。首次并行执行 `server.test.mjs` 与 `release-check.mjs` 时，`release-check.mjs` 正确拦截了测试过程中短暂生成的 `.data/test-secrets`；清理后按顺序执行完整验证通过。`git diff --check` 仅提示部分工作区文件换行会在 Git 触碰时从 LF 转为 CRLF，没有空白错误。

部署影响：

- 需要重新运行 `node .\setup.mjs --providers gemini,deepseek --default-profile <profile> --yes` 并完全重启 Codex Desktop。
- 已安装旧插件的用户数据会复制迁移到 `$HOME/plugins/Codex-Llmcaller/.data/`；旧目录不会被删除。
- GitHub 仓库本体已通过 GitHub CLI 从 `Codex-Gemini-Llmcaller` 重命名为 `Codex-Llmcaller`，本地 `origin` 已更新为 `git@github.com:liaojuangogogo/Codex-Llmcaller.git`。
- 当前会话尝试重命名本地 checkout 根目录时，Windows 返回目录正被进程占用；需要关闭占用该目录的终端、编辑器或 Codex 会话后再执行本地目录重命名。

### 本次提交：Enable DeepSeek thinking by default

变更范围：

- `plugins/Codex-Llmcaller/scripts/provider-registry.mjs`
- `plugins/Codex-Llmcaller/scripts/server.mjs`
- `plugins/Codex-Llmcaller/scripts/server.test.mjs`
- `README.md`
- `INSTALL.zh-CN.md`
- `USER_GUIDE.zh-CN.md`
- `TEST_CASES.zh-CN.md`
- `plugins/Codex-Llmcaller/skills/Codex-Llmcaller/SKILL.md`

主要内容：

- 按 DeepSeek 官方 thinking mode 文档，将内置 `deepseek-default` 改为默认启用 `thinkingMode: "enabled"`，并设置 `reasoningEffort: "high"`。
- 增加运行时兼容迁移：旧 `config.json` 中内置 `deepseek-default` 如果仍为 `thinkingMode: "disabled"`，加载配置时会规范化为 enabled/high。
- 增加回归测试，覆盖内置 profile 元数据、自动路由到 `deepseek-default` 时发送 `thinking: { "type": "enabled" }` 和 `reasoning_effort: "high"`，以及旧配置迁移。
- 同步中文文档和 skill，明确 DeepSeek 默认 profile 已启用思考模式。

验证结果：

```powershell
node .\plugins\Codex-Llmcaller\scripts\server.test.mjs
node .\plugins\Codex-Llmcaller\scripts\self-test.mjs
node .\plugins\Codex-Llmcaller\scripts\release-check.mjs
node .\setup.mjs --check-only
git diff --check
```

结果：通过。`git diff --check` 仅提示部分工作区文件换行会在 Git 触碰时从 LF 转为 CRLF，没有空白错误。

部署影响：

- 需要重新运行 `node .\setup.mjs --providers gemini,deepseek --yes` 并完全重启 Codex Desktop，才能让客户端加载新版插件代码和 skill。
- 已存在的用户级 `config.json` 不需要手动编辑；运行时会把内置 `deepseek-default` 从旧的 disabled 规范化为 enabled/high。

### 本次提交：Document Codex Desktop marketplace add flow

变更范围：

- `README.md`
- `INSTALL.zh-CN.md`
- `USER_GUIDE.zh-CN.md`
- `TEST_CASES.zh-CN.md`

主要内容：

- 补充新版 Codex Desktop 通过“添加插件市场”接入本项目的说明，覆盖本地仓库、GitHub 仓库和本地 marketplace 目录兜底三种填写方式。
- 明确界面添加插件市场只负责让客户端发现插件，API key、profile 和本地加密 secret 仍必须通过 `setup.mjs` 初始化。
- 在测试用例中增加插件市场添加后的预期：插件源列表出现 `Codex-Llmcaller Local Plugins`，并可从该插件源添加 `Codex-Llmcaller`。
- 用模拟外部模型输出验证低回流模式：9000 字符长输出在 `preview` 模式回流 1242 字符，约节省 86.2%；`file` 模式回流 1373 字符，约节省 84.7%；紧凑 JSON review 回流 231 字符，约节省 97.4%。

验证结果：

```powershell
node .\plugins\Codex-Llmcaller\scripts\server.test.mjs
node .\plugins\Codex-Llmcaller\scripts\self-test.mjs
node .\plugins\Codex-Llmcaller\scripts\release-check.mjs
node .\setup.mjs --check-only
git diff --check
```

结果：通过。`git diff --check` 仅提示部分文档工作区换行会在 Git 触碰时从 LF 转为 CRLF，没有空白错误。

部署影响：

- 仅文档变更；已安装用户如果只查看文档不需要重新运行 `setup.mjs`。
- 如果要让 Codex Desktop 使用当前仓库版本，仍需要运行 `node .\setup.mjs --providers gemini,deepseek` 并完全重启 Codex Desktop。

### 本次提交：Hardening review fixes

变更范围：

- `.gitignore`
- `setup.mjs`
- `INSTALL.zh-CN.md`
- `USER_GUIDE.zh-CN.md`
- `TEST_CASES.zh-CN.md`
- `plugins/Codex-Llmcaller/scripts/server.mjs`
- `plugins/Codex-Llmcaller/scripts/server.test.mjs`
- `plugins/Codex-Llmcaller/scripts/release-check.mjs`
- `plugins/Codex-Llmcaller/scripts/secret-import.mjs`
- `plugins/Codex-Llmcaller/scripts/secret-migrate-local-user.mjs`

主要内容：

- 安装流程调整为先写入 marketplace 并清理 Codex 插件缓存，再执行 provider API 验证；如果验证失败，安装和注册状态仍可解释，用户只需要修复 key、权限、配额或网络后重新运行初始化。
- 移除新写入 secret 记录中的 `keyPreview`，`secret_get`、`secret_list`、`secret-import.mjs` 和 `secret-migrate-local-user.mjs` 不再输出 API key 片段，只保留 fingerprint。
- 增强 release-check：根 `.gitignore` 必须忽略 `**/.data/` 和 `*.bak`，发布检查会拦截 `.data`、`secrets.json`、`config.json`、`marketplace.json.bak` 等敏感或生成文件。
- 文档中的本地环境变量示例不再写 `$env:GEMINI_API_KEY="..."`，避免用户把真实 key 留在 PowerShell 历史；本地刷新 key 推荐使用交互式隐藏录入。

验证结果：

```powershell
node .\plugins\Codex-Llmcaller\scripts\server.test.mjs
node .\plugins\Codex-Llmcaller\scripts\self-test.mjs
node .\plugins\Codex-Llmcaller\scripts\release-check.mjs
node .\setup.mjs --check-only
git diff --check
```

结果：通过。

部署影响：

- 需要重新运行 `node .\setup.mjs --providers gemini,deepseek --refresh-secrets` 并完全重启 Codex Desktop，才能安装新版脚本和更严格的 secret 输出行为。

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
node .\plugins\Codex-Llmcaller\scripts\server.test.mjs
node .\plugins\Codex-Llmcaller\scripts\self-test.mjs
node .\plugins\Codex-Llmcaller\scripts\release-check.mjs
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
- `plugins/Codex-Llmcaller/skills/Codex-Llmcaller/SKILL.md`

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
node .\plugins\Codex-Llmcaller\scripts\server.test.mjs
node .\plugins\Codex-Llmcaller\scripts\self-test.mjs
node .\plugins\Codex-Llmcaller\scripts\release-check.mjs
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
- `plugins/Codex-Llmcaller/skills/Codex-Llmcaller/SKILL.md`

主要内容：

- 使用方法按模型区分：Gemini 默认模型、Gemini 联网/图片、DeepSeek、DeepSeek Pro 和自动路由。
- 文档明确 `deepseek-default` 适合中文核对、评价、改写、推理类场景。
- 文档明确 `deepseek-pro` 适合更强推理或复杂评审场景。
- skill 增加模型选择规则：用户明确说 DeepSeek 时使用 `deepseek-default`，说 DeepSeek Pro 或强推理时使用 `deepseek-pro`，涉及联网或图片时使用 Gemini。

验证结果：

```powershell
node .\plugins\Codex-Llmcaller\scripts\server.test.mjs
node .\plugins\Codex-Llmcaller\scripts\self-test.mjs
node .\plugins\Codex-Llmcaller\scripts\release-check.mjs
git diff --check
```

结果：通过。

部署影响：

- 需要重新运行 `node .\setup.mjs --yes` 并完全重启 Codex Desktop。

### 7bb66cf Add opt-in automatic routing mode

变更范围：

- `plugins/Codex-Llmcaller/scripts/server.mjs`
- `plugins/Codex-Llmcaller/scripts/router.mjs`
- `plugins/Codex-Llmcaller/scripts/server.test.mjs`
- 中文文档与 skill

主要内容：

- 新增显式可选 `routingMode: "auto"`，默认仍为 `profile`，保持旧行为兼容。
- 自动路由支持 fresh/current 请求切到 Gemini grounded，图片请求切到 Gemini，上文核对 review 且 DeepSeek 可用时切到 `deepseek-default`。
- API key 解析在 secret 缺失时支持回退到 provider-aware 环境变量。
- 测试覆盖 DeepSeek 上文核对自动路由和 Gemini fresh request grounding 自动路由。

验证结果：

```powershell
node .\plugins\Codex-Llmcaller\scripts\server.test.mjs
node .\plugins\Codex-Llmcaller\scripts\self-test.mjs
node .\plugins\Codex-Llmcaller\scripts\release-check.mjs
```

结果：通过。

部署影响：

- 需要重新运行 `node .\setup.mjs --yes` 并完全重启 Codex Desktop。

### 8b50481 Add provider registry and multi-model setup

变更范围：

- `setup.mjs`
- `plugins/Codex-Llmcaller/scripts/provider-registry.mjs`
- `plugins/Codex-Llmcaller/scripts/server.mjs`
- `plugins/Codex-Llmcaller/scripts/router.mjs`
- `plugins/Codex-Llmcaller/scripts/server.test.mjs`
- `plugins/Codex-Llmcaller/scripts/self-test.mjs`
- `plugins/Codex-Llmcaller/scripts/mcp-smoke.mjs`
- 中文文档与 skill

主要内容：

- 新增 provider registry，集中管理 provider specs、capability、内置 profile、环境变量优先级和 providerId 推断。
- 新增 DeepSeek 内置 profile：`deepseek-default`、`deepseek-pro`。
- `setup.mjs` 支持 `--providers gemini,deepseek`、`--default-profile deepseek-default`、多 provider `--api-key-env` 和 `--install-only`。
- `call_model`、`profile_set`、`secret_set` schema 支持 `providerId`。
- DeepSeek 显式调用优先使用 `DEEPSEEK_API_KEY`，避免误用 `OPENAI_API_KEY`。

验证结果：

```powershell
node .\plugins\Codex-Llmcaller\scripts\server.test.mjs
node .\plugins\Codex-Llmcaller\scripts\self-test.mjs
node .\plugins\Codex-Llmcaller\scripts\release-check.mjs
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
node .\plugins\Codex-Llmcaller\scripts\server.test.mjs
node .\plugins\Codex-Llmcaller\scripts\self-test.mjs
node .\plugins\Codex-Llmcaller\scripts\release-check.mjs
```

结果：通过。

部署影响：

- 需要重新运行 `node .\setup.mjs --yes` 并完全重启 Codex Desktop。

### 379a87d Add compact output modes and capabilities

变更范围：

- `plugins/Codex-Llmcaller/scripts/server.mjs`
- `plugins/Codex-Llmcaller/scripts/router.mjs`
- `plugins/Codex-Llmcaller/scripts/server.test.mjs`
- 中文文档与 roadmap

主要内容：

- 增加 `outputMode`：`full`、`summary`、`json`、`preview`、`file`。
- review + context 场景默认使用紧凑 JSON 输出，降低外部模型长文本回流到 Codex 上下文的额度消耗。
- `file` 模式把完整外部模型输出写入当前工作区 `.tmp/model-results/`，聊天中只返回短预览和路径。
- 新增 provider capability 信息，用于后续路由和能力判断。

验证结果：

```powershell
node .\plugins\Codex-Llmcaller\scripts\server.test.mjs
node .\plugins\Codex-Llmcaller\scripts\self-test.mjs
node .\plugins\Codex-Llmcaller\scripts\release-check.mjs
```

结果：通过。

部署影响：

- 需要重新运行 `node .\setup.mjs --yes` 并完全重启 Codex Desktop。

### dd84bbe Add DeepSeek routing support

变更范围：

- `plugins/Codex-Llmcaller/scripts/server.mjs`
- `plugins/Codex-Llmcaller/scripts/router.mjs`
- `plugins/Codex-Llmcaller/scripts/server.test.mjs`
- 中文文档

主要内容：

- 按 DeepSeek 官方 OpenAI-compatible Chat Completions 接口接入 DeepSeek。
- 增加 DeepSeek request shape、thinking 参数映射和 token usage 兼容。
- 增加 DeepSeek 错误分类，包括余额不足、参数不兼容、限流和服务过载等典型状态。

验证结果：

```powershell
node .\plugins\Codex-Llmcaller\scripts\server.test.mjs
node .\plugins\Codex-Llmcaller\scripts\self-test.mjs
node .\plugins\Codex-Llmcaller\scripts\release-check.mjs
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
node .\plugins\Codex-Llmcaller\scripts\server.test.mjs
node .\plugins\Codex-Llmcaller\scripts\self-test.mjs
node .\plugins\Codex-Llmcaller\scripts\release-check.mjs
```

结果：通过。

部署影响：

- 无运行时安装影响。
