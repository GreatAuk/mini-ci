# Multiple Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 允许 `minici` CLI 和 `uniMiniCI()` Vite 插件同时接收 `--open`、`--preview`、`--upload` 多个 action，并按 `open -> preview -> upload` 固定顺序执行。

**Architecture:** 将解析结果从单个 `operation` 升级为 `operations: MiniCIOperation[]`。共享执行入口在 core 内循环执行每个 action，但每次执行平台 CI 时仍构造单 action 的 normalized config，保证动态 `desc(context.operation)`、二维码路径和平台适配器行为保持单 action 语义。

**Tech Stack:** TypeScript ESM、pnpm workspace、Turbo、Vitest、cac、minimist、zod。

---

## File Structure

- Modify: `packages/core/src/types.ts`  
  新增 `MiniCISingleResult`，把 `ParsedCliArgs.operation` 改为 `operations`，把 `MiniCIResult` 改为聚合结果。
- Modify: `packages/core/src/config/normalize.ts`  
  让 `normalizeConfig()` 接收单次执行参数 `operation`，保持现有动态 `desc` 逻辑。
- Modify: `packages/core/src/runMiniCIWithConfig.ts`  
  按 `args.operations` 循环执行，收集 `results`，fail-fast。
- Modify: `packages/cli/src/command/parseArgs.ts`  
  移除多 action 互斥报错，输出固定顺序 `operations`。
- Modify: `packages/cli/src/cli.ts`  
  遍历 `result.results` 输出二维码信息。
- Modify: `packages/vite-plugin/src/parsePluginArgs.ts`  
  输出 `operations`；未传 action 返回空数组。
- Modify: `packages/vite-plugin/src/uniMiniCI.ts`  
  build 模式允许任意组合；serve 模式允许 open/preview，拒绝 upload。
- Modify: `packages/cli/tests/command.test.ts`
- Modify: `packages/cli/tests/runner.test.ts`
- Modify: `packages/vite-plugin/tests/plugin-args.test.ts`
- Modify: `packages/vite-plugin/tests/plugin.test.ts`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-05-11-minici-cli-design.md`
- Modify: `docs/superpowers/specs/2026-05-13-vite-plugin-uni-mini-ci-design.md`

---

### Task 1: CLI 和插件参数解析改为 operations

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/cli/src/command/parseArgs.ts`
- Modify: `packages/vite-plugin/src/parsePluginArgs.ts`
- Test: `packages/cli/tests/command.test.ts`
- Test: `packages/vite-plugin/tests/plugin-args.test.ts`

- [ ] **Step 1: 写 CLI parser 失败测试**

在 `packages/cli/tests/command.test.ts` 中做这些替换和新增。

把第一个测试期望从：

```ts
{
  operation: "upload",
  platform: "mp-weixin",
  projectPath: "dist/build/mp-weixin",
}
```

改为：

```ts
{
  operations: ["upload"],
  platform: "mp-weixin",
  projectPath: "dist/build/mp-weixin",
}
```

继续把以下测试里的期望同步改成 `operations: ["..."]`：

- `解析 --preview 的版本和发布描述`：`operation: "preview"` 改为 `operations: ["preview"]`
- `解析所有可选参数`：`operation: "upload"` 改为 `operations: ["upload"]`
- `解析 --open 操作`：`operation: "open"` 改为 `operations: ["open"]`
- `解析 --dev 标记`：`operation: "open"` 改为 `operations: ["open"]`

把“同时传入多个操作参数会抛出明确错误”测试替换为：

```ts
test("同时传入多个操作参数会按固定顺序解析", () => {
  expect(parseCliArgs(["--open", "--upload", "--platform", "mp-weixin"])).toEqual({
    operations: ["open", "upload"],
    platform: "mp-weixin",
  });
});

test("多个操作参数的解析顺序不受传参顺序影响", () => {
  expect(parseCliArgs(["--upload", "--open", "--platform", "mp-weixin"])).toEqual({
    operations: ["open", "upload"],
    platform: "mp-weixin",
  });
});
```

- [ ] **Step 2: 写 Vite plugin parser 失败测试**

在 `packages/vite-plugin/tests/plugin-args.test.ts` 中把无 action 期望改为：

```ts
expect(parsePluginArgs(["uni", "build", "-p", "mp-weixin"])).toEqual({ operations: [] });
```

