# minici CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `minici` CLI that reuses the Taro `@tarojs/plugin-mini-ci` platform CI behavior for uniapp mini program build outputs.

**Architecture:** Implement a CLI orchestration layer, a config loading and zod validation layer, a minimal runtime context replacing Taro `ctx`, and platform CI adapters migrated from `_temp/src`. Keep platform SDKs optional and only resolve the SDK for the requested platform.

**Tech Stack:** TypeScript ESM, tsdown, Vitest, c12, zod, cac, picocolors, qrcode, jsqr, jimp, axios, resolve, shelljs.

---

## File Structure

- Modify `package.json`: add `bin`, exports, runtime dependencies, optional peer dependencies, and scripts.
- Modify `tsdown.config.ts`: ensure `src/cli.ts` and `src/index.ts` are build entries and output executable ESM.
- Replace `src/index.ts`: export public API, types, `defineConfig()`, and `runMiniCI()`.
- Create `src/cli.ts`: executable bin entry that calls `runMiniCI(process.argv.slice(2))`.
- Create `src/types.ts`: shared platform, operation, config, result, and context types.
- Create `src/config/schema.ts`: zod schemas and validation helpers.
- Create `src/config/normalize.ts`: merge CLI args, config, package defaults, and resolve `desc`.
- Create `src/config/loadConfig.ts`: c12 config loading and package.json loading.
- Create `src/command/parseArgs.ts`: parse `minici --open | --preview | --upload` mutually exclusive CLI args with `cac`.
- Create `src/runtime/logger.ts`: simple colored logger.
- Create `src/runtime/createContext.ts`: runtime context with paths, logger, fs helpers, and home dir.
- Create `src/ci/BaseCI.ts`: CLI-focused base class.
- Create `src/ci/registry.ts`: map `mp-weixin | mp-alipay | mp-baidu | mp-jd | mp-toutiao` to CI classes and config keys.
- Create `src/ci/WeappCI.ts`, `src/ci/AlipayCI.ts`, `src/ci/JdCI.ts`, `src/ci/SwanCI.ts`, `src/ci/TTCI.ts`: migrate platform implementations from `_temp/src`.
- Create `src/utils/npm.ts`, `src/utils/qrcode.ts`, `src/utils/compareVersion.ts`: migrate utilities and adapt to ESM.
- Replace `tests/index.test.ts` with focused API smoke tests.
- Create `tests/config.test.ts`: config normalization and validation tests.
- Create `tests/command.test.ts`: CLI argument parsing tests.
- Create `tests/runner.test.ts`: `runMiniCI()` orchestration tests using fake CI classes.
- Create `tests/ci-base.test.ts`: base behavior tests.
- Create `tests/platform-preflight.test.ts`: platform preflight tests with mocked dependencies.
- Modify `README.md`: document CLI usage and config format.

## Task 1: Package Metadata And Build Entries

**Files:**

- Modify: `package.json`
- Modify: `tsdown.config.ts`
- Test: `package.json` script execution

- [ ] **Step 1: Write metadata expectation**

Open `package.json` and prepare to add CLI metadata. The package must expose a bin called `minici`, keep ESM, and include runtime dependencies needed by the design.

- [ ] **Step 2: Update `package.json`**

Replace the relevant metadata with this shape while preserving existing author, license, and repository fields:

```json
{
  "name": "uni-mini-ci-cli",
  "type": "module",
  "version": "0.0.0",
  "description": "A CLI for mini program CI after uniapp builds.",
  "bin": {
    "minici": "./dist/cli.mjs"
  },
  "exports": {
    ".": {
      "types": "./dist/index.d.mts",
      "import": "./dist/index.mjs"
    },
    "./package.json": "./package.json"
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsdown",
    "dev": "tsdown --watch",
    "test": "vitest",
    "typecheck": "tsc --noEmit",
    "release": "bumpp",
    "prepublishOnly": "pnpm run build"
  },
  "dependencies": {
    "axios": "^1.6.8",
    "c12": "^3.3.0",
    "cac": "^7.0.0",
    "jimp": "^0.22.12",
    "jsqr": "^1.4.0",
    "picocolors": "^1.1.1",
    "qrcode": "^1.5.3",
    "resolve": "^1.22.8",
    "shelljs": "^0.8.5",
    "zod": "^4.1.0"
  },
  "peerDependencies": {
    "jd-miniprogram-ci": "^1.0.5",
    "minidev": "^2.1.5",
    "miniprogram-ci": "^1.9.15",
    "swan-toolkit": "^1.0.0",
    "tt-ide-cli": "^0.1.25"
  },
  "peerDependenciesMeta": {
    "jd-miniprogram-ci": {
      "optional": true
    },
    "minidev": {
      "optional": true
    },
    "miniprogram-ci": {
      "optional": true
    },
    "swan-toolkit": {
      "optional": true
    },
    "tt-ide-cli": {
      "optional": true
    }
  }
}
```

Keep the existing `devDependencies` block after adding the runtime dependency sections.

- [ ] **Step 3: Update tsdown entries**

Replace `tsdown.config.ts` with:

```ts
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    cli: "src/cli.ts",
  },
  dts: {
    tsgo: true,
  },
  exports: true,
});
```

- [ ] **Step 4: Install dependencies**

Run:

```bash
pnpm install
```

Expected: lockfile updates successfully and no missing package errors.

- [ ] **Step 5: Verify build config still loads**

Run:

```bash
pnpm run typecheck
```

Expected initially: may fail because source files are not implemented yet. Continue to Task 2.

- [ ] **Step 6: Commit after user authorization**

Only after explicit git authorization, run:

```bash
git add package.json pnpm-lock.yaml tsdown.config.ts
git commit -m "chore: configure minici package metadata"
```

## Task 2: Shared Types And Public API

**Files:**

- Create: `src/types.ts`
- Replace: `src/index.ts`
- Test: `tests/index.test.ts`

- [ ] **Step 1: Write public API smoke test**

Replace `tests/index.test.ts` with:

```ts
import { describe, expect, test } from "vitest";
import { defineConfig, supportedPlatforms } from "../src/index";

describe("public api", () => {
  test("defineConfig returns the same config object", () => {
    const config = defineConfig({
      version: "1.0.0",
      desc: "发布描述",
      "mp-weixin": {
        appid: "wx-appid",
        privateKeyPath: "key/private.key",
      },
    });

    expect(config.version).toBe("1.0.0");
    expect(config.desc).toBe("发布描述");
  });

  test("exports supported uniapp platforms", () => {
    expect(supportedPlatforms).toEqual([
      "mp-weixin",
      "mp-alipay",
      "mp-baidu",
      "mp-jd",
      "mp-toutiao",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm test tests/index.test.ts
```

Expected: FAIL because `defineConfig` and `supportedPlatforms` do not exist.

- [ ] **Step 3: Create shared types**

Create `src/types.ts`:

