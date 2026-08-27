# 贡献工作流

先阅读仓库根目录的 `CONTRIBUTING.md`、`SECURITY.md` 和 `.github` 模板；它们是人类与 Agent 共用的提交入口。以下内容补充 skill 维护的诊断细节。

## 1. 准备证据包

在修改上游前整理：

- 受影响的包、版本和 skill；
- 最小复现或失败调用路径；
- 观察行为与期望行为；
- 根因证据：源码、测试、生成结果或数据库/API 探针；
- 为什么这是通用问题，而不是当前项目约定；
- 修复后执行的验证命令。

先脱敏。用 `Tenant`、`Resource` 等通用名称替换业务实体；删除 token、内部域名、客户数据、完整生产日志和无法公开的堆栈上下文。

## 2. 检查重复项

具备 GitHub CLI 和登录状态时，先做只读查重：

```bash
gh auth status
gh issue list --repo nest-boot/skills --state all --search '<关键词>'
gh pr list --repo nest-boot/skills --state all --search '<关键词>'
```

框架问题改用 `$nest-boot-maintainer`。没有 GitHub CLI 时使用可用的浏览器或连接器查重；不要因为工具缺失就重复提交。

## 3. 准备上游分支

- 优先使用已有的干净 `nest-boot/skills` checkout；存在无关改动时使用独立 worktree 或 clone。
- 同步远程并确认默认分支没有领先提交，再创建 `fix/<skill>-<topic>` 或 `docs/<skill>-<topic>` 分支。
- 不修改业务项目的 `.agents/skills` 安装副本，不强制覆盖用户分支，不直接推送 `main`。

## 4. 修改与验证

1. 更新最接近问题的正文或 reference，避免在多个文件复制同一规则。
2. 将失败案例泛化为真实 eval，包含期望输出和可验证 expectations。
3. 若新增 skill 或修改 description，运行 README 生成器。
4. 运行全仓校验器和与改动相关的框架测试。
5. 审查 diff，确认没有项目私有信息、生成缓存或无关格式化。

## 5. Issue 内容

Issue 应包含：

```markdown
## 问题
现有行为或指引造成了什么可观察失败。

## 最小复现
最少的版本、配置、代码或命令。

## 期望行为
基于公开 API 或设计意图应该发生什么。

## 根因证据
相关源码、测试、schema、SQL 或日志探针；不包含敏感信息。

## 建议范围
应修改 skill、framework、docs 还是 tests；仍待维护者决定的事项。
```

不要只写“文档不对”或粘贴未经整理的聊天记录。

## 6. PR 内容

PR 应包含：

```markdown
## Summary
- 修复的通用问题
- 更新的 skill/reference/eval

## Evidence
- 原问题如何复现
- 为什么修改适用于其他项目

## Validation
- 执行的命令与结果

## Scope
- 明确未包含的项目私有行为或后续框架工作
```

推送分支和调用 `gh issue create`/`gh pr create` 都会修改外部状态。仅在用户明确授权后执行；完成后返回可点击链接和提交 SHA。
