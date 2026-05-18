# bumpp 集成设计文档

## 背景

`mini-ci` 目前通过 CLI 和 Vite 插件在 uniapp 小程序构建后执行 `open`、`preview`、`upload`。这三个 CI action 已经建模为 `operations: MiniCIOperation[]`，固定顺序为 `open -> preview -> upload`。

新目标是通过程序化 API 集成 `antfu-collective/bumpp`，为 CLI 和 Vite 插件新增 `--bump` 参数，并在 `MiniCIConfig` 中新增 `bumpOptions`。`--bump` 用于生产版本发布前更新版本号；它不是新的 CI action，不进入 `supportedOperations`。

已通过 DeepWiki 和本地 `node_modules/bumpp` 类型确认：bumpp 的程序化入口是 `versionBump(options)`，核心配置类型为 `VersionBumpOptions`，返回 `VersionBumpResults`。bumpp 会修改版本文件，并可执行 git commit、tag、push、npm scripts、install、execute 等副作用。

## 已确认决策

- `--bump` 是 boolean 开关，不接收 release 参数。
- 具体 bumpp 行为来自 `MiniCIConfig.bumpOptions`，其中 `release` 等字段复用 bumpp 的 `VersionBumpOptions`。
- 未配置 `bumpOptions.release` 时，保留 bumpp 默认行为，即按其交互式 prompt 处理。
- mini-ci 层提供安全默认：`commit: true`、`tag: false`、`push: false`。用户可以在 `bumpOptions` 中显式覆盖。
- `--bump` 可以单独执行，形成 bump-only 流程。
- bump-only 不要求 `--platform`，也不读取平台配置。
- bump-only 如果显式传入 `--platform`，仍校验平台值是否合法；合法平台不会触发平台配置读取。
- `--bump` 如果搭配任何 CI action，必须包含 `--upload`，因为 bump 只用于生产发布。
- 启用 `--bump` 后，后续 CI 使用 bumpp 返回的 `newVersion`，优先于 `--version`、`config.version` 和 `packageJson.version`。
- Vite 插件中 `--bump` 只支持 build 模式，serve 模式报错。
- Vite 插件遇到非小程序平台时，继续跳过全部插件动作，包括 bump。

## 架构边界

采用共享 bump 前置阶段：

- `packages/core` 新增 bumpp 集成逻辑，负责调用 `versionBump()`、合并安全默认值、处理结果和错误。
- `packages/cli` 只新增 `--bump` boolean 参数解析，不直接依赖 bumpp 执行细节。
- `packages/vite-plugin` 只新增插件透传 `--bump` 解析，不直接实现 bump。
- `MiniCIConfig` 新增 `bumpOptions?: VersionBumpOptions`。
- `supportedOperations` 继续保持 `["open", "preview", "upload"]`，不新增 `bump`。

`uni-mini-ci-core` 需要在 package 级 runtime dependency 中声明 `bumpp`。根目录当前已有 `bumpp`，但发布后的 core 包不能依赖根 dev dependency 解析运行时 import。

## 参数规则

### CLI

合法示例：

```bash
minici --bump
minici --bump --platform mp-weixin
minici --bump --upload --platform mp-weixin
minici --bump --preview --upload --platform mp-weixin
minici --bump --open --preview --upload --platform mp-weixin
```

非法示例：

```bash
minici --bump --open --platform mp-weixin
minici --bump --preview --platform mp-weixin
minici --bump --open --preview --platform mp-weixin
```

错误文案为：

```txt
bump 搭配 CI 操作时必须包含 upload
```

没有 `--bump` 时，现有规则不变：必须至少指定一个 action；只要存在 action，就必须指定合法 `--platform`。

bump-only 中 `--platform` 是可选项；如果用户显式传入，仍按 `supportedPlatforms` 校验平台值，但不读取对应平台配置。

### Vite 插件

插件模式新增支持：

```bash
uni build -p mp-weixin -- --bump
uni build -p mp-weixin -- --bump --upload
```

规则如下：

- `uni build -p mp-weixin -- --bump` 合法，执行 bump-only。
- `uni dev -p mp-weixin -- --bump` 报错 `bump 只支持 build 模式`。
- `--bump` 搭配 action 时必须包含 `--upload`。
- 只要包含 `upload` 且处于 serve 模式，继续报错；包含 bump 时优先报 `bump 只支持 build 模式`。
- 如果 `UNI_PLATFORM` 存在但不是支持的小程序平台，例如 h5，插件直接跳过，不执行 bump 或 CI action。
- 插件 bump-only 不主动读取平台配置；如果 `UNI_PLATFORM` 缺失但没有 CI action，可以继续执行 bump-only。