```ts
export const supportedOperations = ["open", "preview", "upload"] as const;

export const supportedPlatforms = [
  "mp-weixin",
  "mp-alipay",
  "mp-baidu",
  "mp-jd",
  "mp-toutiao",
] as const;

export type MiniCIOperation = (typeof supportedOperations)[number];
export type MiniCIPlatform = (typeof supportedPlatforms)[number];

export type ProjectType = "miniProgram" | "miniGame" | "miniProgramPlugin" | "miniGamePlugin";

export interface WeappConfig {
  /** 小程序或小游戏项目的 appid */
  appid: string;
  /** 私钥文件路径 */
  privateKeyPath: string;
  /** 微信开发者工具安装路径 */
  devToolsInstallPath?: string;
  /** 项目类型 */
  type?: ProjectType;
  /** 上传需要排除的目录 */
  ignores?: string[];
  /** CI 机器人编号 */
  robot?: number;
  /** 预览和上传时的编译设置 */
  setting?: Record<string, unknown>;
}

export type AlipayClientType =
  | "alipay"
  | "ampe"
  | "amap"
  | "genie"
  | "alios"
  | "uc"
  | "quark"
  | "koubei"
  | "alipayiot"
  | "cainiao"
  | "alihealth"
  | "health";

export interface AlipayConfig {
  /** 小程序 appid */
  appid: string;
  /** 工具 id */
  toolId: string;
  /** 私钥文件路径 */
  privateKeyPath?: string;
  /** 私钥文本 */
  privateKey?: string;
  /** 小程序开发者工具安装路径 */
  devToolsInstallPath?: string;
  /** 上传终端类型 */
  clientType?: AlipayClientType;
  /** 上传时删除的版本号 */
  deleteVersion?: string;
}

export interface JdConfig {
  /** 京东小程序秘钥 */
  privateKey: string;
  /** CI 机器人编号 */
  robot?: number;
  /** 上传忽略规则 */
  ignores?: string[];
}

export interface SwanConfig {
  /** 百度小程序鉴权 token */
  token: string;
  /** 最低基础库版本 */
  minSwanVersion?: string;
  /** 百度开发者工具安装路径 */
  devToolsInstallPath?: string;
}

export interface TTConfig {
  /** 字节小程序邮箱 */
  email: string;
  /** 字节小程序密码 */
  password: string;
  /** 字节 IDE 编译设置 */
  setting?: {
    skipDomainCheck?: boolean;
  };
}

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

export type MiniCIDescFunction = (context: MiniCIDescContext) => string | Promise<string>;

export interface MiniCIConfig {
  /** 发布版本号 */
  version?: string;
  /** 发布描述 */
  desc?: string | MiniCIDescFunction;
  /** 小程序构建产物目录 */
  projectPath?: string;
  /** 微信小程序配置 */
  "mp-weixin"?: WeappConfig;
  /** 支付宝小程序配置 */
  "mp-alipay"?: AlipayConfig;
  /** 百度小程序配置 */
  "mp-baidu"?: SwanConfig;
  /** 京东小程序配置 */
  "mp-jd"?: JdConfig;
  /** 字节小程序配置 */
  "mp-toutiao"?: TTConfig;
}

export interface CliOptions {
  /** 命令参数 */
  argv: string[];
  /** 当前工作目录 */
  cwd?: string;
  /** 是否直接退出进程 */
  exitProcess?: boolean;
}

export interface ParsedCliArgs {
  /** 当前操作 */
  operation: MiniCIOperation;
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
}

export interface NormalizedMiniCIConfig {
  /** 当前操作 */
  operation: MiniCIOperation;
  /** 当前平台 */
  platform: MiniCIPlatform;
  /** 当前工作目录 */
  cwd: string;
  /** 已解析的项目产物目录 */
  projectPath: string;
  /** 发布版本 */
  version: string;
  /** 发布描述 */
  desc: string;
  /** 当前项目 package.json 内容 */
  packageJson: Record<string, unknown>;
  /** 当前平台配置 */
  platformConfig: WeappConfig | AlipayConfig | SwanConfig | JdConfig | TTConfig;
}

export interface MiniCIResult {
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
```

- [ ] **Step 4: Replace public API**

Replace `src/index.ts`:

```ts
import type { CliOptions, MiniCIConfig, MiniCIResult } from "./types";

export {
  supportedOperations,
  supportedPlatforms,
  type AlipayConfig,
  type CliOptions,
  type JdConfig,
  type MiniCIOperation,
  type MiniCIConfig,
  type MiniCIDescContext,
  type MiniCIDescFunction,
  type MiniCIPlatform,
  type MiniCIResult,
  type ParsedCliArgs,
  type ProjectType,
  type SwanConfig,
  type TTConfig,
  type WeappConfig,
} from "./types";

export function defineConfig(config: MiniCIConfig): MiniCIConfig {
  return config;
}

export async function runMiniCI(_options: CliOptions): Promise<MiniCIResult> {
  throw new Error("runMiniCI 需要先完成 Task 6");
}
```

- [ ] **Step 5: Run smoke test**

Run:

```bash
pnpm test tests/index.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit after user authorization**

Only after explicit git authorization, run:

```bash
git add src/types.ts src/index.ts tests/index.test.ts
git commit -m "feat: add minici public api types"
```

## Task 3: CLI Argument Parsing

**Files:**

- Create: `src/command/parseArgs.ts`
- Test: `tests/command.test.ts`

- [ ] **Step 1: Write failing CLI parser tests**

Create `tests/command.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { parseCliArgs } from "../src/command/parseArgs";

describe("parseCliArgs", () => {
  test("parses upload operation flag with platform and project path", () => {
    const args = parseCliArgs([
      "--upload",
      "--platform",
      "mp-weixin",
      "--projectPath",
      "dist/build/mp-weixin",
    ]);

    expect(args).toEqual({
      operation: "upload",
      platform: "mp-weixin",
      projectPath: "dist/build/mp-weixin",
    });
  });

  test("parses desc and version as command line overrides", () => {
    const args = parseCliArgs([
      "--preview",
      "--platform",
      "mp-alipay",
      "--version",
      "1.2.3",
      "--desc",
      "灰度发布",
    ]);

    expect(args.version).toBe("1.2.3");
    expect(args.desc).toBe("灰度发布");
  });

  test("throws clear error when operation is missing", () => {
    expect(() => parseCliArgs(["--platform", "mp-weixin"])).toThrow("请指定操作");
  });

  test("throws clear error when multiple operation flags are passed", () => {
    expect(() => parseCliArgs(["--open", "--upload", "--platform", "mp-weixin"])).toThrow(
      "只能指定一个操作",
    );
  });

  test("throws clear error for old positional operation", () => {
    expect(() => parseCliArgs(["open", "--platform", "mp-weixin"])).toThrow("暂不支持位置参数");
  });

  test("throws clear error when platform is missing", () => {
    expect(() => parseCliArgs(["--upload"])).toThrow("请指定平台");
  });

  test("throws clear error for unsupported platform", () => {
    expect(() => parseCliArgs(["--upload", "--platform", "mp-qq"])).toThrow("暂不支持平台");
  });
});
```

- [ ] **Step 2: Run parser test to verify it fails**

Run:

```bash
pnpm test tests/command.test.ts
```

Expected: FAIL because `src/command/parseArgs.ts` does not exist.

- [ ] **Step 3: Implement CLI parser**

Create `src/command/parseArgs.ts`:

```ts
import { CAC } from "cac";
import { supportedOperations, supportedPlatforms } from "../types";

import type { MiniCIOperation, MiniCIPlatform, ParsedCliArgs } from "../types";

function isOperation(value: string | undefined): value is MiniCIOperation {
  return supportedOperations.includes(value as MiniCIOperation);
}

function isPlatform(value: unknown): value is MiniCIPlatform {
  return typeof value === "string" && supportedPlatforms.includes(value as MiniCIPlatform);
}

