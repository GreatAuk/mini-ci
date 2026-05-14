# multiple actions 设计文档

## 背景

当前 `minici` CLI 和 `uniMiniCI()` Vite 插件都支持 `--open`、`--preview`、`--upload` 三个 action flag，但解析阶段要求三者互斥，只能指定一个操作。新的目标是移除这个互斥限制，允许用户在同一次命令中同时指定多个 action。

示例：

```bash
minici --open --preview --upload --platform mp-weixin
uni build -p mp-weixin -- --preview --upload
```

本设计只覆盖 action 组合语义、类型模型、执行顺序、返回值、测试和文档同步。不改平台 SDK 适配器的具体 open / preview / upload 实现。

## 已确认决策

- `--open`、`--preview`、`--upload` 不再互斥，可以任意组合。
- 至少要指定一个 action；未指定 action 仍报错。
- 多 action 执行顺序固定为 `open -> preview -> upload`，由 `supportedOperations` 作为唯一顺序来源。
- 用户传参顺序不影响执行顺序，例如 `--upload --open` 仍按 `open -> upload` 执行。
- 采用全链路多操作模型，把运行参数中的 `operation` 升级为 `operations: MiniCIOperation[]`。
- `MiniCIDescContext.operation` 保留单个 action，因为动态 `desc` 在每次具体 action 执行时计算。
- Vite 插件 `serve` 模式允许 `open` 和 `preview`；只要包含 `upload`，整体报错，不先执行其他 action。
- 任一 action 执行失败时 fail-fast，后续 action 不再执行。
- 设计文档只写入仓库，不执行 git 提交；提交需要用户单独授权。

## 命令语义

CLI 入口允许以下组合：

```bash
minici --open --platform mp-weixin
minici --preview --upload --platform mp-weixin
minici --upload --open --platform mp-weixin
minici --open --preview --upload --platform mp-weixin
```

Vite 插件 build 模式允许以下组合：

```bash
uni build -p mp-weixin -- --open
uni build -p mp-weixin -- --preview --upload
uni build -p mp-weixin -- --open --preview --upload
```

Vite 插件 serve 模式允许 `open` 和 `preview`：

```bash
uni dev -p mp-weixin -- --open
uni dev -p mp-weixin -- --preview
uni dev -p mp-weixin -- --open --preview
```

以下命令应报错：

```bash
uni dev -p mp-weixin -- --open --upload
uni dev -p mp-weixin -- --preview --upload
```

错误文案调整为 `upload 只支持 build 模式`。

## 类型模型

`ParsedCliArgs` 从单个 `operation` 改为多个 `operations`：

```ts
export interface ParsedCliArgs {
  /** 当前操作列表 */
  operations: MiniCIOperation[];
  /** 当前平台 */
  platform: MiniCIPlatform;
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
  /** 标记为开发构建；默认 projectPath 使用 dist/dev/<platform> */
  dev?: boolean;
}
```

`ParsedPluginArgs` 同步改为：

```ts
export interface ParsedPluginArgs {
  /** 当前操作列表；空数组表示跳过插件执行 */
  operations: MiniCIOperation[];
}
```

`MiniCIDescContext` 保持当前单 action 结构：

```ts
export interface MiniCIDescContext {
  /** 当前操作 */
  operation: MiniCIOperation;
  /** 当前平台 */
  platform: MiniCIPlatform;
  /** 当前发布版本 */
  version: string;
  /** 已解析的项目产物目录 */
  projectPath: string;
  /** 当前工作目录 */
  cwd: string;
  /** 当前项目 package.json 内容 */
  packageJson: Record<string, unknown>;
}
```

原因是 `desc` 函数描述的是某一次具体 `open`、`preview` 或 `upload`，不是整批 action。

## 返回值

多 action 会产生多个单次执行结果，返回值改为聚合结构：

```ts
export interface MiniCISingleResult {
  /** 是否执行成功 */
  success: boolean;
  /** 当前操作 */
  operation: MiniCIOperation;
  /** 当前平台 */
  platform: MiniCIPlatform;
  /** 当前发布版本 */
  version: string;
  /** 当前发布描述 */
  desc: string;
  /** 当前项目目录 */
  projectPath: string;
  /** 二维码本地路径 */
  qrCodeLocalPath?: string;
  /** 二维码内容 */
  qrCodeContent?: string;
}

export interface MiniCIResult {
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
  /** 每个 action 的执行结果 */
  results: MiniCISingleResult[];
}
```

`results` 用来保存每个 action 的二维码路径和二维码内容，避免把多个二维码结果挤进顶层 `qrCodeLocalPath` / `qrCodeContent` 字段。

