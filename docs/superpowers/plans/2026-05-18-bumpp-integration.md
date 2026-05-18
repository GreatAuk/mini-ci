# Bumpp Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `minici` CLI 和 `uniMiniCI()` Vite 插件增加 `--bump`，通过 bumpp 程序化 API 在生产发布前更新版本号。

**Architecture:** `--bump` 不进入 `MiniCIOperation`，而是作为共享 runner 的前置阶段执行。CLI 和 Vite 插件只解析 boolean 开关；`uni-mini-ci-core` 负责合并安全默认值、调用 `versionBump()`、处理 bump-only 返回值，并在 bump + action 场景中把 `newVersion` 注入后续 CI 版本。

**Tech Stack:** TypeScript ESM、pnpm workspace、Turbo、Vitest、cac、minimist、zod、bumpp。

---

## File Structure

- Modify: `packages/core/package.json`  
  把 `bumpp` 从根开发依赖补到 core 运行时依赖。
- Modify: `pnpm-lock.yaml`  
  通过 `pnpm install --lockfile-only` 同步 importer 依赖关系。
- Modify: `packages/core/src/types.ts`  
  引入 `VersionBumpOptions`，新增 `bumpOptions`、`MiniCIBumpResult`、`MiniCIBumpOnlyResult`、`MiniCIActionResult`，让 `MiniCIResult` 成为联合类型，并让 `ParsedCliArgs.platform` 支持 bump-only 可选。
- Modify: `packages/core/src/config/schema.ts`  
  为 `bumpOptions` 增加宽校验对象 schema。
- Create: `packages/core/src/bump/runBump.ts`  
  封装 `versionBump()` 调用，集中处理安全默认值和结果映射。
- Modify: `packages/core/src/runMiniCIWithConfig.ts`  
  增加 runner 参数规则校验、bump 前置阶段、bump-only 返回、bump 错误日志和 hook。
- Modify: `packages/core/src/index.ts`  
  导出新的 bump 相关结果类型。
- Modify: `packages/cli/src/command/parseArgs.ts`  
  新增 `--bump`，支持 bump-only 可选 platform，并校验 bump + action 必须包含 upload。
- Modify: `packages/cli/src/cli.ts`  
  `--help` 新增 bump 说明。
- Modify: `packages/vite-plugin/src/parsePluginArgs.ts`  
  新增插件透传 `--bump` 解析和 bump + action 规则校验。
- Modify: `packages/vite-plugin/src/uniMiniCI.ts`  
  增加插件 build-only bump 规则，非小程序平台继续跳过全部动作。
- Test: `packages/cli/tests/command.test.ts`
- Test: `packages/cli/tests/runner.test.ts`
- Test: `packages/core/tests/bump.test.ts`
- Test: `packages/core/tests/config.test.ts`
- Test: `packages/core/tests/hooks.test.ts`
- Test: `packages/vite-plugin/tests/plugin-args.test.ts`
- Test: `packages/vite-plugin/tests/plugin.test.ts`
- Modify: `README.md`
- Modify: `docs/cli.md`
- Modify: `docs/vite-plugin.md`

---

### Task 1: 参数解析支持 `--bump`

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/cli/src/command/parseArgs.ts`
- Modify: `packages/vite-plugin/src/parsePluginArgs.ts`
- Test: `packages/cli/tests/command.test.ts`
- Test: `packages/vite-plugin/tests/plugin-args.test.ts`

- [ ] **Step 1: 写 CLI parser 失败测试**

在 `packages/cli/tests/command.test.ts` 中追加：

```ts
test("解析 bump-only 时不要求 platform", () => {
  expect(parseCliArgs(["--bump"])).toEqual({
    operations: [],
    bump: true,
  });
});

test("bump-only 显式传入 platform 时校验并保留平台", () => {
  expect(parseCliArgs(["--bump", "--platform", "mp-weixin"])).toEqual({
    operations: [],
    bump: true,
    platform: "mp-weixin",
  });
});

test("bump-only 显式传入非法 platform 时抛出明确错误", () => {
  expect(() => parseCliArgs(["--bump", "--platform", "h5"])).toThrow("暂不支持平台：h5");
});

test("bump 搭配 open 但不含 upload 时抛出明确错误", () => {
  expect(() => parseCliArgs(["--bump", "--open", "--platform", "mp-weixin"])).toThrow(
    "bump 搭配 CI 操作时必须包含 upload",
  );
});

test("bump 搭配 preview 但不含 upload 时抛出明确错误", () => {
  expect(() => parseCliArgs(["--bump", "--preview", "--platform", "mp-weixin"])).toThrow(
    "bump 搭配 CI 操作时必须包含 upload",
  );
});

test("bump 搭配 upload 时合法", () => {
  expect(parseCliArgs(["--bump", "--upload", "--platform", "mp-weixin"])).toEqual({
    operations: ["upload"],
    bump: true,
    platform: "mp-weixin",
  });
});
```

- [ ] **Step 2: 写 Vite plugin parser 失败测试**

在 `packages/vite-plugin/tests/plugin-args.test.ts` 中追加：

```ts
test("解析 bump-only", () => {
  expect(parsePluginArgs(["uni", "build", "-p", "mp-weixin", "--", "--bump"])).toEqual({
    operations: [],
    bump: true,
  });
});