把 `--` 后无 action 期望改为：

```ts
expect(parsePluginArgs(["uni", "build", "-p", "mp-weixin", "--"])).toEqual({
  operations: [],
});
```

把单 action 期望改成：

```ts
expect(parsePluginArgs(["uni", "build", "-p", "mp-weixin", "--", "--upload"])).toEqual({
  operations: ["upload"],
});
```

把“同时传入多个操作时报错”替换为：

```ts
test("同时传入多个操作时按固定顺序解析", () => {
  expect(parsePluginArgs(["uni", "build", "-p", "mp-weixin", "--", "--open", "--upload"])).toEqual(
    {
      operations: ["open", "upload"],
    },
  );
});

test("多个操作参数的解析顺序不受传参顺序影响", () => {
  expect(parsePluginArgs(["uni", "build", "-p", "mp-weixin", "--", "--upload", "--open"])).toEqual(
    {
      operations: ["open", "upload"],
    },
  );
});
```

- [ ] **Step 3: 运行 parser 测试确认失败**

Run:

```bash
pnpm exec vitest run packages/cli/tests/command.test.ts packages/vite-plugin/tests/plugin-args.test.ts
```

Expected: FAIL，错误包含对象里仍返回 `operation` 或多 action 仍抛出 `只能指定一个操作`。

- [ ] **Step 4: 修改 core 类型**

在 `packages/core/src/types.ts` 中把 `ParsedCliArgs` 的字段改为：

```ts
/** 已解析的 CLI 参数 */
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

暂时不要改 `MiniCIResult`，留到 Task 2 统一处理。

- [ ] **Step 5: 修改 CLI parser 实现**

在 `packages/cli/src/command/parseArgs.ts` 中删除多 action 互斥校验：

```ts
if (operations.length > 1) {
  throw new Error("只能指定一个操作：--open、--preview、--upload");
}
```

把 `cliArgs` 构造改为：

```ts
/** 已解析的 CLI 参数 */
const cliArgs: ParsedCliArgs = {
  operations,
  platform: rawPlatform,
};
```

- [ ] **Step 6: 修改插件 parser 类型和实现**

在 `packages/vite-plugin/src/parsePluginArgs.ts` 中把接口改为：

```ts
/** Vite 插件参数解析结果 */
export interface ParsedPluginArgs {
  /** 当前操作列表；空数组表示跳过插件执行 */
  operations: MiniCIOperation[];
}
```

把无参数返回值改为：

```ts
return { operations: [] };
```

把无 action 返回值改为：

```ts
return { operations: [] };
```

删除多 action 互斥校验：

```ts
if (operations.length > 1) {
  throw new Error("只能指定一个操作：--open、--preview、--upload");
}
```

把最终返回值改为：

```ts
return {
  operations,
};
```

- [ ] **Step 7: 运行 parser 测试确认通过**

Run:

```bash
pnpm exec vitest run packages/cli/tests/command.test.ts packages/vite-plugin/tests/plugin-args.test.ts
```

Expected: PASS。

- [ ] **Step 8: 授权后提交 Task 1**

提交前先向用户确认 git 授权。获得授权后运行：

```bash
git add packages/core/src/types.ts packages/cli/src/command/parseArgs.ts packages/cli/tests/command.test.ts packages/vite-plugin/src/parsePluginArgs.ts packages/vite-plugin/tests/plugin-args.test.ts
git commit -m "feat: parse multiple mini-ci actions"
```

Expected: 生成提交 `feat: parse multiple mini-ci actions`。

---

### Task 2: Core 聚合执行和返回值

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/config/normalize.ts`
- Modify: `packages/core/src/runMiniCIWithConfig.ts`
- Modify: `packages/cli/tests/runner.test.ts`

- [ ] **Step 1: 写多 action 执行顺序失败测试**

在 `packages/cli/tests/runner.test.ts` 的 `describe("runMiniCI", () => {` 内新增：

```ts
test("按固定顺序执行多个操作并返回聚合结果", async () => {
  const cwd = await createProjectDir();

  const { runMiniCI } = await import("../src/index");
  const result = await runMiniCI({
    argv: ["--upload", "--open", "--preview", "--platform", "mp-weixin"],
    cwd,
  });

  expect(calls).toEqual([{ method: "open" }, { method: "preview" }, { method: "upload" }]);
  expect(result.success).toBe(true);
  expect(result.operations).toEqual(["open", "preview", "upload"]);
  expect(result.results.map((item) => item.operation)).toEqual(["open", "preview", "upload"]);
});
```