## 配置与类型

`MiniCIConfig` 新增：

```ts
import type { VersionBumpOptions } from "bumpp";

export interface MiniCIConfig {
  /** 发布版本号 */
  version?: string;
  /** 发布描述 */
  desc?: string | MiniCIDescFunction;
  /** 小程序构建产物目录 */
  projectPath?: string;
  /** bumpp 程序化 API 参数 */
  bumpOptions?: VersionBumpOptions;
}
```

`ParsedCliArgs` 调整为：

```ts
export interface ParsedCliArgs {
  /** 当前操作列表 */
  operations: MiniCIOperation[];
  /** 是否执行 bumpp 版本更新 */
  bump?: boolean;
  /** 当前平台；bump-only 时可为空 */
  platform?: MiniCIPlatform;
  /** 项目产物目录 */
  projectPath?: string;
  /** 发布版本 */
  version?: string;
  /** 发布描述 */
  desc?: string;
  /** 配置文件路径 */
  config?: string;
  /** 当前工作目录 */
  cwd?: string;
  /** 标记为开发构建 */
  dev?: boolean;
}
```

结果类型采用联合类型，避免 bump-only 伪造平台、描述和项目路径：

```ts
export interface MiniCIBumpResult {
  /** 是否执行成功 */
  success: boolean;
  /** 原版本号 */
  currentVersion: string;
  /** 新版本号 */
  newVersion: string;
  /** git commit 信息；未提交时为 false */
  commit: string | false;
  /** git tag 信息；未打 tag 时为 false */
  tag: string | false;
  /** 实际更新的文件 */
  updatedFiles: string[];
  /** 未包含旧版本号而跳过的文件 */
  skippedFiles: string[];
}

export interface MiniCIBumpOnlyResult {
  /** 是否执行成功 */
  success: true;
  /** bump-only 没有 CI action */
  operations: [];
  /** bump 执行结果 */
  bump: MiniCIBumpResult;
}

export interface MiniCIActionResult {
  /** 是否全部执行成功 */
  success: boolean;
  /** 当前操作列表 */
  operations: MiniCIOperation[];
  /** 当前平台 */
  platform: MiniCIPlatform;
  /** 当前发布版本 */
  version: string;
  /** 当前发布描述 */
  desc: string;
  /** 当前项目目录 */
  projectPath: string;
  /** bump 执行结果 */
  bump?: MiniCIBumpResult;
  /** 每个 action 的执行结果 */
  results: MiniCISingleResult[];
}

export type MiniCIResult = MiniCIBumpOnlyResult | MiniCIActionResult;
```

`bumpOptions` 运行时 schema 只校验为普通对象，保留 `execute`、`customVersion`、`progress` 等函数字段，不重建 bumpp 的字段白名单。文档只列出关键字段 `release`、`commit`、`tag`、`push`、`confirm`。

## 执行流

共享入口 `runMiniCIWithConfig()` 调整为：

```txt
loadPackageJson(cwd)
validate run args
if args.bump
  runBump({ cwd, config.bumpOptions })
  reload package.json
  if args.operations is empty
    return bump-only result
  args.version = bump.newVersion

for operation in args.operations
  normalizeConfig({ args: { ...args, operation }, cwd, config, packageJson })
  assert projectPath exists
  createCI(normalized)
  ci.init()
  ci[operation]()
collect results
return action result with optional bump
```

调用 bumpp 时合并顺序为：

```ts
versionBump({
  commit: false,
  tag: false,
  push: false,
  ...config.bumpOptions,
  cwd,
})
```

关键约束：

- bump 在 CI action 之前执行。
- bump-only 不调用 `normalizeConfig()`，因此不校验平台配置、`projectPath` 或 `desc`。
- bump 后重新加载 `package.json`，让后续 `desc(context.packageJson)` 拿到更新后的版本文件内容。
- `cwd` 由 mini-ci 入口决定，强制传给 bumpp，不允许 `bumpOptions.cwd` 改写到另一个目录。
- 不默认设置 `interface: false`，因为未配置 `release` 时需要保留 bumpp prompt 能力。CI 环境应配置 `bumpOptions.release` 和 `confirm: false`。

## 错误处理与日志

参数层错误：