test("解析 bump 和 upload", () => {
  expect(
    parsePluginArgs(["uni", "build", "-p", "mp-weixin", "--", "--bump", "--upload"]),
  ).toEqual({
    operations: ["upload"],
    bump: true,
  });
});

test("bump 搭配 preview 但不含 upload 时抛出明确错误", () => {
  expect(() =>
    parsePluginArgs(["uni", "build", "-p", "mp-weixin", "--", "--bump", "--preview"]),
  ).toThrow("bump 搭配 CI 操作时必须包含 upload");
});
```

- [ ] **Step 3: 运行 parser 测试确认失败**

Run:

```bash
pnpm exec vitest run packages/cli/tests/command.test.ts packages/vite-plugin/tests/plugin-args.test.ts
```

Expected: FAIL，错误包含 `暂不支持参数：--bump` 或返回对象缺少 `bump: true`。

- [ ] **Step 4: 修改 core 参数类型**

在 `packages/core/src/types.ts` 中把 `ParsedCliArgs` 改为：

```ts
/** 已解析的 CLI 参数 */
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
  /** 标记为开发构建；默认 projectPath 使用 dist/dev/<platform> */
  dev?: boolean;
}
```

- [ ] **Step 5: 修改 CLI parser 实现**

在 `packages/cli/src/command/parseArgs.ts` 中：

1. `ParsedOptions` 增加：

```ts
/** 是否执行 bumpp 版本更新 */
bump?: unknown;
```

2. `allowedOptionNames` 增加 `"bump"`。

3. `createCliParser()` 增加：

```ts
.option("--bump", "使用 bumpp 更新版本号")
```

4. 将 action 和 platform 校验替换为：

```ts
/** 命令行传入的操作参数列表 */
const operations = supportedOperations.filter((operation) => options[operation] === true);
/** 是否执行 bumpp 版本更新 */
const bump = options.bump === true;

if (operations.length === 0 && !bump) {
  throw new Error(
    "请指定操作，可选值：--open、--preview、--upload\n用法：minici --<operation> --platform <platform>",
  );
}

if (bump && operations.length > 0 && !operations.includes("upload")) {
  throw new Error("bump 搭配 CI 操作时必须包含 upload");
}

/** 原始平台参数 */
const rawPlatform = readStringOption("platform", options.platform);

if (rawPlatform && !isPlatform(rawPlatform)) {
  throw new Error(
    `暂不支持平台：${rawPlatform}\n可选值：mp-weixin、mp-alipay、mp-baidu、mp-jd、mp-toutiao`,
  );
}

if (operations.length > 0 && !rawPlatform) {
  throw new Error(
    "请指定平台，可选值：mp-weixin、mp-alipay、mp-baidu、mp-jd、mp-toutiao\n用法：minici --<operation> --platform <platform>",
  );
}

/** 已解析的 CLI 参数 */
const cliArgs: ParsedCliArgs = {
  operations,
};

if (bump) {
  cliArgs.bump = true;
}

if (rawPlatform) {
  cliArgs.platform = rawPlatform;
}
```

- [ ] **Step 6: 修改 Vite plugin parser 实现**

在 `packages/vite-plugin/src/parsePluginArgs.ts` 中：

1. 接口改为：

```ts
/** Vite 插件参数解析结果 */
export interface ParsedPluginArgs {
  /** 当前操作列表；空数组表示没有 CI action */
  operations: MiniCIOperation[];
  /** 是否执行 bumpp 版本更新 */
  bump?: boolean;
}
```

2. `allowedOptionNames` 改为：

```ts
/** Vite 插件模式支持的参数名 */
const allowedOptionNames = new Set(["open", "preview", "upload", "bump"]);
```

3. `minimist()` boolean 配置改为：

```ts
boolean: [...supportedOperations, "bump"],
```

4. 解析返回逻辑改为：

```ts
/** 已传入操作列表 */
const operations = supportedOperations.filter((operation) => options[operation] === true);
/** 是否执行 bumpp 版本更新 */
const bump = options.bump === true;

if (bump && operations.length > 0 && !operations.includes("upload")) {
  throw new Error("bump 搭配 CI 操作时必须包含 upload");
}

if (operations.length === 0 && !bump) {
  return { operations: [] };
}