- [ ] **Step 2: 写动态 desc 单 action 上下文失败测试**

修改 `createProjectDir()` 写入的 `minici.config.mjs`，把 `desc: '配置描述'` 改为：

```js
desc: ({ operation }) => `配置描述-${operation}`,
```

在 `describe("runMiniCI", () => {` 内新增：

```ts
test("多个操作会为每个 action 分别解析 desc 上下文", async () => {
  const cwd = await createProjectDir();

  const { runMiniCI } = await import("../src/index");
  const result = await runMiniCI({
    argv: ["--open", "--preview", "--platform", "mp-weixin"],
    cwd,
  });

  expect(result.results.map((item) => item.desc)).toEqual(["配置描述-open", "配置描述-preview"]);
});
```

- [ ] **Step 3: 写 fail-fast 失败测试**

把文件顶部 `calls` 类型改为：

```ts
/** mock createCI 返回的执行记录 */
const calls: Array<{ method: string }> = [];
/** 需要 mock 失败的操作 */
let failingMethod: string | undefined;
```

在 mock 的 `preview` 实现开头加入：

```ts
if (failingMethod === "preview") {
  throw new Error("preview failed");
}
```

在 `afterEach()` 中加入：

```ts
failingMethod = undefined;
```

新增测试：

```ts
test("某个操作失败时不会继续执行后续操作", async () => {
  const cwd = await createProjectDir();
  failingMethod = "preview";

  const { runMiniCI } = await import("../src/index");

  await expect(
    runMiniCI({
      argv: ["--open", "--preview", "--upload", "--platform", "mp-weixin"],
      cwd,
    }),
  ).rejects.toThrow("preview failed");

  expect(calls).toEqual([{ method: "open" }]);
});
```

- [ ] **Step 4: 运行 runner 测试确认失败**

Run:

```bash
pnpm exec vitest run packages/cli/tests/runner.test.ts
```

Expected: FAIL，错误来自 `operation` 字段不存在、`result.results` 不存在或多 action 未执行。

- [ ] **Step 5: 新增 core 返回类型**

在 `packages/core/src/types.ts` 中用以下结构替换当前 `MiniCIResult`：

