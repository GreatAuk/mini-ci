# Log Output Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 优化默认日志输出，让 CLI、共享 runner 和平台适配器日志通过统一 logger 呈现为彩色分组块。

**Architecture:** `uni-mini-ci-core` 提供 logger 原语、错误已记录标记和导出；`runMiniCIWithConfig()` 负责整体和 operation 分组日志；平台 CI 适配器只输出平台动作细节；CLI 顶层只处理 help/version 与未被 core 记录过的早期错误。日志展示不进入 `MiniCIConfig`，不新增用户配置项。

**Tech Stack:** TypeScript ESM, Vitest, picocolors, pnpm, Turbo, oxlint, oxfmt.

---

## File Structure

- Modify: `packages/core/src/runtime/logger.ts`  
  统一 logger 接口、彩色分组输出、错误记录标记。
- Modify: `packages/core/src/index.ts`  
  导出 `createLogger`、`Logger`、`isErrorLogged`。
- Modify: `packages/core/src/ci/BaseCI.ts`  
  持有 logger，并给平台适配器使用。
- Modify: `packages/core/src/ci/registry.ts`  
  让 `createCI(config, logger)` 把 logger 传入平台 CI。
- Modify: `packages/core/src/runMiniCIWithConfig.ts`  
  输出整体运行头、operation 分组、成功摘要和失败摘要。
- Modify: `packages/core/src/ci/WeappCI.ts`  
  把直接 `console.*` 替换为 `this.logger.*`。
- Modify: `packages/core/src/ci/AlipayCI.ts`  
  把直接 `console.*` 替换为 `this.logger.*`。
- Modify: `packages/core/src/ci/SwanCI.ts`  
  把直接 `console.*` 替换为 `this.logger.*`。
- Modify: `packages/core/src/ci/TTCI.ts`  
  把直接 `console.*` 替换为 `this.logger.*`。
- Modify: `packages/core/src/ci/JdCI.ts`  
  把直接 `console.*` 替换为 `this.logger.*`。
- Modify: `packages/cli/src/index.ts`  
  从 core 转导 logger 能力。
- Modify: `packages/cli/src/cli.ts`  
  CLI catch 使用 logger 输出早期错误，help/version 保持原始输出。
- Test: `packages/core/tests/runtime.test.ts`  
  覆盖 logger 格式、分组、辅助信息和错误标记。
- Test: `packages/core/tests/hooks.test.ts`  
  覆盖 runner 多 operation 日志和错误日志，同时确认 hook 顺序不变。
- Test: `packages/cli/tests/cli.test.ts`  
  覆盖 help/version 原始输出、早期参数错误、core 已记录错误不重复输出。

## Task 1: Core Logger

**Files:**
- Modify: `packages/core/src/runtime/logger.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/tests/runtime.test.ts`

- [ ] **Step 1: Write failing logger tests**

Update the Vitest import in `packages/core/tests/runtime.test.ts`:

```ts
import { afterEach, describe, expect, test, vi } from "vitest";
```

Add these tests to the same file:

```ts
import { createLogger, isErrorLogged, markErrorLogged } from "../src/runtime/logger";

/**
 * 移除 ANSI 颜色控制字符。
 *
 * @param value 待处理文本
 * @returns 无颜色控制字符的文本
 */
function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-9;]*m/g, "");
}

describe("createLogger", () => {
  test("输出分组块和缩进状态行", () => {
    /** console.log mock */
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    /** 默认 logger */
    const logger = createLogger();

    logger.header("minici", "mp-weixin · 1.0.0");
    logger.detail("projectPath", "dist/build/mp-weixin");
    logger.blank();
    logger.group("preview", "上传开发版并生成预览码");
    logger.success("开发版上传成功", "10:24:12");
    logger.detail("qr", "https://example.com/preview");

    expect(log.mock.calls.map(([line]) => stripAnsi(String(line)))).toEqual([
      "● minici mp-weixin · 1.0.0",
      "  projectPath dist/build/mp-weixin",
      "",
      "◇ preview 上传开发版并生成预览码",
      "  ✓ 开发版上传成功 10:24:12",
      "  qr https://example.com/preview",
    ]);

    log.mockRestore();
  });

  test("输出警告和错误语义", () => {
    /** console.log mock */
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    /** 默认 logger */
    const logger = createLogger();

    logger.warn("版本号低于最新上传版本", "1.0.0 <= 1.0.1");
    logger.error("执行失败");
    logger.detail("error", "preview failed");

    expect(log.mock.calls.map(([line]) => stripAnsi(String(line)))).toEqual([
      "  ! 版本号低于最新上传版本 1.0.0 <= 1.0.1",
      "✕ 执行失败",
      "  error preview failed",
    ]);

    log.mockRestore();
  });

  test("标记已记录错误，避免 CLI 重复输出", () => {
    /** 测试错误对象 */
    const error = new Error("preview failed");

    expect(isErrorLogged(error)).toBe(false);
    markErrorLogged(error);
    expect(isErrorLogged(error)).toBe(true);
    expect(isErrorLogged("preview failed")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```bash
