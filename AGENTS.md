# AGENTS.md

## 项目边界

- 当前授权项目路径：`E:\Git\Codex-Llmcaller`。
- 创建、修改、删除、移动等写操作只能发生在该路径及其子路径内。
- 原路径 `F:\Codex\CheckWithModel` 已取消授权，不要读取或写入。
- Shell 环境：PowerShell。

## 安全要求

- API key 不得出现在对话、命令行参数、日志或仓库文件中。
- 本项目会安装到用户级目录 `$HOME/plugins/Codex-Llmcaller`，但除非用户明确要求安装或验证客户端，否则不要主动写用户目录。
- 不要回滚用户未要求回滚的修改。

## 工作流程

- 修改前先读取相关文件，不要基于记忆直接改。
- 使用 `apply_patch` 做文件编辑。
- 处理任务时按节点推进；每完成一个节点，回看检查节点产出是否符合节点预期和整体目标。
- 每次涉及代码、脚本、配置、测试、文档或 skill 修改时，必须同步更新 `development-deployment-log.md`；提交前检查开发与部署记录是否覆盖本次 diff。
- 修改后至少运行：

```powershell
node ./plugins/Codex-Llmcaller/scripts/server.test.mjs
node ./plugins/Codex-Llmcaller/scripts/self-test.mjs
node ./plugins/Codex-Llmcaller/scripts/release-check.mjs
```

## GitHub 同步

- 每次完成本地改动并通过验证后，需要同步到代码库：

```text
https://github.com/liaojuangogogo/Codex-Llmcaller
```

- 同步前检查 `git status` 和本次 diff，只提交本次任务相关文件。
- 若远端拒绝直接推送到当前分支，则创建分支并通过 PR 同步。