```ts
/** minici 单个 action 执行结果 */
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

/** minici 执行聚合结果 */
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

- [ ] **Step 6: 给 normalizeConfig 增加单次 operation 输入**

在 `packages/core/src/config/normalize.ts` 顶部类型导入中加入 `MiniCIOperation`：

```ts
import type {
  MiniCIConfig,
  MiniCIDescContext,
  MiniCIOperation,
  MiniCIPlatform,
  NormalizedMiniCIConfig,
  ParsedCliArgs,
} from "../types";
```

然后新增类型：

```ts
/** 单次 action 归一化入参 */
type SingleOperationArgs<P extends MiniCIPlatform> = Omit<ParsedCliArgs, "operations"> & {
  /** 当前操作 */
  operation: MiniCIOperation;
  /** 当前平台 */
  platform: P;
};
```

把 `NormalizeConfigInput` 的 `args` 改为：

```ts
/** 已解析的单次执行参数 */
args: SingleOperationArgs<P>;
```

保持 `resolveDesc()` 和 `normalizedConfig.operation` 继续读取 `input.args.operation`。

- [ ] **Step 7: 修改 runMiniCIWithConfig 聚合执行**

把 `packages/core/src/runMiniCIWithConfig.ts` 中 `runMiniCIWithConfig()` 函数体替换为：

```ts
export async function runMiniCIWithConfig(
  options: RunMiniCIWithConfigOptions,
): Promise<MiniCIResult> {
  const packageJson = await loadPackageJson(options.cwd);
  const results: MiniCIResult["results"] = [];

  for (const operation of options.args.operations) {
    const normalized = await normalizeConfig({
      args: {
        ...options.args,
        operation,
      },
      cwd: options.cwd,
      config: options.config,
      packageJson,
    });

    await assertPathExists(normalized.projectPath);

    const ci = createCI(normalized);
    await ci.init();
    const result = await ci[operation]();
    results.push(result);
  }

  const firstResult = results[0];

  return {
    success: results.every((result) => result.success),
    operations: options.args.operations,
    platform: firstResult.platform,
    version: firstResult.version,
    desc: firstResult.desc,
    projectPath: firstResult.projectPath,
    results,
  };
}
```

注意：parser 已保证至少一个 action；插件空 action 会在调用 core 前跳过。

- [ ] **Step 8: 修正 mock 返回类型使用**

`packages/cli/tests/runner.test.ts` 的 mock 仍返回单次结果，不需要包含 `results`。确保每个 mock 方法返回：

```ts
return {
  success: true,
  operation: config.operation,
  platform: config.platform,
  version: config.version,
  desc: config.desc,
  projectPath: config.projectPath,
};
```

- [ ] **Step 9: 运行 runner 测试确认通过**

Run:

```bash
pnpm exec vitest run packages/cli/tests/runner.test.ts
```

Expected: PASS。

- [ ] **Step 10: 授权后提交 Task 2**

提交前先向用户确认 git 授权。获得授权后运行：

```bash
git add packages/core/src/types.ts packages/core/src/config/normalize.ts packages/core/src/runMiniCIWithConfig.ts packages/cli/tests/runner.test.ts
git commit -m "feat(core): run multiple mini-ci actions"
```

Expected: 生成提交 `feat(core): run multiple mini-ci actions`。

---

### Task 3: CLI 输出聚合结果

**Files:**
- Modify: `packages/cli/src/cli.ts`
- Modify: `packages/cli/tests/runner.test.ts`

- [ ] **Step 1: 更新 CLI 返回值断言**

在 `packages/cli/tests/runner.test.ts` 的“命令行 version 和 desc 正确传递”测试中，把断言改为：

```ts
expect(result.version).toBe("2.0.0");
expect(result.desc).toBe("CLI 描述");
expect(result.results).toHaveLength(1);
expect(result.results[0]?.version).toBe("2.0.0");
expect(result.results[0]?.desc).toBe("CLI 描述");
```

- [ ] **Step 2: 修改 CLI 输出实现**

在 `packages/cli/src/cli.ts` 中把：

```ts
if (result.qrCodeLocalPath) {
  console.log(`二维码路径：${result.qrCodeLocalPath}`);
}