pnpm --filter uni-mini-ci-core test -- --run packages/core/tests/runtime.test.ts
```

Expected: FAIL because `header`、`detail`、`blank`、`group`、`markErrorLogged` are not implemented.

- [ ] **Step 3: Implement logger primitives**

Replace `packages/core/src/runtime/logger.ts` with:

```ts
import pc from "picocolors";

/** 错误已记录标记 */
const loggedErrorSymbol = Symbol.for("uni-mini-ci.logged-error");

/** 日志接口 */
export interface Logger {
  /** 输出整体运行头 */
  header(message: string, detail?: string): void;
  /** 输出 operation 分组 */
  group(message: string, detail?: string): void;
  /** 输出开始信息 */
  start(message: string, detail?: string): void;
  /** 输出普通信息 */
  info(message: string, detail?: string): void;
  /** 输出提醒信息 */
  remind(message: string, detail?: string): void;
  /** 输出辅助信息 */
  detail(label: string, value: string): void;
  /** 输出警告信息 */
  warn(message: string, detail?: string): void;
  /** 输出错误信息 */
  error(message: string, detail?: string): void;
  /** 输出成功信息 */
  success(message: string, detail?: string): void;
  /** 输出空行 */
  blank(): void;
}

/**
 * 拼接主消息和可选细节。
 *
 * @param message 主消息
 * @param detail 可选细节
 * @returns 完整文本
 */
function joinMessage(message: string, detail?: string): string {
  return detail ? `${message} ${detail}` : message;
}

/**
 * 输出日志行。
 *
 * @param line 日志文本
 */
function writeLine(line: string): void {
  console.log(line);
}

/**
 * 标记错误已经输出过日志。
 *
 * @param error 错误对象
 * @returns 原错误对象
 */
export function markErrorLogged(error: Error): Error {
  Object.defineProperty(error, loggedErrorSymbol, {
    value: true,
    configurable: true,
  });

  return error;
}

/**
 * 判断错误是否已经输出过日志。
 *
 * @param error 未知错误
 * @returns 是否已记录
 */
export function isErrorLogged(error: unknown): boolean {
  return error instanceof Error && (error as Error & { [loggedErrorSymbol]?: boolean })[
    loggedErrorSymbol
  ] === true;
}

/**
 * 创建带颜色和分组排版的日志实例。
 *
 * @returns Logger 实例
 */
