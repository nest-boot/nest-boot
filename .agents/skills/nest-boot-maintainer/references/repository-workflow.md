# 仓库贡献工作流

目标仓库：[nest-boot/nest-boot](https://github.com/nest-boot/nest-boot)。开始工作时重新读取根 `package.json`、`nx.json`、目标 package 的 `package.json` 和 `.github/workflows/verify.yml`；这里记录的是基线，不替代仓库当前配置。

## 当前仓库约束

- 默认分支是 `main`，workspace 使用 pnpm 和 Nx。
- 根 `package.json` 当前要求 Node 24.4+、pnpm 10.30.3；以 checkout 中声明为准。
- `@nest-boot/<name>` 通常对应 `packages/<name>`，先用 package 的 `name` 字段确认，不只依赖目录猜测。
- PR 标题由 commitlint 校验，使用 `fix(scope): ...`、`feat(scope): ...`、`docs(scope): ...` 等 Conventional Commit 形式。
- PR CI 构建 packages、检查 Prettier、运行 lint、TypeDoc 和 coverage tests；完整测试需要 PostgreSQL、Redis 与 MinIO 服务。
- `CONTRIBUTING.md`、`SECURITY.md`、Issue forms 和 PR template 是当前贡献入口；开始任务时重新读取，若它们与本 reference 不一致则以上游文件和 CI 为准。

## 准备 checkout 与分支

1. 确认现有 checkout 的 `origin` 指向 `nest-boot/nest-boot` 或受控 fork，并查看 `git status`。
2. 工作区包含无关改动时不要清理或覆盖；使用独立 worktree/clone，或在用户确认后等待。
3. 获取最新远程状态，从最新 `main` 创建 `fix/<package>-<topic>`、`feat/<package>-<topic>` 或同等清晰的专用分支。
4. 先搜索重复项：

   ```bash
   gh issue list --repo nest-boot/nest-boot --state all --search '<package symptom>'
   gh pr list --repo nest-boot/nest-boot --state all --search '<package symptom>'
   ```

查重是只读动作；创建 Issue、推送和创建 PR 需要用户明确授权。

## 实现与验证

先添加能在修复前失败的最小测试，再修改实现。先检查目标 package 暴露的 Nx targets；存在 test target 时使用它，否则让根 Jest 按 package 路径运行：

```bash
pnpm nx run @nest-boot/<package>:test --skip-nx-cache -- --runInBand
pnpm exec jest --runInBand packages/<package>
pnpm nx run @nest-boot/<package>:build --skip-nx-cache
pnpm nx run @nest-boot/<package>:lint --skip-nx-cache
```

两个测试命令不要求同时执行。某些 package 没有 test 或 lint target，也可能没有测试文件；先用 `pnpm nx show project @nest-boot/<package>` 或 package 配置确认，不执行不存在的 target。文档、导出或类型变化还应运行相关检查：

```bash
pnpm format:check
pnpm typedoc:check
pnpm build:packages --skip-nx-cache
```

完整 CI 对齐命令为：

```bash
pnpm build:packages --skip-nx-cache
pnpm format:check
pnpm lint
pnpm typedoc:check
pnpm test:cov
```

`pnpm test:cov` 的 CI 环境会提供 PostgreSQL、Redis 和 MinIO。没有同等服务时只运行可证明的子集，并在 PR 中明确未运行项。公开包内容变化时酌情运行 `pnpm --filter @nest-boot/<package> pack --dry-run`；发布流程变化才运行 `pnpm release:dry-run`。

提交前检查：

```bash
git diff --check
git status --short
```

不要提交测试缓存、环境文件、生产数据、无关 lockfile 变化或用户已有改动。

## Issue 模板

```markdown
## Package and version

- Package: `@nest-boot/...`
- Version:
- Node / pnpm / relevant peers:

## Problem

说明影响和出现条件。

## Minimal reproduction

提供脱敏代码、仓库或确定性步骤。

## Actual behavior

粘贴最短必要输出。

## Expected behavior

说明依据的公开契约。

## Investigation

列出已排除项、源码位置和可能根因；不确定处明确标记。
```

改进建议把 `Minimal reproduction` 替换为 `Use cases and constraints`，补充备选方案和兼容影响。得到授权后可使用 `gh issue create --repo nest-boot/nest-boot`，但先让正文落到临时文件或通过安全参数传入，避免 shell 插值执行内容。

## PR 模板

PR 标题使用 Conventional Commit，例如 `fix(logger): preserve context outside requests`。

```markdown
## Summary

- 修复或改进了什么
- 影响哪些 packages、公开 API 或文档

## Problem and root cause

说明复现、被破坏的契约和根因证据。

## Verification

- `实际执行的命令` — 结果
- 未运行项及原因

## Compatibility and release impact

说明默认行为、类型、依赖、迁移和预期 release 类型。
```

已有 Issue 时使用 `Fixes #...` 或 `Refs #...`。审查 diff 后再推送并创建 PR；没有写权限时从 fork 分支向 `nest-boot/nest-boot:main` 发起。返回 PR URL 和 head commit SHA，不自动合并或发布。