export function parseCliArgs(argv: string[]): ParsedCliArgs {
  const cli = new CAC("minici");
  cli.option("--platform <platform>", "uniapp 小程序平台");
  cli.option("--open", "打开开发者工具");
  cli.option("--preview", "上传开发版并生成预览二维码");
  cli.option("--upload", "上传体验版");
  cli.option("--projectPath <projectPath>", "已构建的小程序产物目录");
  cli.option("--version <version>", "发布版本号");
  cli.option("--desc <desc>", "发布描述");
  cli.option("--config <config>", "配置文件路径");
  cli.option("--cwd <cwd>", "项目根目录");

  const parsed = cli.parse(argv, { run: false });
  if (parsed.args.length > 0) {
    throw new Error(`暂不支持位置参数：${parsed.args.join(" ")}`);
  }

  const operations = supportedOperations.filter((operation) => parsed.options[operation]);

  if (operations.length === 0) {
    throw new Error(`请指定操作：--${supportedOperations.join(" | --")}`);
  }

  if (operations.length > 1) {
    throw new Error(`只能指定一个操作：--${supportedOperations.join(" | --")}`);
  }

  if (!parsed.options.platform) {
    throw new Error("请指定平台：--platform");
  }

  if (!isPlatform(parsed.options.platform)) {
    throw new Error(`暂不支持平台：${String(parsed.options.platform)}`);
  }

  return {
    operation: operations[0],
    platform: parsed.options.platform,
    projectPath: parsed.options.projectPath,
    version: parsed.options.version,
    desc: parsed.options.desc,
    config: parsed.options.config,
    cwd: parsed.options.cwd,
  };
}
```

- [ ] **Step 4: Run parser tests**

Run:

```bash
pnpm test tests/command.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit after user authorization**

Only after explicit git authorization, run:

```bash
git add src/command/parseArgs.ts tests/command.test.ts
git commit -m "feat: parse minici cli arguments"
```

## Task 4: Zod Schemas And Config Normalization

**Files:**

- Create: `src/config/schema.ts`
- Create: `src/config/normalize.ts`
- Test: `tests/config.test.ts`

- [ ] **Step 1: Write failing config tests**

Create `tests/config.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { normalizeConfig } from "../src/config/normalize";
import { validatePlatformConfig } from "../src/config/schema";

describe("validatePlatformConfig", () => {
  test("requires mp-weixin privateKeyPath", () => {
    expect(() =>
      validatePlatformConfig("mp-weixin", {
        "mp-weixin": {
          appid: "wx-appid",
        },
      }),
    ).toThrow("mp-weixin.privateKeyPath");
  });

  test("requires mp-alipay privateKeyPath or privateKey", () => {
    expect(() =>
      validatePlatformConfig("mp-alipay", {
        "mp-alipay": {
          appid: "ali-appid",
          toolId: "tool-id",
        },
      }),
    ).toThrow("mp-alipay.privateKeyPath");
  });
});

describe("normalizeConfig", () => {
  test("uses command line values before config and package defaults", async () => {
    const result = await normalizeConfig({
      args: {
        operation: "upload",
        platform: "mp-weixin",
        projectPath: "cli-dist",
        version: "9.9.9",
        desc: "命令行描述",
      },
      cwd: "/repo",
      config: {
        version: "1.0.0",
        desc: "配置描述",
        projectPath: "config-dist",
        "mp-weixin": {
          appid: "wx-appid",
          privateKeyPath: "key/private.key",
        },
      },
      packageJson: {
        version: "0.1.0",
        description: "包描述",
      },
    });

    expect(result.version).toBe("9.9.9");
    expect(result.desc).toBe("命令行描述");
    expect(result.projectPath).toBe("/repo/cli-dist");
  });

  test("resolves async desc function after version and project path", async () => {
    const result = await normalizeConfig({
      args: {
        operation: "preview",
        platform: "mp-weixin",
      },
      cwd: "/repo",
      config: {
        version: "1.2.0",
        desc: async ({ platform, version, projectPath }) => {
          return `${platform}-${version}-${projectPath}`;
        },
        "mp-weixin": {
          appid: "wx-appid",
          privateKeyPath: "key/private.key",
        },
      },
      packageJson: {
        name: "demo",
      },
    });

    expect(result.desc).toBe("mp-weixin-1.2.0-/repo/dist/build/mp-weixin");
  });

  test("falls back to package version and description", async () => {
    const result = await normalizeConfig({
      args: {
        operation: "upload",
        platform: "mp-jd",
      },
      cwd: "/repo",
      config: {
        "mp-jd": {
          privateKey: "jd-private-key",
        },
      },
      packageJson: {
        version: "2.0.0",
        description: "包描述",
      },
    });

    expect(result.version).toBe("2.0.0");
    expect(result.desc).toBe("包描述");
    expect(result.projectPath).toBe("/repo/dist/build/mp-jd");
  });
});
```

- [ ] **Step 2: Run config tests to verify they fail**

Run:

```bash
pnpm test tests/config.test.ts
```

Expected: FAIL because config modules do not exist.

- [ ] **Step 3: Implement zod schemas**

Create `src/config/schema.ts`:

```ts
import { z } from "zod";
import { supportedPlatforms } from "../types";

import type { MiniCIConfig, MiniCIPlatform } from "../types";

const descSchema = z.union([z.string(), z.function()]);

const weappSchema = z.object({
  appid: z.string().min(1, "mp-weixin.appid 必填"),
  privateKeyPath: z.string().min(1, "mp-weixin.privateKeyPath 必填"),
  devToolsInstallPath: z.string().optional(),
  type: z.enum(["miniProgram", "miniGame", "miniProgramPlugin", "miniGamePlugin"]).optional(),
  ignores: z.array(z.string()).optional(),
  robot: z.number().optional(),
  setting: z.record(z.string(), z.unknown()).optional(),
});

const alipaySchema = z
  .object({
    appid: z.string().min(1, "mp-alipay.appid 必填"),
    toolId: z.string().min(1, "mp-alipay.toolId 必填"),
    privateKeyPath: z.string().optional(),
    privateKey: z.string().optional(),
    devToolsInstallPath: z.string().optional(),
    clientType: z
      .enum([
        "alipay",
        "ampe",
        "amap",
        "genie",
        "alios",
        "uc",
        "quark",
        "koubei",
        "alipayiot",
        "cainiao",
        "alihealth",
        "health",
      ])
      .optional(),
    deleteVersion: z
      .string()
      .regex(/^\d+\.\d+\.\d+$/)
      .optional(),
  })
  .refine((value) => Boolean(value.privateKeyPath || value.privateKey), {
    message: "mp-alipay.privateKeyPath 或 mp-alipay.privateKey 必填",
    path: ["privateKeyPath"],
  });

const swanSchema = z.object({
  token: z.string().min(1, "mp-baidu.token 必填"),
  minSwanVersion: z.string().optional(),
  devToolsInstallPath: z.string().optional(),
});

const jdSchema = z.object({
  privateKey: z.string().min(1, "mp-jd.privateKey 必填"),
  robot: z.number().optional(),
  ignores: z.array(z.string()).optional(),
});

const ttSchema = z.object({
  email: z.string().min(1, "mp-toutiao.email 必填"),
  password: z.string().min(1, "mp-toutiao.password 必填"),
  setting: z
    .object({
      skipDomainCheck: z.boolean().optional(),
    })
    .optional(),
});

export const miniciConfigSchema = z.object({
  version: z.string().optional(),
  desc: descSchema.optional(),
  projectPath: z.string().optional(),
  "mp-weixin": weappSchema.optional(),
  "mp-alipay": alipaySchema.optional(),
  "mp-baidu": swanSchema.optional(),
  "mp-jd": jdSchema.optional(),
  "mp-toutiao": ttSchema.optional(),
});

const platformSchemas = {
  "mp-weixin": weappSchema,
  "mp-alipay": alipaySchema,
  "mp-baidu": swanSchema,
  "mp-jd": jdSchema,
  "mp-toutiao": ttSchema,
} satisfies Record<MiniCIPlatform, z.ZodType>;

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("\n");
}

export function validateConfig(config: unknown): MiniCIConfig {
  const result = miniciConfigSchema.safeParse(config);

  if (!result.success) {
    throw new Error(`配置校验失败：${formatZodError(result.error)}`);
  }

  return result.data;
}

export function validatePlatformConfig(
  platform: MiniCIPlatform,
  config: MiniCIConfig,
): NonNullable<MiniCIConfig[MiniCIPlatform]> {
  const value = config[platform];

  if (!value) {
    throw new Error(`配置校验失败：${platform} 配置必填`);
  }

  const result = platformSchemas[platform].safeParse(value);

  if (!result.success) {
    throw new Error(`配置校验失败：${platform}.${formatZodError(result.error)}`);
  }

  return result.data as NonNullable<MiniCIConfig[MiniCIPlatform]>;
}
```