- CLI：`--bump` 搭配 action 但不含 `--upload`，报 `bump 搭配 CI 操作时必须包含 upload`。
- CLI：没有 `--bump` 且没有 action，继续报现有“请指定操作”。
- CLI：有 action 但缺 platform，继续报现有“请指定平台”。
- 插件：`--bump` 出现在 serve 模式，报 `bump 只支持 build 模式`。
- 插件：`--bump` 搭配 action 但不含 `upload`，报 `bump 搭配 CI 操作时必须包含 upload`。
- 插件：非小程序平台直接跳过，不报错。

bumpp 执行错误：

- `versionBump()` 抛错时，core 记录 `执行失败`。
- 错误 detail 包含 `stage: bump` 和错误消息。
- 如果配置了 `hooks.onError`，触发一次 `onError`；此时 `operation` 为空。
- bump-only 错误不提供 platform；如果 bump 搭配 action 且 parser 已拿到 platform，则可在 `onError.data` 中提供 platform。

日志建议：

- bump 开始时输出分组：`bump` / `更新版本号`。
- bump 成功后输出 `currentVersion`、`newVersion`、`updatedFiles`、`commit`、`tag`。
- `commit`、`tag` 为 `false` 时也输出，以体现安全默认值。
- bump-only 成功后输出 `完成` 和 `版本更新成功`。
- bump + action 成功后，现有 `minici` header 使用 bumpp 的 `newVersion`。

## 测试计划

`packages/cli/tests/command.test.ts`：

- `--bump` 可单独解析为 `operations: []`、`bump: true`。
- `--bump` 单独执行不要求 platform。
- `--bump --open`、`--bump --preview`、`--bump --open --preview` 报错。
- `--bump --upload --platform mp-weixin` 合法。
- 没有 `--bump` 且没有 action 仍报“请指定操作”。
- 有 action 缺 platform 仍报“请指定平台”。

`packages/vite-plugin/tests/plugin-args.test.ts`：

- `-- --bump` 解析为 `{ operations: [], bump: true }`。
- `-- --bump --upload` 合法。
- `-- --bump --preview` 报错。
- 未知参数仍报错。

`packages/core/tests`：

- mock `versionBump()`，验证默认传入 `commit: true`、`tag: false`、`push: false`、`cwd`。
- 验证 `bumpOptions` 显式配置可覆盖安全默认值。
- 验证 bump-only 不校验平台配置、不校验 projectPath。
- 验证 bump + upload 使用 `newVersion` 作为 CI version。
- 验证 bump 后重新加载 `package.json`，供 `desc` 函数使用。
- 验证 bumpp 抛错时触发 `hooks.onError` 且不执行 action。
- 验证 bump 搭配 action 不含 upload 时 fail-fast，不调用 bumpp。

`packages/vite-plugin/tests/plugin.test.ts`：

- build + `-- --bump` 执行 bump-only。
- serve + `-- --bump` 报 `bump 只支持 build 模式`。
- 非小程序平台 + `-- --bump` 跳过。
- build + `-- --bump --upload` 先 bump 后 upload。
- serve + `-- --bump --upload` 优先报 `bump 只支持 build 模式`。

## 文档同步

需要同步：

- `README.md`
- `docs/cli.md`
- `docs/vite-plugin.md`

文档内容应覆盖：

- CLI 和插件参数表新增 `--bump`。
- 配置表新增 `bumpOptions`，说明复用 bumpp `VersionBumpOptions`。
- 示例只列关键配置：`release`、`commit`、`tag`、`push`、`confirm`。
- 明确 mini-ci 默认 `commit` 为 `true`、`tag/push` 为 `false`，不同于 bumpp 原生默认。
- 明确 `--bump` 搭配 action 必须包含 `--upload`。
- 明确 bump-only 不需要 platform。
- 明确插件非小程序平台会跳过全部插件动作，包括 bump。

## 成功标准

- CLI 和 Vite 插件都支持 `--bump` boolean 参数。
- bump-only 可以执行且不要求平台配置。
- bump 搭配 CI action 时必须包含 `upload`。
- Vite 插件 serve 模式拒绝 bump。
- Vite 插件非小程序平台跳过 bump 和 CI action。
- 启用 bump 后 CI 发布版本使用 bumpp 返回的 `newVersion`。
- mini-ci 默认启用 bumpp 的 commit、禁用 tag 和 push，用户可通过 `bumpOptions` 显式覆盖。
- `MiniCIConfig.bumpOptions` 类型复用 `VersionBumpOptions`。
- `MiniCIResult` 能准确表达 bump-only 与 bump + action 两种结果。