return {
  operations,
  ...(bump && { bump: true }),
};
```

- [ ] **Step 7: 运行 parser 测试确认通过**

Run:

```bash
pnpm exec vitest run packages/cli/tests/command.test.ts packages/vite-plugin/tests/plugin-args.test.ts
```

Expected: PASS。

- [ ] **Step 8: 提交参数解析改动**

```bash
git add packages/core/src/types.ts packages/cli/src/command/parseArgs.ts packages/vite-plugin/src/parsePluginArgs.ts packages/cli/tests/command.test.ts packages/vite-plugin/tests/plugin-args.test.ts
git commit -m "feat(cli): parse bump flag"
```

---

### Task 2: 类型、配置 schema 与 bumpp 依赖

**Files:**
- Modify: `packages/core/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/config/schema.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/tests/config.test.ts`
- Test: `packages/cli/tests/index.test.ts`

- [ ] **Step 1: 写配置 schema 失败测试**

在 `packages/core/tests/config.test.ts` 的 `describe("config schema", () => { ... })` 中追加：

```ts
test("bumpOptions 接受普通对象配置", () => {
  expect(
    validateConfig({
      bumpOptions: {
        release: "patch",
        commit: false,
        tag: false,
        push: false,
        confirm: false,
      },
    }),
  ).toEqual({
    bumpOptions: {
      release: "patch",
      commit: false,
      tag: false,
      push: false,
      confirm: false,
    },
  });
});

test("bumpOptions 字段为非对象时会被拒绝", () => {
  expect(() =>
    validateConfig({
      bumpOptions: "patch",
    }),
  ).toThrow(/bumpOptions/);
});

test("bumpOptions 保留函数字段", () => {
  /** bumpp progress 回调 */
  const progress = () => {};
  /** bumpp execute 回调 */
  const execute = () => {};

  expect(
    validateConfig({
      bumpOptions: {
        progress,
        execute,
      },
    }),
  ).toEqual({
    bumpOptions: {
      progress,
      execute,
    },
  });
});
```

- [ ] **Step 2: 写 CLI 类型导出失败测试**

在 `packages/cli/tests/index.test.ts` 中追加类型断言：

```ts
import type { MiniCIActionResult, MiniCIBumpOnlyResult, MiniCIBumpResult } from "../src/index";

test("导出 bump 结果类型", () => {
  expectTypeOf<MiniCIBumpOnlyResult["bump"]>().toEqualTypeOf<MiniCIBumpResult>();
  expectTypeOf<MiniCIActionResult["results"][number]>().toHaveProperty("operation");
});
```

如果文件顶部已有 `expectTypeOf` import，只补类型 import 和测试体。

- [ ] **Step 3: 运行类型与 schema 测试确认失败**

Run:

```bash
pnpm exec vitest run packages/core/tests/config.test.ts packages/cli/tests/index.test.ts
```

Expected: FAIL，错误包含 `bumpOptions Unrecognized key` 或类型未导出。

- [ ] **Step 4: 增加 core 运行时依赖**

在 `packages/core/package.json` 的 `dependencies` 中加入：

```json
"bumpp": "^11.1.0",
```

保持字母排序不是硬要求，跟现有依赖块风格即可。

Run:

```bash
pnpm install --lockfile-only
```

Expected: `pnpm-lock.yaml` 中 `packages/core` importer 出现 `bumpp` 依赖，且不安装新 node_modules 内容。

- [ ] **Step 5: 修改 core 类型**

在 `packages/core/src/types.ts` 顶部添加：

```ts
import type { VersionBumpOptions } from "bumpp";
```

在 `MiniCIConfig` 中 `hooks` 后添加：

```ts
/** bumpp 程序化 API 参数 */
bumpOptions?: VersionBumpOptions;
```

把当前 `MiniCIResult` 替换为：

```ts
/** bumpp 执行结果 */
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

/** 只执行 bump 时的返回值 */
export interface MiniCIBumpOnlyResult {
  /** 是否执行成功 */
  success: true;
  /** bump-only 没有 CI action */
  operations: [];
  /** bump 执行结果 */
  bump: MiniCIBumpResult;
}

/** 执行 CI action 时的返回值 */
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

/** minici 执行聚合结果 */
export type MiniCIResult = MiniCIBumpOnlyResult | MiniCIActionResult;
```

- [ ] **Step 6: 修改配置 schema**

在 `packages/core/src/config/schema.ts` 中导入类型：

```ts
import type { VersionBumpOptions } from "bumpp";
```

在 `hooksSchema` 后添加：

```ts
/** bumpp 配置 schema */
const bumpOptionsSchema = z
  .custom<VersionBumpOptions>(
    (value) => typeof value === "object" && value !== null && !Array.isArray(value),
    "bumpOptions 必须是对象",
  )
  .optional();
```

在 `miniciConfigSchema` 中 `hooks: hooksSchema,` 后添加：

```ts
/** bumpp 程序化 API 参数 */
bumpOptions: bumpOptionsSchema,
```

- [ ] **Step 7: 导出新类型**

在 `packages/core/src/index.ts` 的类型导出列表中增加：

```ts
type MiniCIActionResult,
type MiniCIBumpOnlyResult,
type MiniCIBumpResult,
```

在 `packages/cli/src/index.ts` 从 `uni-mini-ci-core` 的 re-export 类型列表中同步增加：

```ts
type MiniCIActionResult,
type MiniCIBumpOnlyResult,
type MiniCIBumpResult,
```

- [ ] **Step 8: 运行测试和类型检查**

Run:

```bash
pnpm exec vitest run packages/core/tests/config.test.ts packages/cli/tests/index.test.ts
pnpm run typecheck
```

Expected: PASS。

- [ ] **Step 9: 提交类型和依赖改动**

```bash
git add packages/core/package.json pnpm-lock.yaml packages/core/src/types.ts packages/core/src/config/schema.ts packages/core/src/index.ts packages/cli/src/index.ts packages/core/tests/config.test.ts packages/cli/tests/index.test.ts
git commit -m "feat(core): add bump config types"
```

---

### Task 3: core 封装 bumpp 前置阶段

**Files:**
- Create: `packages/core/src/bump/runBump.ts`
- Modify: `packages/core/src/runMiniCIWithConfig.ts`
- Test: `packages/core/tests/bump.test.ts`

- [ ] **Step 1: 写 runBump 失败测试**

创建 `packages/core/tests/bump.test.ts`：

```ts
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { runMiniCIWithConfig } from "../src/runMiniCIWithConfig";
import { runBump } from "../src/bump/runBump";