- [ ] **Step 4: Implement normalization**

Create `src/config/normalize.ts`:

```ts
import path from "node:path";
import { validateConfig, validatePlatformConfig } from "./schema";

import type { MiniCIConfig, NormalizedMiniCIConfig, ParsedCliArgs } from "../types";

interface NormalizeConfigInput {
  /** 已解析命令行参数 */
  args: ParsedCliArgs;
  /** 当前工作目录 */
  cwd: string;
  /** 配置文件内容 */
  config: MiniCIConfig;
  /** package.json 内容 */
  packageJson: Record<string, unknown>;
}

function resolvePath(cwd: string, value: string): string {
  return path.isAbsolute(value) ? value : path.join(cwd, value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export async function normalizeConfig(
  input: NormalizeConfigInput,
): Promise<NormalizedMiniCIConfig> {
  const config = validateConfig(input.config);
  const platformConfig = validatePlatformConfig(input.args.platform, config);
  const version =
    input.args.version || config.version || readString(input.packageJson.version) || "0.0.0";
  const rawProjectPath = resolvePath(
    input.cwd,
    input.args.projectPath ||
      config.projectPath ||
      (input.args.dev ? `dist/dev/${input.args.platform}` : `dist/build/${input.args.platform}`),
  );

  let desc = input.args.desc;

  if (!desc) {
    if (typeof config.desc === "function") {
      desc = await config.desc({
        operation: input.args.operation,
        platform: input.args.platform,
        version,
        projectPath,
        cwd: input.cwd,
        packageJson: input.packageJson,
      });
    } else {
      desc = config.desc || readString(input.packageJson.description);
    }
  }

  return {
    operation: input.args.operation,
    platform: input.args.platform,
    cwd: input.cwd,
    projectPath,
    version,
    desc: desc || `CI 自动构建于 ${new Date().toLocaleString()}`,
    packageJson: input.packageJson,
    platformConfig,
  };
}
```

- [ ] **Step 5: Run config tests**

Run:

```bash
pnpm test tests/config.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit after user authorization**

Only after explicit git authorization, run:

```bash
git add src/config/schema.ts src/config/normalize.ts tests/config.test.ts
git commit -m "feat: validate and normalize minici config"
```

## Task 5: Config Loading And Runtime Context

**Files:**

- Create: `src/config/loadConfig.ts`
- Create: `src/runtime/logger.ts`
- Create: `src/runtime/createContext.ts`
- Test: `tests/runtime.test.ts`

- [ ] **Step 1: Write failing runtime tests**

Create `tests/runtime.test.ts`:

```ts
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { loadMiniCIConfig, loadPackageJson } from "../src/config/loadConfig";
import { createRuntimeContext } from "../src/runtime/createContext";

const tempDirs: string[] = [];

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "minici-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("loadPackageJson", () => {
  test("returns parsed package json when present", async () => {
    const cwd = await createTempDir();
    await writeFile(path.join(cwd, "package.json"), JSON.stringify({ version: "1.0.0" }));

    await expect(loadPackageJson(cwd)).resolves.toEqual({ version: "1.0.0" });
  });

  test("returns empty object when package json is missing", async () => {
    const cwd = await createTempDir();

    await expect(loadPackageJson(cwd)).resolves.toEqual({});
  });
});

describe("loadMiniCIConfig", () => {
  test("loads empty config when config file is missing", async () => {
    const cwd = await createTempDir();

    await expect(loadMiniCIConfig({ cwd })).resolves.toEqual({});
  });
});

describe("createRuntimeContext", () => {
  test("checks path existence and exposes home directory", async () => {
    const cwd = await createTempDir();
    const ctx = createRuntimeContext({ cwd });

    await expect(ctx.pathExists(cwd)).resolves.toBe(true);
    expect(ctx.getUserHomeDir()).toBe(os.homedir());
  });
});
```

- [ ] **Step 2: Run runtime tests to verify they fail**

Run:

```bash
pnpm test tests/runtime.test.ts
```

Expected: FAIL because modules do not exist.

- [ ] **Step 3: Implement config loading**

Create `src/config/loadConfig.ts`:

```ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "c12";

import type { MiniCIConfig } from "../types";

interface LoadMiniCIConfigOptions {
  /** 当前工作目录 */
  cwd: string;
  /** 显式配置文件路径 */
  config?: string;
}

export async function loadMiniCIConfig(options: LoadMiniCIConfigOptions): Promise<MiniCIConfig> {
  const result = await loadConfig<MiniCIConfig>({
    cwd: options.cwd,
    name: "minici",
    configFile: options.config,
    dotenv: false,
    rcFile: false,
  });

  return result.config || {};
}

export async function loadPackageJson(cwd: string): Promise<Record<string, unknown>> {
  try {
    const content = await readFile(path.join(cwd, "package.json"), "utf8");
    return JSON.parse(content) as Record<string, unknown>;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return {};
    }

    throw error;
  }
}
```

- [ ] **Step 4: Implement logger**

Create `src/runtime/logger.ts`:

```ts
import pc from "picocolors";

export interface Logger {
  /** 输出开始信息 */
  start(message: string, detail?: string): void;
  /** 输出提醒信息 */
  remind(message: string, detail?: string): void;
  /** 输出警告信息 */
  warn(message: string, detail?: string): void;
  /** 输出错误信息 */
  error(message: string, detail?: string): void;
  /** 输出成功信息 */
  success(message: string, detail?: string): void;
}

function print(label: string, message: string, detail?: string): void {
  console.log(detail ? `${label} ${message} ${detail}` : `${label} ${message}`);
}