export function createLogger(): Logger {
  return {
    header(message, detail) {
      writeLine(pc.cyan(`● ${joinMessage(message, detail)}`));
    },
    group(message, detail) {
      writeLine(pc.blue(`◇ ${joinMessage(message, detail)}`));
    },
    start(message, detail) {
      writeLine(`  ${pc.cyan("◇")} ${joinMessage(message, detail)}`);
    },
    info(message, detail) {
      writeLine(`  ${pc.blue("i")} ${joinMessage(message, detail)}`);
    },
    remind(message, detail) {
      writeLine(`  ${pc.blue("i")} ${joinMessage(message, detail)}`);
    },
    detail(label, value) {
      writeLine(`  ${pc.gray(label)} ${pc.gray(value)}`);
    },
    warn(message, detail) {
      writeLine(`  ${pc.yellow("!")} ${joinMessage(message, detail)}`);
    },
    error(message, detail) {
      writeLine(pc.red(`✕ ${joinMessage(message, detail)}`));
    },
    success(message, detail) {
      writeLine(`  ${pc.green("✓")} ${joinMessage(message, detail)}`);
    },
    blank() {
      writeLine("");
    },
  };
}
```

Update `packages/core/src/index.ts` exports:

```ts
export {
  createLogger,
  isErrorLogged,
  markErrorLogged,
  type Logger,
} from "./runtime/logger";
```

- [ ] **Step 4: Run the focused test and verify pass**

Run:

```bash
pnpm --filter uni-mini-ci-core test -- --run packages/core/tests/runtime.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/runtime/logger.ts packages/core/src/index.ts packages/core/tests/runtime.test.ts
git commit -m "feat(core): improve logger primitives"
```

## Task 2: Runner Log Flow

**Files:**
- Modify: `packages/core/src/ci/BaseCI.ts`
- Modify: `packages/core/src/ci/registry.ts`
- Modify: `packages/core/src/runMiniCIWithConfig.ts`
- Test: `packages/core/tests/hooks.test.ts`

- [ ] **Step 1: Write failing runner log tests**

Update the mocked `createCI` signature so the test proves logger is passed into platform CI:

```ts
vi.mock("../src/ci/registry", () => ({
  createCI: (config: any, logger: any) => ({
    init: vi.fn(),
    open: vi.fn().mockImplementation(() => {
      if (failingMethod === "open") {
        throw new Error("open failed");
      }
      calls.push("open");
      logger.success("打开开发者工具成功");

      return {
        success: true,
        operation: config.operation,
        platform: config.platform,
        version: config.version,
        desc: config.desc,
        projectPath: config.projectPath,
      };
    }),
    preview: vi.fn().mockImplementation(() => {
      if (failingMethod === "preview") {
        throw new Error("preview failed");
      }
      calls.push("preview");
      logger.success("开发版上传成功", "10:24:12");

      return {
        success: true,
        operation: config.operation,
        platform: config.platform,
        version: config.version,
        desc: config.desc,
        projectPath: config.projectPath,
        qrCodeContent: "preview-content",
        qrCodeLocalPath: "/repo/preview.png",
      };
    }),
    upload: vi.fn().mockImplementation(() => {
      if (failingMethod === "upload") {
        throw new Error("upload failed");
      }
      calls.push("upload");
      logger.success("体验版上传成功", "10:24:16");

      return {
        success: true,
        operation: config.operation,
        platform: config.platform,
        version: config.version,
        desc: config.desc,
        projectPath: config.projectPath,
        qrCodeContent: "upload-content",
        qrCodeLocalPath: "/repo/upload.png",
      };
    }),
  }),
}));
```

Add this helper and tests:

```ts
/**
 * 移除 ANSI 颜色控制字符。
 *
 * @param value 待处理文本
 * @returns 无颜色控制字符的文本
 */
function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-9;]*m/g, "");
}

test("多个操作输出整体头、operation 分组和成功摘要", async () => {
  /** console.log mock */
  const log = vi.spyOn(console, "log").mockImplementation(() => {});

  await runWithHooks(["preview", "upload"], {});

  const lines = log.mock.calls.map(([line]) => stripAnsi(String(line)));
  expect(lines).toContain("● minici mp-weixin · 1.0.0");
  expect(lines).toContain("  operations preview, upload");
  expect(lines).toContain("◇ preview 上传开发版并生成预览码");
  expect(lines).toContain("◇ upload 上传体验版并生成体验码");
  expect(lines).toContain("  ✓ 完成 2 个操作执行成功");

  log.mockRestore();
});

