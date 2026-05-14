# Repository Guidelines

## Project Structure & Module Organization

本仓库是 pnpm + Turbo monorepo，面向 uniapp 小程序 CI。核心代码位于 `packages/*/src`，测试位于各包的 `tests` 目录。

- `packages/core`：共享运行时、配置 schema、平台 CI 适配器与公共类型。
- `packages/cli`：`minici` 命令、参数解析、配置加载与 CLI 入口。
- `packages/vite-plugin`：`uniMiniCI()` Vite 插件及插件参数解析。
- `docs`：CLI、Vite 插件说明，以及 `docs/superpowers` 下的设计与执行计划。

## Build, Test, and Development Commands

使用 Node `>=22`、pnpm `>=10`。根目录脚本通过 Turbo 分发到各 package：

- `pnpm install`：安装依赖，仓库限制只能使用 pnpm。
- `pnpm run build`：构建全部包，产物输出到各包 `dist`。
- `pnpm run dev`：以 watch 模式构建各包。
- `pnpm run test`：运行全部 Vitest 测试。
- `pnpm run typecheck`：检查源码 TypeScript 类型。
- `pnpm run typecheck:test`：检查测试目录类型。
- `pnpm run lint` / `pnpm run lint:fix`：使用 oxlint 检查或修复。
- `pnpm run fmt:check` / `pnpm run fmt`：使用 oxfmt 检查或格式化。

## Coding Style & Naming Conventions

项目使用 TypeScript ESM，保持现有双引号、分号省略和 oxfmt 输出风格。公共 API、配置字段和平台标识应延续现有命名，例如 `MiniCIOperation`、`parseCliArgs`、`mp-weixin`。在 JS/TS 代码中，变量名、函数名和关键类型附近使用 `/** */` 注释；新增注释应解释意图或约束，避免复述代码。

## Testing Guidelines

测试框架为 Vitest，测试文件放在对应包的 `tests/*.test.ts`。新增 CLI 参数、配置 schema、平台适配器或插件行为时，应优先补对应 package 的测试，再实现。提交前至少运行 `pnpm run test`、`pnpm run typecheck` 和 `pnpm run typecheck:test`；涉及格式或 lint 规则时补跑 `pnpm run lint`、`pnpm run fmt:check`。

## Commit & Pull Request Guidelines

近期提交使用 Conventional Commits，如 `feat(core): ...`、`fix(core): ...`、`docs: ...`、`test(core): ...`、`chore: ...`。PR 应说明变更目标、影响的 package、验证命令结果；涉及 CLI 输出、文档或二维码路径等用户可见行为时，同步更新 `README.md` 或 `docs/*.md`。

## Security & Configuration Tips

平台 SDK 依赖是可选 peer dependency，只按目标平台安装，例如 `miniprogram-ci`、`minidev`、`swan-toolkit`。不要提交真实 `privateKey`、`privateKeyPath` 指向的密钥文件、账号密码或二维码产物；示例配置应使用占位值。新增配置字段时同步更新 zod schema、类型定义、CLI 文档和插件文档，避免 CLI 与 Vite 插件行为分叉。

## Agent-Specific Instructions

保持改动定点，不做无关重构。CLI 和插件共享行为优先沉到 `packages/core`；只属于命令行或 Vite 生命周期的逻辑分别留在 `packages/cli`、`packages/vite-plugin`。不确定平台 SDK 行为时先查本地代码和文档，再补测试验证。