export function createLogger(): Logger {
  return {
    start(message, detail) {
      print(pc.cyan("start"), message, detail);
    },
    remind(message, detail) {
      print(pc.blue("info"), message, detail);
    },
    warn(message, detail) {
      print(pc.yellow("warn"), message, detail);
    },
    error(message, detail) {
      print(pc.red("error"), message, detail);
    },
    success(message, detail) {
      print(pc.green("success"), message, detail);
    },
  };
}
```

- [ ] **Step 5: Implement runtime context**

Create `src/runtime/createContext.ts`:

```ts
import { existsSync } from "node:fs";
import { access, readFile } from "node:fs/promises";
import os from "node:os";
import { createLogger } from "./logger";

import type { Logger } from "./logger";

export interface RuntimeContext {
  /** 当前工作目录 */
  cwd: string;
  /** 日志实例 */
  logger: Logger;
  /** 判断路径是否存在 */
  pathExists(path: string): Promise<boolean>;
  /** 同步判断路径是否存在 */
  pathExistsSync(path: string): boolean;
  /** 读取文本文件 */
  readTextFile(path: string): Promise<string>;
  /** 读取用户主目录 */
  getUserHomeDir(): string;
}

interface CreateRuntimeContextOptions {
  /** 当前工作目录 */
  cwd: string;
  /** 自定义日志实例 */
  logger?: Logger;
}

export function createRuntimeContext(options: CreateRuntimeContextOptions): RuntimeContext {
  return {
    cwd: options.cwd,
    logger: options.logger || createLogger(),
    async pathExists(filePath) {
      try {
        await access(filePath);
        return true;
      } catch {
        return false;
      }
    },
    pathExistsSync(filePath) {
      return existsSync(filePath);
    },
    readTextFile(filePath) {
      return readFile(filePath, "utf8");
    },
    getUserHomeDir() {
      return os.homedir();
    },
  };
}
```

- [ ] **Step 6: Run runtime tests**

Run:

```bash
pnpm test tests/runtime.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit after user authorization**

Only after explicit git authorization, run:

```bash
git add src/config/loadConfig.ts src/runtime/logger.ts src/runtime/createContext.ts tests/runtime.test.ts
git commit -m "feat: add config loading and runtime context"
```

## Task 6: Base CI, Registry, And Runner Orchestration

**Files:**

- Create: `src/ci/BaseCI.ts`
- Create: `src/ci/registry.ts`
- Modify: `src/index.ts`
- Test: `tests/runner.test.ts`
- Test: `tests/ci-base.test.ts`

- [ ] **Step 1: Write failing BaseCI test**

Create `tests/ci-base.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { BaseCI } from "../src/ci/BaseCI";
import type { NormalizedMiniCIConfig } from "../src/types";

class FakeCI extends BaseCI {
  init(): void {}

  async open() {
    return this.createResult(true);
  }

  async preview() {
    return this.createResult(true, {
      qrCodeContent: "preview-content",
      qrCodeLocalPath: "/repo/preview.png",
    });
  }

  async upload() {
    return this.createResult(true, {
      qrCodeContent: "upload-content",
      qrCodeLocalPath: "/repo/upload.png",
    });
  }
}

function createConfig(): NormalizedMiniCIConfig {
  return {
    operation: "upload",
    platform: "mp-weixin",
    cwd: "/repo",
    projectPath: "/repo/dist/build/mp-weixin",
    version: "1.0.0",
    desc: "测试描述",
    packageJson: {},
    platformConfig: {
      appid: "wx-appid",
      privateKeyPath: "key/private.key",
    },
  };
}

describe("BaseCI", () => {
  test("creates result with shared metadata", async () => {
    const ci = new FakeCI(createConfig());
    const result = await ci.upload();

    expect(result).toMatchObject({
      success: true,
      operation: "upload",
      platform: "mp-weixin",
      version: "1.0.0",
      desc: "测试描述",
      projectPath: "/repo/dist/build/mp-weixin",
      qrCodeContent: "upload-content",
    });
  });
});
```

- [ ] **Step 2: Write failing runner test**

Create `tests/runner.test.ts`:

```ts
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";

const runMock = vi.fn();

vi.mock("../src/ci/registry", () => {
  class FakeCI {
    constructor(public config: unknown) {}
    init() {}
    open = () => runMock("open", this.config);
    preview = () => runMock("preview", this.config);
    upload = () => runMock("upload", this.config);
  }

  return {
    createCI: () => new FakeCI({}),
  };
});

const tempDirs: string[] = [];

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "minici-runner-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  runMock.mockReset();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("runMiniCI", () => {
  test("loads config and executes selected operation", async () => {
    const cwd = await createTempDir();
    await mkdir(path.join(cwd, "dist/build/mp-weixin"), { recursive: true });
    await writeFile(path.join(cwd, "package.json"), JSON.stringify({ version: "1.0.0" }));
    await writeFile(
      path.join(cwd, "minici.config.mjs"),
      `
        export default {
          desc: '配置描述',
          'mp-weixin': {
            appid: 'wx-appid',
            privateKeyPath: 'key/private.key'
          }
        }
      `,
    );

    const { runMiniCI } = await import("../src/index");
    await runMiniCI({
      argv: ["upload", "--platform", "mp-weixin"],
      cwd,
    });

    expect(runMock).toHaveBeenCalledWith("upload", {});
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
pnpm test tests/ci-base.test.ts tests/runner.test.ts
```

Expected: FAIL because BaseCI and runner orchestration are missing.

- [ ] **Step 4: Implement BaseCI**

Create `src/ci/BaseCI.ts`:

```ts
import type { MiniCIResult, NormalizedMiniCIConfig } from "../types";

export abstract class BaseCI {
  protected config: NormalizedMiniCIConfig;

  constructor(config: NormalizedMiniCIConfig) {
    this.config = config;
  }

  protected createResult(success: boolean, extra: Partial<MiniCIResult> = {}): MiniCIResult {
    return {
      success,
      operation: this.config.operation,
      platform: this.config.platform,
      version: this.config.version,
      desc: this.config.desc,
      projectPath: this.config.projectPath,
      ...extra,
    };
  }

  abstract init(): void | Promise<void>;
  abstract open(): Promise<MiniCIResult>;
  abstract preview(): Promise<MiniCIResult>;
  abstract upload(): Promise<MiniCIResult>;
}
```

- [ ] **Step 5: Implement registry skeleton**

Create `src/ci/registry.ts`:

```ts
import { AlipayCI } from "./AlipayCI";
import { JdCI } from "./JdCI";
import { SwanCI } from "./SwanCI";
import { TTCI } from "./TTCI";
import { WeappCI } from "./WeappCI";

import type { BaseCI } from "./BaseCI";
import type { MiniCIPlatform, NormalizedMiniCIConfig } from "../types";

const ciMap = {
  "mp-weixin": WeappCI,
  "mp-alipay": AlipayCI,
  "mp-baidu": SwanCI,
  "mp-jd": JdCI,
  "mp-toutiao": TTCI,
} satisfies Record<MiniCIPlatform, new (config: NormalizedMiniCIConfig) => BaseCI>;

export function createCI(config: NormalizedMiniCIConfig): BaseCI {
  const CI = ciMap[config.platform];
  return new CI(config);
}
```

Create minimal platform classes so registry compiles. Later platform tasks replace each minimal class with its real SDK adapter.

Example for `src/ci/WeappCI.ts`:

```ts
import { BaseCI } from "./BaseCI";

export class WeappCI extends BaseCI {
  init(): void {}

  async open() {
    return this.createResult(true);
  }

  async preview() {
    return this.createResult(true);
  }

  async upload() {
    return this.createResult(true);
  }
}
```