if (result.qrCodeContent) {
  console.log(`二维码内容：${result.qrCodeContent}`);
}
```

替换为：

```ts
for (const item of result.results) {
  if (item.qrCodeLocalPath) {
    console.log(`二维码路径：${item.qrCodeLocalPath}`);
  }

  if (item.qrCodeContent) {
    console.log(`二维码内容：${item.qrCodeContent}`);
  }
}
```

- [ ] **Step 3: 运行 CLI 相关测试**

Run:

```bash
pnpm exec vitest run packages/cli/tests/runner.test.ts packages/cli/tests/index.test.ts
```

Expected: PASS。

- [ ] **Step 4: 授权后提交 Task 3**

提交前先向用户确认 git 授权。获得授权后运行：

```bash
git add packages/cli/src/cli.ts packages/cli/tests/runner.test.ts
git commit -m "fix(cli): print multiple action results"
```

Expected: 生成提交 `fix(cli): print multiple action results`。

---

### Task 4: Vite 插件多 action 与 serve 约束

**Files:**
- Modify: `packages/vite-plugin/src/uniMiniCI.ts`
- Modify: `packages/vite-plugin/tests/plugin.test.ts`

- [ ] **Step 1: 写 build 多 action 失败测试**

在 `packages/vite-plugin/tests/plugin.test.ts` 的 `describe("uniMiniCI", () => {` 内新增：

```ts
test("build 模式按固定顺序执行多个操作", async () => {
  const { cwd, outputDir } = await createProject("build");
  process.argv = ["node", "uni", "build", "-p", "mp-weixin", "--", "--upload", "--open", "--preview"];
  process.env.UNI_PLATFORM = "mp-weixin";
  process.env.UNI_OUTPUT_DIR = outputDir;

  const plugin = uniMiniCI({
    desc: "插件描述",
    "mp-weixin": {
      appid: "wx-appid",
      privateKeyPath: "key/private.key",
    },
  });

  await runBuildPlugin(plugin, cwd);

  expect(calls).toEqual([
    { method: "open", projectPath: outputDir, platform: "mp-weixin" },
    { method: "preview", projectPath: outputDir, platform: "mp-weixin" },
    { method: "upload", projectPath: outputDir, platform: "mp-weixin" },
  ]);
});
```

- [ ] **Step 2: 写 serve preview 失败测试**

新增：

```ts
test("serve 模式执行 preview", async () => {
  const { cwd, outputDir } = await createProject("serve");
  process.argv = ["node", "uni", "dev", "-p", "mp-weixin", "--", "--preview"];
  process.env.UNI_PLATFORM = "mp-weixin";
  process.env.UNI_OUTPUT_DIR = outputDir;

  const plugin = uniMiniCI({
    desc: "插件描述",
    "mp-weixin": {
      appid: "wx-appid",
      privateKeyPath: "key/private.key",
    },
  });

  await runServePlugin(plugin, cwd);

  expect(calls).toEqual([{ method: "preview", projectPath: outputDir, platform: "mp-weixin" }]);
});

test("serve 模式按固定顺序执行 open 和 preview", async () => {
  const { cwd, outputDir } = await createProject("serve");
  process.argv = ["node", "uni", "dev", "-p", "mp-weixin", "--", "--preview", "--open"];
  process.env.UNI_PLATFORM = "mp-weixin";
  process.env.UNI_OUTPUT_DIR = outputDir;

  const plugin = uniMiniCI({
    desc: "插件描述",
    "mp-weixin": {
      appid: "wx-appid",
      privateKeyPath: "key/private.key",
    },
  });

  await runServePlugin(plugin, cwd);

  expect(calls).toEqual([
    { method: "open", projectPath: outputDir, platform: "mp-weixin" },
    { method: "preview", projectPath: outputDir, platform: "mp-weixin" },
  ]);
});
```

- [ ] **Step 3: 更新 serve upload 拒绝测试**

把“serve 模式拒绝 upload”中的错误文案断言改为：

```ts
await expect(runServePlugin(plugin, cwd)).rejects.toThrow("upload 只支持 build 模式");
```

新增组合拒绝测试：

```ts
test("serve 模式包含 upload 时整体报错且不执行其他操作", async () => {
  const { cwd, outputDir } = await createProject("serve");
  process.argv = ["node", "uni", "dev", "-p", "mp-weixin", "--", "--open", "--upload"];
  process.env.UNI_PLATFORM = "mp-weixin";
  process.env.UNI_OUTPUT_DIR = outputDir;

  const plugin = uniMiniCI({
    "mp-weixin": {
      appid: "wx-appid",
      privateKeyPath: "key/private.key",
    },
  });

  await expect(runServePlugin(plugin, cwd)).rejects.toThrow("upload 只支持 build 模式");
  expect(calls).toEqual([]);
});
```

- [ ] **Step 4: 运行插件测试确认失败**

Run:

```bash
pnpm exec vitest run packages/vite-plugin/tests/plugin.test.ts
```

Expected: FAIL，错误来自 `pluginArgs.operation` 不存在或 serve preview 仍被拒绝。

- [ ] **Step 5: 修改插件执行逻辑**

在 `packages/vite-plugin/src/uniMiniCI.ts` 的 `runPluginOperation()` 中把：

```ts
if (!pluginArgs.operation) {
  return;
}
```

替换为：

```ts
if (pluginArgs.operations.length === 0) {
  return;
}
```

把 serve 约束从：

```ts
if (resolvedConfig?.command === "serve" && pluginArgs.operation !== "open") {
  throw new Error("preview/upload 只支持 build 模式");
}
```

替换为：

```ts
if (resolvedConfig?.command === "serve" && pluginArgs.operations.includes("upload")) {
  throw new Error("upload 只支持 build 模式");
}
```

把传给 core 的 args 改为：

```ts
args: {
  operations: pluginArgs.operations,
  platform,
  projectPath,
},
```

- [ ] **Step 6: 运行插件测试确认通过**

Run:

```bash
pnpm exec vitest run packages/vite-plugin/tests/plugin-args.test.ts packages/vite-plugin/tests/plugin.test.ts
```

Expected: PASS。

- [ ] **Step 7: 授权后提交 Task 4**

提交前先向用户确认 git 授权。获得授权后运行：

```bash
git add packages/vite-plugin/src/uniMiniCI.ts packages/vite-plugin/tests/plugin.test.ts
git commit -m "feat(vite-plugin): run multiple mini-ci actions"
```

Expected: 生成提交 `feat(vite-plugin): run multiple mini-ci actions`。

---

### Task 5: 文档同步与全量验证

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-05-11-minici-cli-design.md`
- Modify: `docs/superpowers/specs/2026-05-13-vite-plugin-uni-mini-ci-design.md`

- [ ] **Step 1: 更新 README action 表述**

在 `README.md` 的 action 说明附近加入：

```md
`--open`、`--preview`、`--upload` 可以组合使用；组合时执行顺序固定为 `open -> preview -> upload`，不受命令行书写顺序影响。
```

在 CLI 示例中加入：

```bash
minici --open --preview --upload --platform mp-weixin
```

在 Vite 插件示例中加入：

```bash
uni build -p mp-weixin -- --preview --upload
uni dev   -p mp-weixin -- --open --preview
```

并明确 `uni dev` 下不支持 `--upload`：

```md
`uni dev` 场景支持 `--open` 和 `--preview`，不支持 `--upload`。
```

- [ ] **Step 2: 更新旧 CLI 设计文档**

在 `docs/superpowers/specs/2026-05-11-minici-cli-design.md` 中把“互斥操作参数”改为“操作 flag”，并在命令参数章节加入：

```md
后续 multiple actions 设计已经移除 `--open`、`--preview`、`--upload` 的互斥限制。三个 flag 可以组合使用，执行顺序固定为 `open -> preview -> upload`。
```

把“必须且只能传入一个”改为：

```md
- `--open`、`--preview`、`--upload` 至少传入一个，可以组合传入。
```

- [ ] **Step 3: 更新旧 Vite 插件设计文档**

在 `docs/superpowers/specs/2026-05-13-vite-plugin-uni-mini-ci-design.md` 中把“同时传 `--open --upload` 报错”改为：

```md
- 同时传入多个操作时按 `open -> preview -> upload` 固定顺序执行。
```

把 serve 模式约束更新为：

```md
- `serve` 模式允许执行 `open` 和 `preview`。
- `serve` 模式包含 `upload` 时直接报错，错误文案为 `upload 只支持 build 模式`。
```

- [ ] **Step 4: 运行定向测试**

Run:

```bash
pnpm exec vitest run packages/cli/tests/command.test.ts packages/cli/tests/runner.test.ts packages/vite-plugin/tests/plugin-args.test.ts packages/vite-plugin/tests/plugin.test.ts
```

Expected: PASS。

- [ ] **Step 5: 运行全量验证**

Run:

```bash
pnpm run test
pnpm run typecheck
pnpm run typecheck:test
```

Expected: 三条命令都 PASS。

- [ ] **Step 6: 按需运行格式和 lint 验证**

Run:

```bash
pnpm run lint
pnpm run fmt:check
```

Expected: 两条命令都 PASS。若失败，只修复本次改动引入的问题，不做无关格式化。

- [ ] **Step 7: 授权后提交 Task 5**

提交前先向用户确认 git 授权。获得授权后运行：

```bash
git add README.md docs/superpowers/specs/2026-05-11-minici-cli-design.md docs/superpowers/specs/2026-05-13-vite-plugin-uni-mini-ci-design.md
git commit -m "docs: document multiple mini-ci actions"
```

Expected: 生成提交 `docs: document multiple mini-ci actions`。

---

## Self-Review

- Spec coverage: 已覆盖多 action 参数解析、固定顺序、全链路 `operations` 类型、聚合返回值、动态 desc 单 action 上下文、fail-fast、Vite 插件 build/serve 差异、文档同步和验证命令。
- Placeholder scan: 本计划未使用 TBD、TODO、implement later、类似 Task N 等占位描述。
- Type consistency: 计划统一使用 `operations: MiniCIOperation[]`、`MiniCISingleResult`、聚合 `MiniCIResult.results`；单次执行仍使用 `operation` 传入 `normalizeConfig()` 和平台 CI。
- Scope check: 改动集中在 CLI/parser/core runner/Vite plugin/docs，不改平台 SDK 适配器实现，不引入部分成功恢复逻辑。