test("CI 方法失败时输出一次失败摘要并标记错误", async () => {
  /** console.log mock */
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  failingMethod = "preview";

  await expect(runWithHooks(["preview"], {})).rejects.toThrow("preview failed");

  const lines = log.mock.calls.map(([line]) => stripAnsi(String(line)));
  expect(lines).toContain("✕ 执行失败");
  expect(lines).toContain("  operation preview");
  expect(lines).toContain("  platform mp-weixin");
  expect(lines).toContain("  error preview failed");

  log.mockRestore();
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```bash
pnpm --filter uni-mini-ci-core test -- --run packages/core/tests/hooks.test.ts
```

Expected: FAIL because `createCI` does not receive logger and runner does not print grouped logs.

- [ ] **Step 3: Wire logger through BaseCI and registry**

Update `packages/core/src/ci/BaseCI.ts`:

```ts
import { createLogger } from "../runtime/logger";

import type { Logger } from "../runtime/logger";
import type { MiniCIPlatform, MiniCISingleResult, NormalizedMiniCIConfig } from "../types";

/** 平台 CI 基类 */
export abstract class BaseCI<P extends MiniCIPlatform = MiniCIPlatform> {
  /** 运行时配置 */
  protected config: NormalizedMiniCIConfig<P>;
  /** 日志实例 */
  protected logger: Logger;

  constructor(config: NormalizedMiniCIConfig<P>, logger: Logger = createLogger()) {
    this.config = config;
    this.logger = logger;
  }

  // 保留 createResult 和 abstract 方法不变
}
```

Update `packages/core/src/ci/registry.ts`:

```ts
import type { BaseCI } from "./BaseCI";
import type { Logger } from "../runtime/logger";
import type { MiniCIPlatform, NormalizedMiniCIConfig } from "../types";

const ciMap: Record<MiniCIPlatform, new (config: any, logger?: Logger) => BaseCI> = {
  "mp-weixin": WeappCI,
  "mp-alipay": AlipayCI,
  "mp-baidu": SwanCI,
  "mp-jd": JdCI,
  "mp-toutiao": TTCI,
};

export function createCI(config: NormalizedMiniCIConfig, logger?: Logger): BaseCI {
  const CI = ciMap[config.platform];
  return new CI(config, logger);
}
```

- [ ] **Step 4: Implement runner grouped logs**

In `packages/core/src/runMiniCIWithConfig.ts`, import logger helpers:

```ts
import { createLogger, markErrorLogged } from "./runtime/logger";
```

Add helper functions near `toError()`:

```ts
/** operation 展示文案 */
const operationMessages: Record<MiniCIOperation, string> = {
  open: "打开开发者工具",
  preview: "上传开发版并生成预览码",
  upload: "上传体验版并生成体验码",
};

/**
 * 输出错误摘要并标记错误。
 *
 * @param input 错误上下文
 */
function logFailure(input: {
  logger: ReturnType<typeof createLogger>;
  error: Error;
  operation?: MiniCIOperation;
  platform?: RunMiniCIWithConfigOptions["args"]["platform"];
}): void {
  input.logger.error("执行失败");

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

Inside `runMiniCIWithConfig()` create logger and print headers:

```ts
const logger = createLogger();
const packageJson = await loadPackageJson(options.cwd);
const results: MiniCIResult["results"] = [];
let didPrintHeader = false;

for (const operation of options.args.operations) {
  let normalized!: NormalizedMiniCIConfig;

  try {
    normalized = await normalizeConfig({
      args: {
        ...options.args,
        operation,
      },
      cwd: options.cwd,
      config: options.config,
      packageJson,
    });

    if (!didPrintHeader) {
      logger.header("minici", `${normalized.platform} · ${normalized.version}`);
      logger.detail("projectPath", normalized.projectPath);
      logger.detail("operations", options.args.operations.join(", "));
      didPrintHeader = true;
    }

    logger.blank();
    logger.group(operation, operationMessages[operation]);
  } catch (error) {
    const runtimeError = toError(error);
    logFailure({
      logger,
      error: runtimeError,
      operation,
      platform: options.args.platform,
    });
    await triggerErrorHook(
      options,
      createErrorHookData({
        error: runtimeError,
        operation,
        platform: options.args.platform,
      }),
    );
    throw runtimeError;
  }
```

Pass logger to `createCI`:

```ts
const ci = createCI(normalized, logger);
```

After `results.push(result);`, print operation result details:

```ts
if (result.qrCodeLocalPath) {
  logger.success("二维码已保存");
  logger.detail("path", result.qrCodeLocalPath);
}

if (result.qrCodeContent) {
  logger.detail("qr", result.qrCodeContent);
}
```

Before the final return, print summary:

```ts
logger.blank();
logger.success("完成", `${results.length} 个操作执行成功`);
```

In each catch path that rethrows a runtime, path, init, CI, complete hook, or hook error, call `logFailure(...)` exactly once for the error that will be thrown. Use the same operation and platform context already passed to `createErrorHookData()`.

- [ ] **Step 5: Run the focused test and verify pass**

Run:

```bash
pnpm --filter uni-mini-ci-core test -- --run packages/core/tests/hooks.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/ci/BaseCI.ts packages/core/src/ci/registry.ts packages/core/src/runMiniCIWithConfig.ts packages/core/tests/hooks.test.ts
git commit -m "feat(core): add grouped runner logs"
```

## Task 3: Platform Adapter Logs

**Files:**
- Modify: `packages/core/src/ci/WeappCI.ts`
- Modify: `packages/core/src/ci/AlipayCI.ts`
- Modify: `packages/core/src/ci/SwanCI.ts`
- Modify: `packages/core/src/ci/TTCI.ts`
- Modify: `packages/core/src/ci/JdCI.ts`
- Test: `packages/core/tests/ci-base.test.ts`

- [ ] **Step 1: Write failing adapter logger test**

Update the Vitest import in `packages/core/tests/ci-base.test.ts`:

```ts
import { describe, expect, test, vi } from "vitest";
```

Add imports in the same file:

```ts
import { JdCI } from "../src/ci/JdCI";
```

Add this helper and test to `packages/core/tests/ci-base.test.ts`:

```ts
/**
 * 创建测试用的京东归一化配置。
 *
 * @returns 京东平台归一化配置
 */
function createJdConfig(): NormalizedMiniCIConfig<"mp-jd"> {
  return {
    operation: "open",
    platform: "mp-jd",
    cwd: "/repo",
    projectPath: "/repo/dist/build/mp-jd",
    version: "1.0.0",
    desc: "测试描述",
    packageJson: {},
    platformConfig: {
      privateKey: "jd-private-key",
    },
  };
}

test("JdCI open 使用 logger 输出不支持警告", async () => {
  /** console.log mock */
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  /** console.warn mock */
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  /** 京东 CI 实例 */
  const ci = new JdCI(createJdConfig());

  await ci.open();

  expect(log.mock.calls.map(([line]) => String(line).replace(/\u001b\[[0-9;]*m/g, ""))).toContain(
    "  ! 京东小程序不支持 open 操作",
  );
  expect(warn).not.toHaveBeenCalled();

  log.mockRestore();
  warn.mockRestore();
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```bash
pnpm --filter uni-mini-ci-core test -- --run packages/core/tests/ci-base.test.ts
```

Expected: FAIL because `JdCI.open()` still writes `console.warn()` instead of logger warning.

- [ ] **Step 3: Replace WeappCI console output**

In `packages/core/src/ci/WeappCI.ts`, replace direct console output with logger calls:

```ts
this.logger.start("微信开发者工具", this.config.projectPath);
this.logger.start("上传开发版代码到微信后台并预览");
this.logger.success("开发版上传成功", `${new Date().toLocaleString()} ${extInfo}`);
this.logger.success("预览二维码已生成");
this.logger.detail("path", previewQrcodePath);
this.logger.detail("qr", qrContent);
this.logger.warn("获取预览二维码失败", error instanceof Error ? error.message : String(error));
this.logger.start("上传体验版代码到微信后台");
this.logger.detail("version", this.config.version);
this.logger.detail("desc", this.config.desc);
this.logger.success("上传成功", `${new Date().toLocaleString()} ${extInfo}`);
this.logger.success("体验版二维码已生成");
this.logger.detail("path", uploadQrcodePath);
this.logger.detail("qr", qrContent);
this.logger.warn("体验二维码生成失败", error instanceof Error ? error.message : String(error));
```

Keep `printQrcode2Terminal(qrContent)` unchanged.

Only call `this.logger.detail("qr", qrContent)` when `qrContent` is a string.

- [ ] **Step 4: Replace AlipayCI console output**

In `packages/core/src/ci/AlipayCI.ts`, replace direct console output with:

```ts
this.logger.start("小程序开发者工具", this.config.projectPath);
this.logger.success("预览版二维码已生成");
this.logger.detail("path", previewQrcodePath);
this.logger.detail("qr", qrcodeContent);
this.logger.start("上传代码到阿里小程序后台", clientType);
this.logger.warn(
  "上传版本号必须大于最新上传版本",
  `"${this.config.version}" <= "${lasterVersion}"`,
);
this.logger.success("体验版二维码已生成");
this.logger.detail("path", uploadQrcodePath);
this.logger.detail("qr", qrcodeContent);
```

Keep QR image reading, QR image generation, and `printQrcode2Terminal(qrcodeContent)` unchanged.

- [ ] **Step 5: Replace SwanCI console output**

In `packages/core/src/ci/SwanCI.ts`, replace direct console output with:

```ts
this.logger.start("百度开发者工具", this.config.projectPath);
this.logger.start("预览百度小程序");
this.logger.success("预览二维码已生成");
this.logger.detail("path", previewQrcodePath);
this.logger.detail("qr", qrContent);
this.logger.start("上传体验版代码到百度后台");
this.logger.detail("version", this.config.version);
this.logger.detail("desc", this.config.desc);
this.logger.success("体验版二维码已生成");
this.logger.detail("path", uploadQrcodePath);
this.logger.detail("qr", qrContent);
```

Keep shell command strings and reject behavior unchanged.

- [ ] **Step 6: Replace TTCI console output**

In `packages/core/src/ci/TTCI.ts`, replace direct console output with:

```ts
this.logger.start("启动抖音小程序开发者工具", this.config.projectPath);
this.logger.success("打开 IDE 成功");
this.logger.start("预览抖音小程序");
this.logger.success("开发版上传成功", new Date().toLocaleString());
this.logger.success("预览二维码已生成");
this.logger.detail("path", previewQrcodePath);
this.logger.detail("qr", qrContent);
this.logger.detail("expire", new Date(previewResult.expireTime * 1000).toLocaleString());
this.logger.start("上传代码到抖音开放平台后台");
this.logger.detail("version", this.config.version);
this.logger.detail("desc", this.config.desc);
this.logger.success("体验版上传成功", new Date().toLocaleString());
this.logger.success("体验版二维码已生成");
this.logger.detail("path", uploadQrcodePath);
this.logger.detail("qr", qrContent);
this.logger.detail("expire", new Date(uploadResult.expireTime * 1000).toLocaleString());
```

Keep login and SDK call behavior unchanged.

- [ ] **Step 7: Replace JdCI console output**

In `packages/core/src/ci/JdCI.ts`, replace direct console output with:

```ts
this.logger.warn("京东小程序不支持 open 操作");
this.logger.detail("version", this.config.version);
this.logger.detail("desc", this.config.desc);
this.logger.success("预览二维码已生成");
this.logger.detail("path", previewQrcodePath);
this.logger.detail("qr", qrcodeContent);
this.logger.success("体验版二维码已生成");
this.logger.detail("path", uploadQrcodePath);
this.logger.detail("qr", qrcodeContent);
```

Keep QR image generation and result creation unchanged.

- [ ] **Step 8: Run adapter tests and typecheck**

Run:

```bash
pnpm --filter uni-mini-ci-core test -- --run packages/core/tests/ci-base.test.ts
pnpm --filter uni-mini-ci-core typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/ci/WeappCI.ts packages/core/src/ci/AlipayCI.ts packages/core/src/ci/SwanCI.ts packages/core/src/ci/TTCI.ts packages/core/src/ci/JdCI.ts packages/core/tests/ci-base.test.ts
git commit -m "feat(core): unify platform ci logs"
```

## Task 4: CLI Top-Level Output

**Files:**
- Modify: `packages/cli/src/index.ts`
- Modify: `packages/cli/src/cli.ts`
- Create: `packages/cli/tests/cli.test.ts`

- [ ] **Step 1: Write failing CLI tests**

Create `packages/cli/tests/cli.test.ts`:

```ts
import { afterEach, describe, expect, test, vi } from "vitest";

/** runMiniCI mock */
const runMiniCIMock = vi.fn();

vi.mock("../src/index", async () => {
  const actual = await vi.importActual<typeof import("../src/index")>("../src/index");

  return {
    ...actual,
    runMiniCI: runMiniCIMock,
  };
});

/**
 * 移除 ANSI 颜色控制字符。
 *
 * @param value 待处理文本
 * @returns 无颜色控制字符的文本
 */
function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-9;]*m/g, "");
}

afterEach(() => {
  runMiniCIMock.mockReset();
  process.exitCode = undefined;
});

describe("CLI main", () => {
  test("help 保持原始输出且不调用 runMiniCI", async () => {
    /** console.log mock */
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const { main } = await import("../src/cli");

    await main(["--help"], "/repo");

    expect(runMiniCIMock).not.toHaveBeenCalled();
    expect(String(log.mock.calls[0]?.[0])).toContain("minici - uniapp 小程序 CI 工具");

    log.mockRestore();
  });

  test("未被 core 记录的错误由 CLI 输出一次", async () => {
    /** console.log mock */
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    runMiniCIMock.mockRejectedValueOnce(new Error("请指定平台"));
    const { main } = await import("../src/cli");

    await main(["--upload"], "/repo");

    expect(log.mock.calls.map(([line]) => stripAnsi(String(line)))).toEqual([
      "✕ 执行失败",
      "  error 请指定平台",
    ]);
    expect(process.exitCode).toBe(1);

    log.mockRestore();
  });

  test("core 已记录的错误不重复输出", async () => {
    /** console.log mock */
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const { markErrorLogged } = await import("uni-mini-ci-core");
    /** 已记录错误 */
    const error = markErrorLogged(new Error("preview failed"));
    runMiniCIMock.mockRejectedValueOnce(error);
    const { main } = await import("../src/cli");

    await main(["--preview", "--platform", "mp-weixin"], "/repo");

    expect(log).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);

    log.mockRestore();
  });
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```bash
pnpm --filter uni-mini-ci-cli test -- --run packages/cli/tests/cli.test.ts
```

Expected: FAIL because `main` is not exported and CLI catch still writes `console.error`.

- [ ] **Step 3: Re-export logger helpers from CLI index**

Update `packages/cli/src/index.ts` export list:

```ts
export {
  createLogger,
  isErrorLogged,
  markErrorLogged,
  runMiniCIWithConfig,
  supportedOperations,
  supportedPlatforms,
  type Logger,
  // keep the existing type exports unchanged
} from "uni-mini-ci-core";
```

- [ ] **Step 4: Make CLI main testable and use logger catch**

Update `packages/cli/src/cli.ts`:

```ts
#!/usr/bin/env node
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { createLogger, isErrorLogged, runMiniCI } from "./index";

const require = createRequire(import.meta.url);

// keep HELP_TEXT unchanged

/**
 * CLI 入口，解析命令行参数并执行 minici 流程。
 *
 * @param argv CLI 参数
 * @param cwd 当前工作目录
 */
export async function main(argv = process.argv.slice(2), cwd = process.cwd()): Promise<void> {
  if (argv.includes("-h") || argv.includes("--help") || argv.includes("help")) {
    console.log(HELP_TEXT);
    return;
  }

  if (argv.includes("-v") || (argv.includes("--version") && argv.length === 1)) {
    const pkg = require("../package.json") as { version: string };
    console.log(pkg.version);
    return;
  }

  try {
    const result = await runMiniCI({
      argv,
      cwd,
    });

    process.exitCode = result.success ? 0 : 1;
  } catch (error) {
    if (!isErrorLogged(error)) {
      /** CLI 顶层 logger */
      const logger = createLogger();
      /** 错误消息 */
      const message = error instanceof Error ? error.message : String(error);

      logger.error("执行失败");
      logger.detail("error", message);
    }

    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
```

- [ ] **Step 5: Run CLI tests and verify pass**

Run:

```bash
pnpm --filter uni-mini-ci-cli test -- --run packages/cli/tests/cli.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/index.ts packages/cli/src/cli.ts packages/cli/tests/cli.test.ts
git commit -m "feat(cli): format top-level errors with logger"
```

## Task 5: Final Verification

**Files:**
- Review: `packages/core/src/runtime/logger.ts`
- Review: `packages/core/src/runMiniCIWithConfig.ts`
- Review: `packages/core/src/ci/*.ts`
- Review: `packages/cli/src/cli.ts`

- [ ] **Step 1: Search for remaining direct console output**

Run:

```bash
rg -n "console\\.(log|warn|error)" packages/core/src packages/cli/src
```

Expected remaining matches:

```txt
packages/core/src/runtime/logger.ts
packages/core/src/utils/qrcode.ts
packages/cli/src/cli.ts
```

The CLI matches should only be help/version output. The QR code utility match should only be terminal QR rendering.

- [ ] **Step 2: Run all tests**

Run:

```bash
pnpm run test
```

Expected: PASS.

- [ ] **Step 3: Run type checks**

Run:

```bash
pnpm run typecheck
pnpm run typecheck:test
```

Expected: PASS.

- [ ] **Step 4: Run lint and format checks**

Run:

```bash
pnpm run lint
pnpm run fmt:check
```

Expected: PASS.

- [ ] **Step 5: Final commit if verification required formatting fixes**

Only run this commit step if Step 4 required code formatting changes:

```bash
git add packages/core packages/cli
git commit -m "chore: format log output changes"
```

## Self-Review Result

- Spec coverage: plan covers分组块、颜色语义、轻量 Unicode、关键时间信息、无新增配置项、core/adapter/CLI 范围、二维码字符图不包进 logger、错误单次输出。
- Placeholder scan: no placeholder-only implementation step is present.
- Type consistency: plan uses `Logger`、`createLogger`、`markErrorLogged`、`isErrorLogged` consistently across core and CLI.