Create equivalent minimal classes for `AlipayCI`, `JdCI`, `SwanCI`, and `TTCI`.

- [ ] **Step 6: Implement `runMiniCI()`**

Replace the `runMiniCI()` implementation in `src/index.ts`:

```ts
import { parseCliArgs } from "./command/parseArgs";
import { loadMiniCIConfig, loadPackageJson } from "./config/loadConfig";
import { normalizeConfig } from "./config/normalize";
import { createCI } from "./ci/registry";

import type { CliOptions, MiniCIConfig, MiniCIResult } from "./types";

export {
  supportedOperations,
  supportedPlatforms,
  type AlipayConfig,
  type CliOptions,
  type JdConfig,
  type MiniCIOperation,
  type MiniCIConfig,
  type MiniCIDescContext,
  type MiniCIDescFunction,
  type MiniCIPlatform,
  type MiniCIResult,
  type ParsedCliArgs,
  type ProjectType,
  type SwanConfig,
  type TTConfig,
  type WeappConfig,
} from "./types";

export function defineConfig(config: MiniCIConfig): MiniCIConfig {
  return config;
}

export async function runMiniCI(options: CliOptions): Promise<MiniCIResult> {
  const args = parseCliArgs(options.argv);
  const cwd = args.cwd || options.cwd || process.cwd();
  const config = await loadMiniCIConfig({ cwd, config: args.config });
  const packageJson = await loadPackageJson(cwd);
  const normalized = await normalizeConfig({ args, cwd, config, packageJson });
  const ci = createCI(normalized);

  await ci.init();
  return ci[normalized.operation]();
}
```

- [ ] **Step 7: Run base and runner tests**

Run:

```bash
pnpm test tests/ci-base.test.ts tests/runner.test.ts
```

Expected: PASS after aligning mocks with implementation.

- [ ] **Step 8: Commit after user authorization**

Only after explicit git authorization, run:

```bash
git add src/ci src/index.ts tests/ci-base.test.ts tests/runner.test.ts
git commit -m "feat: orchestrate minici runner"
```

## Task 7: CLI Executable Entry And Path Validation

**Files:**

- Create: `src/cli.ts`
- Modify: `src/index.ts`
- Test: `tests/runner.test.ts`

- [ ] **Step 1: Add path validation test**

Append to `tests/runner.test.ts`:

```ts
test("fails when projectPath does not exist", async () => {
  const cwd = await createTempDir();
  await writeFile(path.join(cwd, "package.json"), JSON.stringify({ version: "1.0.0" }));
  await writeFile(
    path.join(cwd, "minici.config.mjs"),
    `
      export default {
        'mp-weixin': {
          appid: 'wx-appid',
          privateKeyPath: 'key/private.key'
        }
      }
    `,
  );

  const { runMiniCI } = await import("../src/index");

  await expect(
    runMiniCI({
      argv: ["upload", "--platform", "mp-weixin", "--projectPath", "missing-dist"],
      cwd,
    }),
  ).rejects.toThrow("projectPath 不存在");
});
```

- [ ] **Step 2: Run runner test to verify it fails**

Run:

```bash
pnpm test tests/runner.test.ts
```

Expected: FAIL because `runMiniCI()` does not validate `projectPath`.

- [ ] **Step 3: Add project path validation in `runMiniCI()`**

Update `src/index.ts` after normalization:

```ts
import { access } from "node:fs/promises";

async function assertPathExists(projectPath: string): Promise<void> {
  try {
    await access(projectPath);
  } catch {
    throw new Error(`projectPath 不存在：${projectPath}`);
  }
}
```

Call it before `createCI(normalized)`:

```ts
await assertPathExists(normalized.projectPath);
```

- [ ] **Step 4: Create executable CLI entry**

Create `src/cli.ts`:

```ts
#!/usr/bin/env node
import { runMiniCI } from "./index";

async function main(): Promise<void> {
  try {
    const result = await runMiniCI({
      argv: process.argv.slice(2),
      cwd: process.cwd(),
    });

    if (result.qrCodeLocalPath) {
      console.log(`二维码路径：${result.qrCodeLocalPath}`);
    }

    if (result.qrCodeContent) {
      console.log(`二维码内容：${result.qrCodeContent}`);
    }

    process.exitCode = result.success ? 0 : 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  }
}

await main();
```

- [ ] **Step 5: Run runner tests**

Run:

```bash
pnpm test tests/runner.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run typecheck**

Run:

```bash
pnpm run typecheck
```

Expected: PASS or only errors from platform classes that are intentionally still minimal. Fix local type errors before continuing.

- [ ] **Step 7: Commit after user authorization**

Only after explicit git authorization, run:

```bash
git add src/cli.ts src/index.ts tests/runner.test.ts
git commit -m "feat: add minici executable entry"
```

## Task 8: Utility Migration

**Files:**

- Create: `src/utils/npm.ts`
- Create: `src/utils/qrcode.ts`
- Create: `src/utils/compareVersion.ts`
- Test: `tests/utils.test.ts`

- [ ] **Step 1: Write utility tests**

Create `tests/utils.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { compareVersion } from "../src/utils/compareVersion";

describe("compareVersion", () => {
  test("compares semantic versions", () => {
    expect(compareVersion("1.2.0", "1.1.9")).toBe(1);
    expect(compareVersion("1.2.0", "1.2.0")).toBe(0);
    expect(compareVersion("1.1.9", "1.2.0")).toBe(-1);
  });
});
```

- [ ] **Step 2: Run utility tests to verify they fail**

Run:

```bash
pnpm test tests/utils.test.ts
```

Expected: FAIL because utility files do not exist.

- [ ] **Step 3: Create npm resolver utility**

Create `src/utils/npm.ts`:

```ts
import { createRequire } from "node:module";
import resolve from "resolve";

const require = createRequire(import.meta.url);
const npmCached = new Map<string, string>();

export function resolveNpmSync(pluginName: string, root: string): string {
  const cacheKey = `${root}:${pluginName}`;
  const cached = npmCached.get(cacheKey);

  if (cached) {
    return cached;
  }

  const resolved = resolve.sync(pluginName, { basedir: root });
  npmCached.set(cacheKey, resolved);
  return resolved;
}

export function getNpmPkgSync<T = unknown>(npmName: string, root: string): T {
  const npmPath = resolveNpmSync(npmName, root);
  return require(npmPath) as T;
}
```

- [ ] **Step 4: Create QR code utility**

Create `src/utils/qrcode.ts` by adapting `_temp/src/utils/qrcode.ts`:

```ts
import { existsSync } from "node:fs";
import axios from "axios";
import Jimp from "jimp";
import jsQR from "jsqr";
import QRCode from "qrcode";

export async function readQrcodeImageContent(imagePath: string): Promise<string> {
  let imageBuffer: Buffer | undefined;

  if (!existsSync(imagePath)) {
    const response = await axios({
      method: "get",
      url: imagePath,
      responseType: "arraybuffer",
      timeout: 8000,
    });
    imageBuffer = Buffer.from(response.data);
  }

  const image = await Jimp.read(imageBuffer || imagePath);
  const scanData = jsQR(image.bitmap.data, image.bitmap.width, image.bitmap.height);

  if (!scanData) {
    throw new Error("扫描器 jsqr 未能识别出二维码内容");
  }

  return scanData.data;
}

export async function printQrcode2Terminal(content: string): Promise<void> {
  const terminalStr = await QRCode.toString(content, { type: "terminal", small: true });
  console.log(terminalStr);
}