/** bumpp versionBump mock */
const versionBump = vi.fn();
/** 临时目录列表 */
const tempDirs: string[] = [];

vi.mock("bumpp", () => ({
  versionBump: (options: unknown) => versionBump(options),
}));

/**
 * 创建 bump 测试项目。
 *
 * @returns 临时项目目录
 */
async function createProject(): Promise<string> {
  /** 临时项目目录 */
  const cwd = await mkdtemp(path.join(os.tmpdir(), "minici-bump-"));
  tempDirs.push(cwd);
  await writeFile(path.join(cwd, "package.json"), JSON.stringify({ version: "1.0.0" }));
  return cwd;
}

afterEach(async () => {
  versionBump.mockReset();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("runBump", () => {
  test("默认禁用 commit tag push 并强制使用传入 cwd", async () => {
    versionBump.mockResolvedValue({
      currentVersion: "1.0.0",
      newVersion: "1.0.1",
      commit: false,
      tag: false,
      updatedFiles: ["package.json"],
      skippedFiles: [],
    });

    const result = await runBump({
      cwd: "/repo",
      bumpOptions: {
        release: "patch",
      },
    });

    expect(versionBump).toHaveBeenCalledWith({
      commit: false,
      tag: false,
      push: false,
      release: "patch",
      cwd: "/repo",
    });
    expect(result).toEqual({
      success: true,
      currentVersion: "1.0.0",
      newVersion: "1.0.1",
      commit: false,
      tag: false,
      updatedFiles: ["package.json"],
      skippedFiles: [],
    });
  });

  test("用户配置可以覆盖 commit tag push 默认值但不能覆盖 cwd", async () => {
    versionBump.mockResolvedValue({
      currentVersion: "1.0.0",
      newVersion: "1.1.0",
      commit: "release v1.1.0",
      tag: "v1.1.0",
      updatedFiles: ["package.json"],
      skippedFiles: [],
    });

    await runBump({
      cwd: "/repo",
      bumpOptions: {
        release: "minor",
        commit: true,
        tag: true,
        push: true,
        cwd: "/other",
      },
    });

    expect(versionBump).toHaveBeenCalledWith({
      commit: true,
      tag: true,
      push: true,
      release: "minor",
      cwd: "/repo",
    });
  });
});
```

- [ ] **Step 2: 运行 runBump 测试确认失败**

Run:

```bash
pnpm exec vitest run packages/core/tests/bump.test.ts
```

Expected: FAIL，错误包含 `Cannot find module '../src/bump/runBump'`。

- [ ] **Step 3: 创建 runBump 实现**

创建 `packages/core/src/bump/runBump.ts`：

```ts
import { versionBump } from "bumpp";

import type { MiniCIBumpResult, MiniCIConfig } from "../types";

/** 执行 bumpp 的选项 */
export interface RunBumpOptions {
  /** 当前工作目录 */
  cwd: string;
  /** 用户配置的 bumpp 选项 */
  bumpOptions?: MiniCIConfig["bumpOptions"];
}

/**
 * 执行 bumpp 版本更新。
 *
 * @param options bumpp 执行选项
 * @returns minici 归一化后的 bump 结果
 */
export async function runBump(options: RunBumpOptions): Promise<MiniCIBumpResult> {
  /** bumpp 原始执行结果 */
  const result = await versionBump({
    commit: false,
    tag: false,
    push: false,
    ...options.bumpOptions,
    cwd: options.cwd,
  });

  return {
    success: true,
    currentVersion: result.currentVersion,
    newVersion: result.newVersion,
    commit: result.commit,
    tag: result.tag,
    updatedFiles: result.updatedFiles,
    skippedFiles: result.skippedFiles,
  };
}
```

- [ ] **Step 4: 写 runner bump-only 失败测试**

在 `packages/core/tests/bump.test.ts` 中追加：

```ts
test("bump-only 不要求平台配置并返回 bump-only 结果", async () => {
  const cwd = await createProject();
  versionBump.mockResolvedValue({
    currentVersion: "1.0.0",
    newVersion: "1.0.1",
    commit: false,
    tag: false,
    updatedFiles: ["package.json"],
    skippedFiles: [],
  });

  const result = await runMiniCIWithConfig({
    args: {
      operations: [],
      bump: true,
    },
    cwd,
    config: {
      bumpOptions: {
        release: "patch",
        confirm: false,
      },
    },
  });

  expect(result).toEqual({
    success: true,
    operations: [],
    bump: {
      success: true,
      currentVersion: "1.0.0",
      newVersion: "1.0.1",
      commit: false,
      tag: false,
      updatedFiles: ["package.json"],
      skippedFiles: [],
    },
  });
});

test("bump 搭配 action 但不含 upload 时不调用 bumpp", async () => {
  const cwd = await createProject();

  await expect(
    runMiniCIWithConfig({
      args: {
        operations: ["preview"],
        bump: true,
        platform: "mp-weixin",
      },
      cwd,
      config: {},
    }),
  ).rejects.toThrow("bump 搭配 CI 操作时必须包含 upload");

  expect(versionBump).not.toHaveBeenCalled();
});
```

- [ ] **Step 5: 修改 runner 基础类型和校验**

在 `packages/core/src/runMiniCIWithConfig.ts` 中：

1. import `runBump`：

```ts
import { runBump } from "./bump/runBump";
```

2. type import 增加 `MiniCIActionResult`、`MiniCIBumpResult`。

3. 把 `const results: MiniCIResult["results"] = [];` 改为：

```ts
const results: MiniCIActionResult["results"] = [];
```

4. 在 `operationMessages` 后添加：

```ts
/**
 * 校验共享 runner 入参。
 *
 * @param options 共享执行入口选项
 */
function assertRunArgs(options: RunMiniCIWithConfigOptions): void {
  if (options.args.operations.length === 0 && !options.args.bump) {
    throw new Error("请指定操作");
  }

  if (
    options.args.bump &&
    options.args.operations.length > 0 &&
    !options.args.operations.includes("upload")
  ) {
    throw new Error("bump 搭配 CI 操作时必须包含 upload");
  }

  if (options.args.operations.length > 0 && !options.args.platform) {
    throw new Error("请指定平台");
  }
}
```

5. 修改 `logFailure` 入参，增加 stage：

```ts
function logFailure(input: {
  logger: ReturnType<typeof createLogger>;
  error: Error;
  stage?: string;
  operation?: MiniCIOperation;
  platform?: RunMiniCIWithConfigOptions["args"]["platform"];
}): void {
  input.logger.error("执行失败");

  if (input.stage) {
    input.logger.detail("stage", input.stage);
  }

  if (input.operation) {
    input.logger.detail("operation", input.operation);
  }

  if (input.platform) {
    input.logger.detail("platform", input.platform);
  }

  input.logger.detail("error", input.error.message);
  markErrorLogged(input.error);
}
```

- [ ] **Step 6: 修改 runner 执行流**

在 `runMiniCIWithConfig()` 开头改为：

```ts
export async function runMiniCIWithConfig(
  options: RunMiniCIWithConfigOptions,
): Promise<MiniCIResult> {
  assertRunArgs(options);

  const logger = createLogger();
  let packageJson = await loadPackageJson(options.cwd);
  const results: MiniCIActionResult["results"] = [];
  let didPrintHeader = false;
  let bumpResult: MiniCIBumpResult | undefined;

  if (options.args.bump) {
    logger.group("bump", "更新版本号");

    try {
      bumpResult = await runBump({
        cwd: options.cwd,
        bumpOptions: options.config.bumpOptions,
      });
      logger.detail("currentVersion", bumpResult.currentVersion);
      logger.detail("newVersion", bumpResult.newVersion);
      logger.detail("updatedFiles", bumpResult.updatedFiles.join(", ") || "-");
      logger.detail("commit", bumpResult.commit || "false");
      logger.detail("tag", bumpResult.tag || "false");
      packageJson = await loadPackageJson(options.cwd);
    } catch (error) {
      /** bump 执行错误 */
      const bumpError = toError(error);
      logFailure({
        logger,
        error: bumpError,
        stage: "bump",
        platform: options.args.platform,
      });
      await triggerErrorHook(
        options,
        createErrorHookData({
          error: bumpError,
          platform: options.args.platform,
        }),
      );
      throw bumpError;
    }

    if (options.args.operations.length === 0) {
      logger.success("完成", "版本更新成功");
      return {
        success: true,
        operations: [],
        bump: bumpResult,
      };
    }
  }

  /** bump 后注入新版本的运行参数 */
  const runtimeArgs = bumpResult
    ? {
        ...options.args,
        version: bumpResult.newVersion,
      }
    : options.args;
```

在后续循环中把 `options.args.operations` 替换为 `runtimeArgs.operations`，把 `...options.args` 替换为 `...runtimeArgs`，把 `options.args.platform` 替换为 `runtimeArgs.platform`。

返回对象增加 bump 字段：

```ts
return {
  success: results.every((result) => result.success),
  operations: runtimeArgs.operations,
  platform: firstResult.platform,
  version: firstResult.version,
  desc: firstResult.desc,
  projectPath: firstResult.projectPath,
  ...(bumpResult && { bump: bumpResult }),
  results,
};
```

- [ ] **Step 7: 写 bump 错误 hook 与日志测试**

在 `packages/core/tests/bump.test.ts` 中追加：

```ts
test("bump 失败时触发 onError 且 operation 为空", async () => {
  const cwd = await createProject();
  /** 错误 hook */
  const onError = vi.fn();
  versionBump.mockRejectedValue(new Error("bump failed"));

  await expect(
    runMiniCIWithConfig({
      args: {
        operations: ["upload"],
        bump: true,
        platform: "mp-weixin",
      },
      cwd,
      config: {
        hooks: {
          onError,
        },
        "mp-weixin": {
          appid: "wx-appid",
          privateKeyPath: "key/private.key",
        },
      },
    }),
  ).rejects.toThrow("bump failed");

  expect(onError).toHaveBeenCalledWith({
    platform: "mp-weixin",
    error: expect.any(Error),
    data: expect.objectContaining({
      platform: "mp-weixin",
    }),
  });
});
```

- [ ] **Step 8: 运行 core bump 测试**

Run:

```bash
pnpm exec vitest run packages/core/tests/bump.test.ts
pnpm run typecheck
```

Expected: PASS。

- [ ] **Step 9: 提交 core bump 前置阶段**

```bash
git add packages/core/src/bump/runBump.ts packages/core/src/runMiniCIWithConfig.ts packages/core/tests/bump.test.ts
git commit -m "feat(core): run bumpp before ci actions"
```

---

### Task 4: CLI runner 覆盖 bump-only 和 bump + upload

**Files:**
- Modify: `packages/cli/src/cli.ts`
- Modify: `packages/cli/tests/runner.test.ts`
- Test: `packages/cli/tests/runner.test.ts`

- [ ] **Step 1: 写 CLI runner 失败测试**

在 `packages/cli/tests/runner.test.ts` 顶部 mock bumpp：

```ts
/** bumpp versionBump mock */
const versionBump = vi.fn();

vi.mock("bumpp", () => ({
  versionBump: (options: unknown) => versionBump(options),
}));
```

在 `afterEach` 中增加：

```ts
versionBump.mockReset();
```

追加测试：

```ts
test("CLI bump-only 不执行 CI action", async () => {
  const cwd = await createProjectDir();
  versionBump.mockResolvedValue({
    currentVersion: "1.0.0",
    newVersion: "1.0.1",
    commit: false,
    tag: false,
    updatedFiles: ["package.json"],
    skippedFiles: [],
  });

  const { runMiniCI } = await import("../src/index");
  const result = await runMiniCI({
    argv: ["--bump"],
    cwd,
  });

  expect(calls).toEqual([]);
  expect(result).toEqual({
    success: true,
    operations: [],
    bump: expect.objectContaining({
      currentVersion: "1.0.0",
      newVersion: "1.0.1",
    }),
  });
});

test("CLI bump 加 upload 时使用 newVersion 执行 CI", async () => {
  const cwd = await createProjectDir();
  versionBump.mockResolvedValue({
    currentVersion: "1.0.0",
    newVersion: "1.0.1",
    commit: false,
    tag: false,
    updatedFiles: ["package.json"],
    skippedFiles: [],
  });

  const { runMiniCI } = await import("../src/index");
  const result = await runMiniCI({
    argv: ["--bump", "--upload", "--platform", "mp-weixin", "--version", "9.9.9"],
    cwd,
  });

  expect(calls).toEqual([{ method: "upload" }]);
  expect(result.operations).toEqual(["upload"]);
  expect(result.version).toBe("1.0.1");
  expect(result.results[0]?.version).toBe("1.0.1");
});
```

- [ ] **Step 2: 运行 CLI runner 测试**

Run:

```bash
pnpm exec vitest run packages/cli/tests/runner.test.ts
```

Expected: PASS。

- [ ] **Step 3: 更新 CLI help 文案**

在 `packages/cli/src/cli.ts` 的 `HELP_TEXT` 操作和选项区增加：

```txt
  --bump       使用 bumpp 更新版本号
```

示例区增加：

```txt
  minici --bump
  minici --bump --upload --platform mp-weixin
```

- [ ] **Step 4: 运行 CLI 相关测试**

Run:

```bash
pnpm exec vitest run packages/cli/tests/command.test.ts packages/cli/tests/runner.test.ts packages/cli/tests/cli.test.ts
pnpm run typecheck
```

Expected: PASS。

- [ ] **Step 5: 提交 CLI runner 改动**

```bash
git add packages/cli/src/cli.ts packages/cli/tests/runner.test.ts
git commit -m "feat(cli): support bump-only runner"
```

---

### Task 5: Vite 插件执行 `--bump`

**Files:**
- Modify: `packages/vite-plugin/src/uniMiniCI.ts`
- Modify: `packages/vite-plugin/tests/plugin.test.ts`

- [ ] **Step 1: 写 Vite 插件失败测试**

在 `packages/vite-plugin/tests/plugin.test.ts` 顶部 mock bumpp：

```ts
/** bumpp versionBump mock */
const versionBump = vi.fn();

vi.mock("bumpp", () => ({
  versionBump: (options: unknown) => versionBump(options),
}));
```

在 `afterEach` 中增加：

```ts
versionBump.mockReset();
```

追加测试：

```ts
test("build 模式执行 bump-only", async () => {
  const { cwd, outputDir } = await createProject("build");
  process.argv = ["node", "uni", "build", "-p", "mp-weixin", "--", "--bump"];
  process.env.UNI_PLATFORM = "mp-weixin";
  process.env.UNI_OUTPUT_DIR = outputDir;
  versionBump.mockResolvedValue({
    currentVersion: "1.0.0",
    newVersion: "1.0.1",
    commit: false,
    tag: false,
    updatedFiles: ["package.json"],
    skippedFiles: [],
  });

  const plugin = uniMiniCI({
    bumpOptions: {
      release: "patch",
      confirm: false,
    },
  });

  await runBuildPlugin(plugin, cwd);

  expect(versionBump).toHaveBeenCalled();
  expect(calls).toEqual([]);
});

test("serve 模式拒绝 bump-only", async () => {
  const { cwd, outputDir } = await createProject("serve");
  process.argv = ["node", "uni", "dev", "-p", "mp-weixin", "--", "--bump"];
  process.env.UNI_PLATFORM = "mp-weixin";
  process.env.UNI_OUTPUT_DIR = outputDir;

  const plugin = uniMiniCI({
    bumpOptions: {
      release: "patch",
    },
  });

  await expect(runServePlugin(plugin, cwd)).rejects.toThrow("bump 只支持 build 模式");
  expect(versionBump).not.toHaveBeenCalled();
});

test("h5 平台传入 bump 时跳过全部插件动作", async () => {
  const { cwd, outputDir } = await createProject("build");
  process.argv = ["node", "uni", "build", "--", "--bump"];
  process.env.UNI_PLATFORM = "h5";
  process.env.UNI_OUTPUT_DIR = outputDir;

  const plugin = uniMiniCI({
    bumpOptions: {
      release: "patch",
    },
  });

  await runBuildPlugin(plugin, cwd);

  expect(versionBump).not.toHaveBeenCalled();
  expect(calls).toEqual([]);
});

test("build 模式 bump 加 upload 时先 bump 后 upload", async () => {
  const { cwd, outputDir } = await createProject("build");
  process.argv = ["node", "uni", "build", "-p", "mp-weixin", "--", "--bump", "--upload"];
  process.env.UNI_PLATFORM = "mp-weixin";
  process.env.UNI_OUTPUT_DIR = outputDir;
  versionBump.mockResolvedValue({
    currentVersion: "1.0.0",
    newVersion: "1.0.1",
    commit: false,
    tag: false,
    updatedFiles: ["package.json"],
    skippedFiles: [],
  });

  const plugin = uniMiniCI({
    desc: "插件描述",
    bumpOptions: {
      release: "patch",
      confirm: false,
    },
    "mp-weixin": {
      appid: "wx-appid",
      privateKeyPath: "key/private.key",
    },
  });

  await runBuildPlugin(plugin, cwd);

  expect(versionBump).toHaveBeenCalled();
  expect(calls).toEqual([{ method: "upload", projectPath: outputDir, platform: "mp-weixin" }]);
});
```

- [ ] **Step 2: 运行插件测试确认失败**

Run:

```bash
pnpm exec vitest run packages/vite-plugin/tests/plugin-args.test.ts packages/vite-plugin/tests/plugin.test.ts
```

Expected: FAIL，错误包含 bump-only 路径仍尝试读取 `UNI_PLATFORM` 或 serve 模式未报 `bump 只支持 build 模式`。

- [ ] **Step 3: 修改插件执行流**

在 `packages/vite-plugin/src/uniMiniCI.ts` 的 `runPluginOperation()` 中，将 action 判断后的流程调整为：

```ts
/** 插件透传参数 */
const pluginArgs = parsePluginArgs(process.argv);

if (pluginArgs.operations.length === 0 && !pluginArgs.bump) {
  return;
}

// h5 等非小程序平台无需执行插件动作，直接跳过
const rawPlatform = process.env.UNI_PLATFORM;
if (rawPlatform && !isPlatform(rawPlatform)) {
  return;
}

/** 是否为开发模式（NODE_ENV=development 或 serve 命令） */
const isDev = resolvedConfig?.command === "serve" || process.env.NODE_ENV === "development";

if (isDev && pluginArgs.bump) {
  throw new Error("bump 只支持 build 模式");
}

if (isDev && pluginArgs.operations.includes("upload")) {
  throw new Error("upload 只支持 build 模式");
}

if (pluginArgs.operations.length === 0) {
  await runMiniCIWithConfig({
    args: {
      operations: [],
      ...(pluginArgs.bump && { bump: true }),
    },
    cwd: resolvedConfig?.root || process.cwd(),
    config: options,
  });
  return;
}

/** 当前平台 */
const platform = readUniPlatform();
/** 项目产物目录 */
const projectPath = readProjectPath(options);

await runMiniCIWithConfig({
  args: {
    operations: pluginArgs.operations,
    ...(pluginArgs.bump && { bump: true }),
    platform,
    projectPath,
  },
  cwd: resolvedConfig?.root || process.cwd(),
  config: options,
});
```

- [ ] **Step 4: 运行插件测试确认通过**

Run:

```bash
pnpm exec vitest run packages/vite-plugin/tests/plugin-args.test.ts packages/vite-plugin/tests/plugin.test.ts
pnpm run typecheck
```

Expected: PASS。

- [ ] **Step 5: 提交 Vite 插件改动**

```bash
git add packages/vite-plugin/src/uniMiniCI.ts packages/vite-plugin/tests/plugin.test.ts
git commit -m "feat(vite-plugin): support bump flag"
```

---

### Task 6: 文档同步

**Files:**
- Modify: `README.md`
- Modify: `docs/cli.md`
- Modify: `docs/vite-plugin.md`

- [ ] **Step 1: 更新 README 配置表和示例**

在 `README.md` 的配置表中新增：

```md
| `bumpOptions` | `VersionBumpOptions`        | bumpp 程序化 API 参数。mini-ci 默认 `commit` 为 `true`、`tag/push` 为 `false`，可在此显式覆盖 |
```

在 CLI 示例附近新增：

````md
### 版本更新

`--bump` 会在 CI action 前调用 bumpp 更新版本号。单独执行时不需要指定平台：

```bash
minici --bump
```

如果 `--bump` 搭配 CI action，必须包含 `--upload`：

```bash
minici --bump --upload --platform mp-weixin
minici --bump --preview --upload --platform mp-weixin
```
````

在配置示例中新增：

```ts
bumpOptions: {
  release: "patch",
  commit: false,
  tag: false,
  push: false,
  confirm: false,
},
```

- [ ] **Step 2: 更新 docs/cli.md**

在 `docs/cli.md` 的 CLI 参数表中新增：

```md
| `--bump`                | 使用 bumpp 更新版本号。可单独执行；搭配 CI action 时必须包含 `--upload` |
```

在配置说明中新增：

```md
### bumpOptions

`bumpOptions` 复用 bumpp 的 `VersionBumpOptions`。文档只列出常用字段：

| 字段 | 说明 |
| --- | --- |
| `release` | 发布类型或明确版本号，例如 `patch`、`minor`、`major`、`1.2.3` |
| `commit` | 是否创建 git commit。mini-ci 默认 `false` |
| `tag` | 是否创建 git tag。mini-ci 默认 `false` |
| `push` | 是否推送 commit 和 tag。mini-ci 默认 `false` |
| `confirm` | 是否让 bumpp 执行确认提示 |
```

- [ ] **Step 3: 更新 docs/vite-plugin.md**

在 `docs/vite-plugin.md` 的透传参数说明中新增：

```md
| `--bump` | 使用 bumpp 更新版本号。只支持 build 模式；非小程序平台会跳过 |
```

新增规则说明：

````md
`--bump` 可以单独使用：

```bash
uni build -p mp-weixin -- --bump
```

`--bump` 搭配 CI action 时必须包含 `--upload`：

```bash
uni build -p mp-weixin -- --bump --upload
```

serve 模式不支持 bump：

```bash
uni dev -p mp-weixin -- --bump
```
````

- [ ] **Step 4: 运行文档相关检查**

Run:

```bash
pnpm run fmt:check
```

Expected: PASS。若 Markdown 表格被格式化工具要求调整，Run `pnpm run fmt` 后复查 diff。

- [ ] **Step 5: 提交文档改动**

```bash
git add README.md docs/cli.md docs/vite-plugin.md
git commit -m "docs: document bump flag"
```

---

### Task 7: 全量验证与收尾

**Files:**
- Verify only.

- [ ] **Step 1: 运行核心测试**

Run:

```bash
pnpm run test
```

Expected: PASS。

- [ ] **Step 2: 运行类型检查**

Run:

```bash
pnpm run typecheck
pnpm run typecheck:test
```

Expected: PASS。

- [ ] **Step 3: 运行 lint 和格式检查**

Run:

```bash
pnpm run lint
pnpm run fmt:check
```

Expected: PASS。

- [ ] **Step 4: 运行构建**

Run:

```bash
pnpm run build
```

Expected: PASS，各包 `dist` 生成成功。不要手动编辑任何 `.d.ts` 或 `.d.ts.map` 产物。

- [ ] **Step 5: 检查公开导出**

Run:

```bash
pnpm exec tsc --noEmit -p packages/cli/tsconfig.test.json
pnpm exec tsc --noEmit -p packages/vite-plugin/tsconfig.test.json
```

Expected: PASS，`MiniCIConfig.bumpOptions`、`MiniCIBumpOnlyResult`、`MiniCIActionResult` 类型可被测试侧引用。

- [ ] **Step 6: 检查工作区 diff**

Run:

```bash
git status --short
git diff --stat
```

Expected: 只包含本计划范围内的源码、测试、文档、manifest 和 lockfile 改动。

- [ ] **Step 7: 提交最终验证记录**

如果前面每个任务都已按计划提交，本步骤不新增提交。在最终回复中报告这些命令结果：

```txt
pnpm run test
pnpm run typecheck
pnpm run typecheck:test
pnpm run lint
pnpm run fmt:check
pnpm run build
```