## 执行流

共享执行入口 `runMiniCIWithConfig()` 接收 `operations` 后，按固定顺序逐个执行：

```txt
loadPackageJson(cwd)
for operation in args.operations
  normalizeConfig({ args: { ...args, operation }, cwd, config, packageJson })
  assert projectPath exists
  createCI(normalized)
  ci.init()
  ci[operation]()
collect results
return aggregate result
```

虽然外层参数是 `operations`，但每次执行平台 CI 方法时仍构造单 action 的规范化配置。这样可以保持以下行为：

- `desc(context.operation)` 每次拿到当前 action。
- `qrcodePath.preview` 只影响 `preview`，`qrcodePath.upload` 只影响 `upload`。
- 平台 CI 适配器继续通过 `open()`、`preview()`、`upload()` 表达单 action。
- 平台不支持某 action 时沿用适配器现有行为，例如京东小程序 `open()` 只 warn 并返回成功。

失败策略保持 fail-fast。某个 action 抛错时，错误继续向上抛出，后续 action 不再执行，不新增部分成功恢复逻辑。

## CLI 输出

CLI 入口需要遍历聚合结果：

```txt
for result in result.results
  if result.qrCodeLocalPath
    print 二维码路径
  if result.qrCodeContent
    print 二维码内容
exitCode = result.success ? 0 : 1
```

只执行单个 action 时，输出内容与当前行为保持等价。执行多个 action 时，会按 action 执行顺序分别打印二维码路径和二维码内容。

## Vite 插件约束

插件参数解析只接受 `--open`、`--preview`、`--upload`。未知参数和位置参数继续报错。

插件执行规则：

- 未传 action：返回空 `operations`，插件跳过。
- build 模式：允许任意 action 组合。
- serve 模式：允许 `operations` 包含 `open` 和 `preview`。
- serve 模式包含 `upload`：整体报错 `upload 只支持 build 模式`。
- h5 等非小程序平台：沿用现有逻辑，检测到非支持平台时跳过 CI。

## 测试计划

`packages/cli/tests/command.test.ts`：

- 原“多个操作时报错”改为解析出 `operations: ["open", "upload"]`。
- 增加乱序输入测试，例如 `--upload --open`，断言输出仍为 `["open", "upload"]`。
- 保留未传 action、未知参数、位置参数、缺平台、无效平台等严格校验测试。

`packages/vite-plugin/tests/plugin-args.test.ts`：

- 原“多个操作时报错”改为解析出多个 `operations`。
- 未传 `--` 或 `--` 后无 action 时返回空数组。
- 未知参数和位置参数继续报错。

`packages/core/tests` 与 `packages/cli/tests/runner.test.ts`：

- 验证 `runMiniCIWithConfig()` 按 `open -> preview -> upload` 顺序执行多个 action。
- 验证返回值包含 `results` 聚合。
- 验证动态 `desc(context.operation)` 每次拿到当前单 action。
- 验证某个 action 失败时 fail-fast，不执行后续 action。

`packages/vite-plugin/tests/plugin.test.ts`：

- build 模式多 action 会按固定顺序触发 CI。
- serve 模式只含 `--open` 正常执行。
- serve 模式只含 `--preview` 正常执行。
- serve 模式包含 `--open --preview` 时按固定顺序执行。
- serve 模式包含 `--upload` 时整体报错。
- 非小程序平台仍跳过 CI。

## 文档同步

需要同步更新：

- `README.md` 中 action 表述和示例。
- `docs/superpowers/specs/2026-05-11-minici-cli-design.md` 中旧的“互斥操作参数”表述。
- `docs/superpowers/specs/2026-05-13-vite-plugin-uni-mini-ci-design.md` 中旧的“多个操作时报错”表述。
- 相关 plan 中如果存在待执行的互斥测试描述，只做必要更新，不大范围重写历史内容。

## 成功标准

- CLI 和 Vite 插件都不再因为多个 action flag 报错。
- 多 action 执行顺序稳定为 `open -> preview -> upload`。
- 未传 action、未知参数、位置参数、缺平台等严格校验仍保留。
- Vite 插件 serve 模式允许 `open` 和 `preview`，不允许 `upload`。
- `desc(context.operation)` 对每个 action 仍拿到当前单 action。
- 多 action 返回值通过 `results` 表达每个 action 的二维码结果。
- `pnpm run test`、`pnpm run typecheck`、`pnpm run typecheck:test` 通过；如改动触发格式或 lint，再补 `pnpm run lint`、`pnpm run fmt:check`。