export async function generateQrcodeImageFile(path: string, content: string): Promise<void> {
  await QRCode.toFile(path, content, {
    errorCorrectionLevel: "L",
    type: "png",
  });
}
```

- [ ] **Step 5: Create compare version utility**

Create `src/utils/compareVersion.ts`:

```ts
export function compareVersion(left: string, right: string): -1 | 0 | 1 {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftValue = leftParts[index] || 0;
    const rightValue = rightParts[index] || 0;

    if (leftValue > rightValue) {
      return 1;
    }

    if (leftValue < rightValue) {
      return -1;
    }
  }

  return 0;
}
```

- [ ] **Step 6: Run utility tests**

Run:

```bash
pnpm test tests/utils.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit after user authorization**

Only after explicit git authorization, run:

```bash
git add src/utils tests/utils.test.ts
git commit -m "feat: add minici utility helpers"
```

## Task 9: WeChat Platform Adapter

**Files:**

- Replace: `src/ci/WeappCI.ts`
- Test: `tests/platform-preflight.test.ts`

- [ ] **Step 1: Write failing WeChat preflight tests**

Create or extend `tests/platform-preflight.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { WeappCI } from "../src/ci/WeappCI";
import type { NormalizedMiniCIConfig } from "../src/types";

function createWeappConfig(
  overrides: Partial<NormalizedMiniCIConfig> = {},
): NormalizedMiniCIConfig {
  return {
    operation: "upload",
    platform: "mp-weixin",
    cwd: process.cwd(),
    projectPath: process.cwd(),
    version: "1.0.0",
    desc: "测试描述",
    packageJson: {},
    platformConfig: {
      appid: "wx-appid",
      privateKeyPath: "missing-private-key.key",
    },
    ...overrides,
  };
}

describe("WeappCI", () => {
  test("fails when private key path is missing", async () => {
    const ci = new WeappCI(createWeappConfig());

    await expect(ci.init()).rejects.toThrow("mp-weixin.privateKeyPath");
  });
});
```

- [ ] **Step 2: Run platform test to verify it fails**

Run:

```bash
pnpm test tests/platform-preflight.test.ts
```

Expected: FAIL because the minimal `WeappCI` does not validate private key path.

- [ ] **Step 3: Implement WeappCI**

Replace `src/ci/WeappCI.ts` with a CLI-adapted version of `_temp/src/WeappCI.ts`. Use `this.config.platformConfig` typed as `WeappConfig`, `this.config.cwd` instead of `ctx.paths.appPath`, `this.config.projectPath` instead of `this.projectPath`, and `getNpmPkgSync('miniprogram-ci', this.config.cwd)`.

Key implementation rules:

```ts
import crypto from "node:crypto";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import shell from "shelljs";
import { BaseCI } from "./BaseCI";
import { getNpmPkgSync } from "../utils/npm";
import {
  generateQrcodeImageFile,
  printQrcode2Terminal,
  readQrcodeImageContent,
} from "../utils/qrcode";

import type { WeappConfig } from "../types";

export class WeappCI extends BaseCI {
  private instance: unknown;
  private ci: any;
  private devToolsInstallPath = "";

  async init(): Promise<void> {
    const weappConfig = this.config.platformConfig as WeappConfig;

    try {
      this.ci = getNpmPkgSync("miniprogram-ci", this.config.cwd);
    } catch {
      throw new Error("当前平台 mp-weixin 需要安装依赖：miniprogram-ci");
    }

    this.devToolsInstallPath =
      weappConfig.devToolsInstallPath ||
      (process.platform === "darwin"
        ? "/Applications/wechatwebdevtools.app"
        : "C:\\Program Files (x86)\\Tencent\\微信web开发者工具");

    const privateKeyPath = path.isAbsolute(weappConfig.privateKeyPath)
      ? weappConfig.privateKeyPath
      : path.join(this.config.cwd, weappConfig.privateKeyPath);

    if (!this.pathExistsSync(privateKeyPath)) {
      throw new Error(`mp-weixin.privateKeyPath 路径不存在：${privateKeyPath}`);
    }

    this.instance = new this.ci.Project({
      type: weappConfig.type || "miniProgram",
      projectPath: this.config.projectPath,
      appid: weappConfig.appid,
      privateKeyPath,
      ignores: weappConfig.ignores,
    });
  }

  private pathExistsSync(filePath: string): boolean {
    return existsSync(filePath);
  }
}
```

Port `open()`, `preview()`, and `upload()` from `_temp/src/WeappCI.ts` into `src/ci/WeappCI.ts` with these exact substitutions: replace `this.ctx.helper.printLog` calls with direct `console.log` or thrown errors, replace `this.projectPath` with `this.config.projectPath`, replace `this.version` with `this.config.version`, replace `this.desc` with `this.config.desc`, replace `this.pluginOpts.weapp` with `this.config.platformConfig as WeappConfig`, replace `this.triggerPreviewHooks(...)` and `this.triggerUploadHooks(...)` with `return this.createResult(...)`. On preview and upload success, return `this.createResult(true, { qrCodeContent, qrCodeLocalPath })`; on SDK failure, throw an `Error` containing `mp-weixin preview 执行失败` or `mp-weixin upload 执行失败`.

- [ ] **Step 4: Run platform preflight tests**

Run:

```bash
pnpm test tests/platform-preflight.test.ts
```

Expected: PASS for private key path error. If dependency resolution runs before private key validation, adjust test to create a dummy key and add a dependency-missing test instead.

- [ ] **Step 5: Commit after user authorization**

Only after explicit git authorization, run:

```bash
git add src/ci/WeappCI.ts tests/platform-preflight.test.ts
git commit -m "feat: add weixin ci adapter"
```

## Task 10: Alipay And JD Platform Adapters

**Files:**

- Replace: `src/ci/AlipayCI.ts`
- Replace: `src/ci/JdCI.ts`
- Test: `tests/platform-preflight.test.ts`

- [ ] **Step 1: Add Alipay and JD preflight tests**

Append:

```ts
import { AlipayCI } from "../src/ci/AlipayCI";
import { JdCI } from "../src/ci/JdCI";

test("AlipayCI fails when private key path is missing", async () => {
  const ci = new AlipayCI({
    operation: "upload",
    platform: "mp-alipay",
    cwd: process.cwd(),
    projectPath: process.cwd(),
    version: "1.0.0",
    desc: "测试描述",
    packageJson: {},
    platformConfig: {
      appid: "ali-appid",
      toolId: "tool-id",
      privateKeyPath: "missing-private-key.pem",
    },
  });

  await expect(ci.init()).rejects.toThrow("mp-alipay.privateKeyPath");
});

test("JdCI reports missing optional dependency", async () => {
  const ci = new JdCI({
    operation: "upload",
    platform: "mp-jd",
    cwd: process.cwd(),
    projectPath: process.cwd(),
    version: "1.0.0",
    desc: "测试描述",
    packageJson: {},
    platformConfig: {
      privateKey: "jd-private-key",
    },
  });

  await expect(ci.init()).rejects.toThrow("jd-miniprogram-ci");
});
```

- [ ] **Step 2: Run tests to verify they fail against minimal classes**

Run:

```bash
pnpm test tests/platform-preflight.test.ts
```

Expected: FAIL because the minimal classes do not validate.

- [ ] **Step 3: Implement AlipayCI**

Adapt `_temp/src/AlipayCI.ts`:

- Load `minidev` with `getNpmPkgSync('minidev', this.config.cwd)`.
- Resolve `privateKeyPath` relative to `this.config.cwd`.
- Support direct `privateKey`.
- Use `compareVersion()` for upload version check.
- Return `MiniCIResult` instead of triggering hooks.
- Throw `当前平台 mp-alipay 需要安装依赖：minidev` when missing.

- [ ] **Step 4: Implement JdCI**

Adapt `_temp/src/JdCI.ts`:

- Load `jd-miniprogram-ci` with `getNpmPkgSync('jd-miniprogram-ci', this.config.cwd)`.
- Use `privateKey`, `robot`, and `ignores` from `JdConfig`.
- Use `this.config.projectPath`, `this.config.version`, and `this.config.desc`.
- Return result objects for preview and upload.
- `open()` should warn and return `this.createResult(true)`.

- [ ] **Step 5: Run platform tests**

Run:

```bash
pnpm test tests/platform-preflight.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit after user authorization**

Only after explicit git authorization, run:

```bash
git add src/ci/AlipayCI.ts src/ci/JdCI.ts tests/platform-preflight.test.ts
git commit -m "feat: add alipay and jd ci adapters"
```

## Task 11: Baidu And Toutiao Platform Adapters

**Files:**

- Replace: `src/ci/SwanCI.ts`
- Replace: `src/ci/TTCI.ts`
- Test: `tests/platform-preflight.test.ts`

- [ ] **Step 1: Add Baidu and Toutiao preflight tests**

Append:

```ts
import { SwanCI } from "../src/ci/SwanCI";
import { TTCI } from "../src/ci/TTCI";

test("SwanCI reports missing optional dependency", async () => {
  const ci = new SwanCI({
    operation: "upload",
    platform: "mp-baidu",
    cwd: process.cwd(),
    projectPath: process.cwd(),
    version: "1.0.0",
    desc: "测试描述",
    packageJson: {},
    platformConfig: {
      token: "swan-token",
    },
  });

  await expect(ci.init()).rejects.toThrow("swan-toolkit");
});

test("TTCI reports missing optional dependency", async () => {
  const ci = new TTCI({
    operation: "upload",
    platform: "mp-toutiao",
    cwd: process.cwd(),
    projectPath: process.cwd(),
    version: "1.0.0",
    desc: "测试描述",
    packageJson: {},
    platformConfig: {
      email: "user@example.com",
      password: "password",
    },
  });

  await expect(ci.init()).rejects.toThrow("tt-ide-cli");
});
```

- [ ] **Step 2: Run tests to verify they fail against minimal classes**

Run:

```bash
pnpm test tests/platform-preflight.test.ts
```

Expected: FAIL because the minimal classes do not validate.

- [ ] **Step 3: Implement SwanCI**

Adapt `_temp/src/SwanCI.ts`:

- Resolve CLI with `resolveNpmSync('swan-toolkit/bin/swan', this.config.cwd)`.
- Use `shell.exec` wrapped in `Promise` so `preview()` and `upload()` await completion.
- Use `mp-baidu` in error messages and `swan` only where SDK output requires it.
- `open()` should use `devToolsInstallPath` from `SwanConfig`.
- Generate QR code image paths under `this.config.projectPath`.

- [ ] **Step 4: Implement TTCI**

Adapt `_temp/src/TTCI.ts`:

- Load `tt-ide-cli` with `getNpmPkgSync('tt-ide-cli', this.config.cwd)`.
- Keep login in a private `beforeCheck()` method.
- Use `this.config.projectPath`, `version`, and `desc`.
- Return result objects for preview and upload.
- Throw `当前平台 mp-toutiao 需要安装依赖：tt-ide-cli` when missing.

- [ ] **Step 5: Run platform tests**

Run:

```bash
pnpm test tests/platform-preflight.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit after user authorization**

Only after explicit git authorization, run:

```bash
git add src/ci/SwanCI.ts src/ci/TTCI.ts tests/platform-preflight.test.ts
git commit -m "feat: add baidu and toutiao ci adapters"
```

## Task 12: README And End-To-End Verification

**Files:**

- Modify: `README.md`
- Test: all tests and build

- [ ] **Step 1: Update README**

Replace starter README content with:

````md
# uni-mini-ci-cli

`uni-mini-ci-cli` 是一个面向 uniapp 小程序构建产物的持续集成 CLI。它参考 Taro `@tarojs/plugin-mini-ci` 的平台实现，在 `uni build -p <platform>` 完成后执行打开开发者工具、上传开发版预览、上传体验版等动作。

## 安装

```bash
pnpm add -D uni-mini-ci-cli
```
````

按平台安装对应 SDK：

```bash
pnpm add -D miniprogram-ci
pnpm add -D minidev
pnpm add -D jd-miniprogram-ci
pnpm add -D swan-toolkit
pnpm add -D tt-ide-cli
```

## 配置

创建 `minici.config.ts`：

```ts
import { defineConfig } from "uni-mini-ci-cli";

export default defineConfig({
  version: "1.0.0",
  desc: ({ platform, version }) => `${platform} ${version} 自动构建`,
  projectPath: "dist/build/mp-weixin",
  "mp-weixin": {
    appid: "微信小程序 appid",
    privateKeyPath: "key/private.key",
    robot: 1,
  },
});
```

## 命令

```bash
minici --open --platform mp-weixin
minici --preview --platform mp-weixin
minici --upload --platform mp-weixin --projectPath dist/build/mp-weixin
```

支持的平台：

- `mp-weixin`
- `mp-alipay`
- `mp-baidu`
- `mp-jd`
- `mp-toutiao`

参数优先级：

```txt
命令行参数 > minici.config > package.json > 自动默认值
```

## 与 uniapp 脚本配合

```json
{
  "scripts": {
    "build:mp-weixin": "uni build -p mp-weixin",
    "ci:mp-weixin": "minici --upload --platform mp-weixin --projectPath dist/build/mp-weixin"
  }
}
```

````

- [ ] **Step 2: Run all tests**

Run:

```bash
pnpm test
````

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:

```bash
pnpm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Run build**

Run:

```bash
pnpm run build
```

Expected: PASS and `dist/cli.mjs` plus `dist/index.mjs` are generated.

- [ ] **Step 5: Smoke test CLI help or validation**

Run:

```bash
node dist/cli.mjs upload --platform mp-weixin --projectPath missing-dist
```

Expected: exits with code `1` and prints `projectPath 不存在`.

- [ ] **Step 6: Commit after user authorization**

Only after explicit git authorization, run:

```bash
git add README.md
git commit -m "docs: document minici cli usage"
```

## Self-Review

- Spec coverage: the plan covers CLI bin,互斥操作参数, c12 config, zod validation, uniapp platform keys, `desc` string/function support, platform mapping, optional peer dependencies, runtime context, error handling, tests, and README.
- Scope check: the plan excludes `minici run`, Taro hooks, DingTalk, JSON output, and real SDK network integration tests, matching the spec.
- Placeholder scan: no task uses unresolved placeholders; platform migration tasks point to exact source files in `_temp/src` and exact target files in `src/ci`.
- Type consistency: shared names are `MiniCIOperation`, `MiniCIPlatform`, `MiniCIConfig`, `NormalizedMiniCIConfig`, `MiniCIResult`, and the same names are used across tasks.
