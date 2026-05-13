# vite-plugin-uni-mini-ci Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Vite plugin export `uniMiniCI()` while keeping the existing `minici` CLI behavior intact.

**Architecture:** Split the current CLI-only execution path into a shared CI runner and two adapters. The CLI adapter keeps parsing argv and loading `minici.config`; the Vite adapter parses only `--open | --preview | --upload`, reads `UNI_PLATFORM` and `UNI_OUTPUT_DIR`, and calls the shared runner.

**Tech Stack:** TypeScript ESM, Vite plugin API, Vitest, c12, zod, cac, minimist, tsdown.

---

## File Structure

- Modify `package.json`: add `minimist`, `@types/minimist`, and `vite` peer/dev dependencies.
- Modify `src/types.ts`: add plugin option and shared runner input types.
- Create `src/runMiniCIWithConfig.ts`: hold the shared runner used by CLI and Vite plugin.
- Modify `src/index.ts`: re-export shared runner, keep current CLI API, and export plugin API.
- Create `src/plugin/parsePluginArgs.ts`: parse plugin operation from `process.argv`.
- Create `src/plugin/uniMiniCI.ts`: implement Vite plugin hooks.
- Modify `tests/index.test.ts`: assert `uniMiniCI` is exported and typed.
- Create `tests/plugin-args.test.ts`: cover plugin argv parsing.
- Create `tests/plugin.test.ts`: cover Vite plugin execution behavior with mocked CI.
- Modify `README.md`: document Vite plugin usage and command forms.

## Task 1: Add Dependencies

**Files:**

- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Add dependency entries**

Edit `package.json` so the dependency sections include:

```json
{
  "dependencies": {
    "minimist": "^1.2.8"
  },
  "devDependencies": {
    "@types/minimist": "^1.2.5",
    "vite": "^7.3.1"
  },
  "peerDependencies": {
    "vite": "^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0"
  },
  "peerDependenciesMeta": {
    "vite": {
      "optional": true
    }
  }
}
```

Keep all existing dependencies, devDependencies, peerDependencies, and optional peer entries.

- [ ] **Step 2: Install dependencies**

Run:

```bash
pnpm install
```

Expected: `pnpm-lock.yaml` updates successfully. If the sandbox blocks network access, rerun the same command with escalated permissions.

- [ ] **Step 3: Verify package metadata parses**

Run:

```bash
node -e "const pkg=require('./package.json'); console.log(pkg.dependencies.minimist, pkg.peerDependencies.vite)"
```

Expected: prints the installed minimist range and the Vite peer range.

- [ ] **Step 4: Commit only with authorization**

Do not commit automatically. If the user explicitly authorizes Git commits, run:

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add vite plugin dependencies"
```

## Task 2: Extract Shared Runner

**Files:**

- Modify: `src/types.ts`
- Create: `src/runMiniCIWithConfig.ts`
- Modify: `src/index.ts`
- Test: `tests/runner.test.ts`

- [ ] **Step 1: Add shared runner type**

In `src/types.ts`, add this interface after `CliOptions`:

```ts
/** 共享 minici 执行入口选项 */
export interface RunMiniCIWithConfigOptions {
  /** 已解析的运行参数 */
  args: ParsedCliArgs;
  /** 当前工作目录 */
  cwd: string;
  /** 已加载或直接传入的 minici 配置 */
  config: MiniCIConfig;
}
```

- [ ] **Step 2: Export the type**

In `src/index.ts`, extend the existing type export block:

```ts
export type { RunMiniCIWithConfigOptions } from "./types";
```

If the file is using a grouped `export { type ... } from "./types";` block, add `type RunMiniCIWithConfigOptions` to that existing block instead of creating a second export.

- [ ] **Step 3: Add shared runner implementation**

Create `src/runMiniCIWithConfig.ts`:

```ts
import { access } from "node:fs/promises";
import { createCI } from "./ci/registry";
import { loadPackageJson } from "./config/loadConfig";
import { normalizeConfig } from "./config/normalize";

import type { MiniCIResult, RunMiniCIWithConfigOptions } from "./types";

/**
 * 校验项目产物目录是否存在。
 *
 * @param projectPath 项目产物目录绝对路径
 */
async function assertPathExists(projectPath: string): Promise<void> {
  try {
    await access(projectPath);
  } catch {
    throw new Error(`projectPath 不存在：${projectPath}`);
  }
}

/**
 * 使用已解析参数和显式配置运行 minici 流程。
 *
 * @param options 共享执行入口选项
 * @returns minici 执行结果
 */
export async function runMiniCIWithConfig(
  options: RunMiniCIWithConfigOptions,
): Promise<MiniCIResult> {
  const packageJson = await loadPackageJson(options.cwd);
  const normalized = await normalizeConfig({
    args: options.args,
    cwd: options.cwd,
    config: options.config,
    packageJson,
  });

  await assertPathExists(normalized.projectPath);

  const ci = createCI(normalized);
  await ci.init();
  return ci[normalized.operation]();
}
```

Update `src/index.ts` so `runMiniCI()` delegates:

```ts
import { parseCliArgs } from "./command/parseArgs";
import { loadMiniCIConfig } from "./config/loadConfig";
import { runMiniCIWithConfig } from "./runMiniCIWithConfig";

import type { CliOptions, MiniCIResult } from "./types";

export async function runMiniCI(options: CliOptions): Promise<MiniCIResult> {
  const args = parseCliArgs(options.argv);
  const cwd = args.cwd || options.cwd || process.cwd();
  const config = await loadMiniCIConfig({ cwd, config: args.config });

  return runMiniCIWithConfig({
    args,
    cwd,
    config,
  });
}
```

Remove now-unused imports from `src/index.ts`: `access`, `createCI`, `loadPackageJson`, and `normalizeConfig`.

Add this export in `src/index.ts`:

```ts
export { runMiniCIWithConfig } from "./runMiniCIWithConfig";
```

- [ ] **Step 4: Run existing runner tests**

Run:

```bash
pnpm test tests/runner.test.ts
```

Expected: all existing `runMiniCI` tests pass, proving CLI behavior still delegates correctly.

- [ ] **Step 5: Run typecheck**

Run:

```bash
pnpm run typecheck
```

Expected: TypeScript reports no new errors from the shared runner extraction.

- [ ] **Step 6: Commit only with authorization**

Do not commit automatically. If the user explicitly authorizes Git commits, run:

```bash
git add src/types.ts src/runMiniCIWithConfig.ts src/index.ts tests/runner.test.ts
git commit -m "refactor: share minici execution runner"
```

## Task 3: Parse Vite Plugin Operation Args

**Files:**

- Create: `src/plugin/parsePluginArgs.ts`
- Create: `tests/plugin-args.test.ts`

- [ ] **Step 1: Write failing parser tests**

Create `tests/plugin-args.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { parsePluginArgs } from "../src/plugin/parsePluginArgs";

describe("parsePluginArgs", () => {
  test("没有透传分隔符时跳过", () => {
    expect(parsePluginArgs(["uni", "build", "-p", "mp-weixin"])).toEqual({ operation: undefined });
  });

  test("透传分隔符后没有操作时跳过", () => {
    expect(parsePluginArgs(["uni", "build", "-p", "mp-weixin", "--"])).toEqual({
      operation: undefined,
    });
  });

  test("解析 upload 操作", () => {
    expect(parsePluginArgs(["uni", "build", "-p", "mp-weixin", "--", "--upload"])).toEqual({
      operation: "upload",
    });
  });

  test("解析 open 操作", () => {
    expect(parsePluginArgs(["uni", "dev", "-p", "mp-weixin", "--", "--open"])).toEqual({
      operation: "open",
    });
  });

  test("同时传入多个操作时报错", () => {
    expect(() =>
      parsePluginArgs(["uni", "build", "-p", "mp-weixin", "--", "--open", "--upload"]),
    ).toThrow("只能指定一个操作");
  });

  test("未知参数时报错", () => {
    expect(() =>
      parsePluginArgs(["uni", "build", "-p", "mp-weixin", "--", "--upload", "--version", "1.0.0"]),
    ).toThrow("Vite 插件模式暂不支持参数：--version");
  });
});
```

- [ ] **Step 2: Run parser tests to verify failure**

Run:

```bash
pnpm test tests/plugin-args.test.ts
```

Expected: FAIL because `src/plugin/parsePluginArgs.ts` does not exist.

- [ ] **Step 3: Implement parser**

Create `src/plugin/parsePluginArgs.ts`:

```ts
import minimist from "minimist";
import { supportedOperations } from "../types";

import type { MiniCIOperation } from "../types";

/** Vite 插件参数解析结果 */
export interface ParsedPluginArgs {
  /** 当前操作；未传操作时表示跳过插件执行 */
  operation?: MiniCIOperation;
}

/** Vite 插件模式支持的参数名 */
const allowedOptionNames = new Set(["open", "preview", "upload"]);

/**
 * 读取第一个透传分隔符后的插件参数。
 *
 * @param argv 完整进程参数或测试传入的参数数组
 * @returns 插件参数数组
 */
function readPluginArgv(argv: string[]): string[] {
  /** 透传分隔符位置 */
  const separatorIndex = argv.indexOf("--");

  if (separatorIndex < 0) {
    return [];
  }

  return argv.slice(separatorIndex + 1);
}

/**
 * 校验插件模式是否传入未知参数。
 *
 * @param options minimist 解析结果
 */
function assertKnownOptions(options: minimist.ParsedArgs): void {
  for (const optionName of Object.keys(options)) {
    if (optionName === "_") {
      continue;
    }

    if (!allowedOptionNames.has(optionName)) {
      throw new Error(`Vite 插件模式暂不支持参数：--${optionName}`);
    }
  }
}

/**
 * 解析 Vite 插件透传参数。
 *
 * @param argv 完整进程参数或测试传入的参数数组
 * @returns 已解析插件参数
 */
export function parsePluginArgs(argv: string[]): ParsedPluginArgs {
  /** 插件透传参数 */
  const pluginArgv = readPluginArgv(argv);

  if (pluginArgv.length === 0) {
    return { operation: undefined };
  }

  /** minimist 解析结果 */
  const options = minimist(pluginArgv, {
    boolean: [...supportedOperations],
    string: [],
    alias: {},
    "--": false,
  });

  if (options._.length > 0) {
    throw new Error(`Vite 插件模式暂不支持位置参数：${options._.join(" ")}`);
  }

  assertKnownOptions(options);

  /** 已传入操作列表 */
  const operations = supportedOperations.filter((operation) => options[operation] === true);

  if (operations.length === 0) {
    return { operation: undefined };
  }

  if (operations.length > 1) {
    throw new Error("只能指定一个操作：--open、--preview、--upload");
  }

  return {
    operation: operations[0],
  };
}
```

- [ ] **Step 4: Run parser tests**

Run:

```bash
pnpm test tests/plugin-args.test.ts
```

Expected: all parser tests pass.

- [ ] **Step 5: Commit only with authorization**

Do not commit automatically. If the user explicitly authorizes Git commits, run:

```bash
git add src/plugin/parsePluginArgs.ts tests/plugin-args.test.ts
git commit -m "feat: parse vite plugin operation args"
```

## Task 4: Implement Vite Plugin

**Files:**

- Create: `src/plugin/uniMiniCI.ts`
- Modify: `src/types.ts`
- Modify: `src/index.ts`
- Create: `tests/plugin.test.ts`

- [ ] **Step 1: Add plugin option type**

In `src/types.ts`, add after `MiniCIConfig`:

```ts
/** Vite 插件配置结构 */
export interface UniMiniCIPluginOptions extends MiniCIConfig {}
```

- [ ] **Step 2: Write failing plugin tests**

Create `tests/plugin.test.ts`:

```ts
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { uniMiniCI } from "../src/plugin/uniMiniCI";

import type { Plugin, ResolvedConfig, ViteDevServer } from "vite";

const calls: Array<{ method: string; projectPath: string; platform: string }> = [];
const originalArgv = process.argv;
const originalUniPlatform = process.env.UNI_PLATFORM;
const originalUniOutputDir = process.env.UNI_OUTPUT_DIR;
const tempDirs: string[] = [];

vi.mock("../src/ci/registry", () => ({
  createCI: (config: any) => ({
    init: vi.fn(),
    open: vi.fn().mockImplementation(() => {
      calls.push({
        method: "open",
        projectPath: config.projectPath,
        platform: config.platform,
      });
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
      calls.push({
        method: "preview",
        projectPath: config.projectPath,
        platform: config.platform,
      });
      return {
        success: true,
        operation: config.operation,
        platform: config.platform,
        version: config.version,
        desc: config.desc,
        projectPath: config.projectPath,
      };
    }),
    upload: vi.fn().mockImplementation(() => {
      calls.push({
        method: "upload",
        projectPath: config.projectPath,
        platform: config.platform,
      });
      return {
        success: true,
        operation: config.operation,
        platform: config.platform,
        version: config.version,
        desc: config.desc,
        projectPath: config.projectPath,
      };
    }),
  }),
}));

async function createProject(command: "build" | "serve") {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "minici-plugin-"));
  const outputDir = path.join(
    cwd,
    command === "build" ? "dist/build/mp-weixin" : "dist/dev/mp-weixin",
  );
  tempDirs.push(cwd);
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(cwd, "package.json"), JSON.stringify({ version: "1.0.0" }));
  return { cwd, outputDir };
}

function createResolvedConfig(root: string, command: "build" | "serve"): ResolvedConfig {
  return {
    root,
    command,
  } as ResolvedConfig;
}

async function runBuildPlugin(plugin: Plugin, root: string) {
  if (typeof plugin.configResolved === "function") {
    await plugin.configResolved(createResolvedConfig(root, "build"));
  }

  if (typeof plugin.closeBundle === "function") {
    await plugin.closeBundle();
  }
}

async function runServePlugin(plugin: Plugin, root: string) {
  if (typeof plugin.configResolved === "function") {
    await plugin.configResolved(createResolvedConfig(root, "serve"));
  }

  if (typeof plugin.configureServer === "function") {
    await plugin.configureServer({} as ViteDevServer);
  }
}

afterEach(async () => {
  calls.length = 0;
  process.argv = originalArgv;
  if (originalUniPlatform === undefined) {
    delete process.env.UNI_PLATFORM;
  } else {
    process.env.UNI_PLATFORM = originalUniPlatform;
  }
  if (originalUniOutputDir === undefined) {
    delete process.env.UNI_OUTPUT_DIR;
  } else {
    process.env.UNI_OUTPUT_DIR = originalUniOutputDir;
  }
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("uniMiniCI", () => {
  test("build 模式执行 upload", async () => {
    const { cwd, outputDir } = await createProject("build");
    process.argv = ["node", "uni", "build", "-p", "mp-weixin", "--", "--upload"];
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

    expect(calls).toEqual([{ method: "upload", projectPath: outputDir, platform: "mp-weixin" }]);
  });

  test("serve 模式执行 open", async () => {
    const { cwd, outputDir } = await createProject("serve");
    process.argv = ["node", "uni", "dev", "-p", "mp-weixin", "--", "--open"];
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

    expect(calls).toEqual([{ method: "open", projectPath: outputDir, platform: "mp-weixin" }]);
  });

  test("serve 模式拒绝 upload", async () => {
    const { cwd, outputDir } = await createProject("serve");
    process.argv = ["node", "uni", "dev", "-p", "mp-weixin", "--", "--upload"];
    process.env.UNI_PLATFORM = "mp-weixin";
    process.env.UNI_OUTPUT_DIR = outputDir;

    const plugin = uniMiniCI({
      "mp-weixin": {
        appid: "wx-appid",
        privateKeyPath: "key/private.key",
      },
    });

    await expect(runServePlugin(plugin, cwd)).rejects.toThrow("preview/upload 只支持 build 模式");
  });

  test("未传操作时跳过", async () => {
    const { cwd, outputDir } = await createProject("build");
    process.argv = ["node", "uni", "build", "-p", "mp-weixin"];
    process.env.UNI_PLATFORM = "mp-weixin";
    process.env.UNI_OUTPUT_DIR = outputDir;

    const plugin = uniMiniCI({
      "mp-weixin": {
        appid: "wx-appid",
        privateKeyPath: "key/private.key",
      },
    });

    await runBuildPlugin(plugin, cwd);

    expect(calls).toEqual([]);
  });

  test("options projectPath 优先于 UNI_OUTPUT_DIR", async () => {
    const { cwd, outputDir } = await createProject("build");
    const configuredProjectPath = path.join(cwd, "custom-output");
    await mkdir(configuredProjectPath, { recursive: true });
    process.argv = ["node", "uni", "build", "-p", "mp-weixin", "--", "--preview"];
    process.env.UNI_PLATFORM = "mp-weixin";
    process.env.UNI_OUTPUT_DIR = outputDir;

    const plugin = uniMiniCI({
      projectPath: configuredProjectPath,
      "mp-weixin": {
        appid: "wx-appid",
        privateKeyPath: "key/private.key",
      },
    });

    await runBuildPlugin(plugin, cwd);

    expect(calls).toEqual([
      { method: "preview", projectPath: configuredProjectPath, platform: "mp-weixin" },
    ]);
  });

  test("缺少 UNI_PLATFORM 时报错", async () => {
    const { cwd, outputDir } = await createProject("build");
    process.argv = ["node", "uni", "build", "-p", "mp-weixin", "--", "--upload"];
    delete process.env.UNI_PLATFORM;
    process.env.UNI_OUTPUT_DIR = outputDir;

    const plugin = uniMiniCI({
      "mp-weixin": {
        appid: "wx-appid",
        privateKeyPath: "key/private.key",
      },
    });

    await expect(runBuildPlugin(plugin, cwd)).rejects.toThrow("无法确定 platform");
  });

  test("缺少 projectPath 来源时报错", async () => {
    const { cwd } = await createProject("build");
    process.argv = ["node", "uni", "build", "-p", "mp-weixin", "--", "--upload"];
    process.env.UNI_PLATFORM = "mp-weixin";
    delete process.env.UNI_OUTPUT_DIR;

    const plugin = uniMiniCI({
      "mp-weixin": {
        appid: "wx-appid",
        privateKeyPath: "key/private.key",
      },
    });

    await expect(runBuildPlugin(plugin, cwd)).rejects.toThrow("无法确定 projectPath");
  });
});
```

- [ ] **Step 3: Run plugin tests to verify failure**

Run:

```bash
pnpm test tests/plugin.test.ts
```

Expected: FAIL because `src/plugin/uniMiniCI.ts` does not exist.

- [ ] **Step 4: Implement plugin**

Create `src/plugin/uniMiniCI.ts`:

```ts
import { parsePluginArgs } from "./parsePluginArgs";
import { isPlatform } from "../command/parseArgs";
import { runMiniCIWithConfig } from "../runMiniCIWithConfig";

import type { Plugin, ResolvedConfig } from "vite";
import type { MiniCIPlatform, UniMiniCIPluginOptions } from "../types";

/** Vite 插件名称 */
const pluginName = "vite-plugin-uni-mini-ci";

/**
 * 读取 uni 当前编译平台。
 *
 * @returns 已校验的平台
 */
function readUniPlatform(): MiniCIPlatform {
  /** uni 注入的平台环境变量 */
  const platform = process.env.UNI_PLATFORM;

  if (!platform) {
    throw new Error("无法确定 platform，请检查 UNI_PLATFORM");
  }

  if (!isPlatform(platform)) {
    throw new Error(
      `暂不支持平台：${platform}\n可选值：mp-weixin、mp-alipay、mp-baidu、mp-jd、mp-toutiao`,
    );
  }

  return platform;
}

/**
 * 读取插件模式下的项目产物目录。
 *
 * @param options 插件配置
 * @returns 项目产物目录
 */
function readProjectPath(options: UniMiniCIPluginOptions): string {
  /** 插件显式项目路径 */
  const configuredProjectPath = options.projectPath;

  if (configuredProjectPath) {
    return configuredProjectPath;
  }

  /** uni 注入的产物目录 */
  const outputDir = process.env.UNI_OUTPUT_DIR;

  if (!outputDir) {
    throw new Error(
      "无法确定 projectPath，请配置 uniMiniCI({ projectPath }) 或检查 UNI_OUTPUT_DIR",
    );
  }

  return outputDir;
}

/**
 * 创建 uni 小程序 CI Vite 插件。
 *
 * @param options 插件配置
 * @returns Vite 插件
 */
export function uniMiniCI(options: UniMiniCIPluginOptions): Plugin {
  /** 已解析 Vite 配置 */
  let resolvedConfig: ResolvedConfig | undefined;

  /**
   * 执行插件触发的 minici 操作。
   */
  async function runPluginOperation(): Promise<void> {
    /** 插件透传参数 */
    const pluginArgs = parsePluginArgs(process.argv);

    if (!pluginArgs.operation) {
      return;
    }

    if (resolvedConfig?.command === "serve" && pluginArgs.operation !== "open") {
      throw new Error("preview/upload 只支持 build 模式");
    }

    /** 当前平台 */
    const platform = readUniPlatform();
    /** 项目产物目录 */
    const projectPath = readProjectPath(options);

    await runMiniCIWithConfig({
      args: {
        operation: pluginArgs.operation,
        platform,
        projectPath,
      },
      cwd: resolvedConfig?.root || process.cwd(),
      config: options,
    });
  }

  return {
    name: pluginName,
    configResolved(config) {
      resolvedConfig = config;
    },
    async closeBundle() {
      if (resolvedConfig?.command !== "build") {
        return;
      }

      await runPluginOperation();
    },
    async configureServer() {
      if (resolvedConfig?.command !== "serve") {
        return;
      }

      await runPluginOperation();
    },
  };
}
```

- [ ] **Step 5: Export plugin from main entry**

In `src/index.ts`, add:

```ts
export { uniMiniCI } from "./plugin/uniMiniCI";
```

Add plugin option type to the existing type export block:

```ts
type UniMiniCIPluginOptions,
```

- [ ] **Step 6: Run plugin tests**

Run:

```bash
pnpm test tests/plugin.test.ts
```

Expected: all plugin tests pass.

- [ ] **Step 7: Run focused typecheck**

Run:

```bash
pnpm run typecheck
```

Expected: no TypeScript errors. If Vite type imports require type-only exports, keep Vite imports as `import type`.

- [ ] **Step 8: Commit only with authorization**

Do not commit automatically. If the user explicitly authorizes Git commits, run:

```bash
git add src/types.ts src/index.ts src/plugin/uniMiniCI.ts tests/plugin.test.ts
git commit -m "feat: add uni mini ci vite plugin"
```

## Task 5: Public API Tests

**Files:**

- Modify: `tests/index.test.ts`

- [ ] **Step 1: Add public export tests**

Append these tests to `tests/index.test.ts`:

```ts
test("exports uniMiniCI vite plugin factory", () => {
  const plugin = uniMiniCI({
    "mp-weixin": {
      appid: "wx-appid",
      privateKeyPath: "key/private.key",
    },
  });

  expect(plugin.name).toBe("vite-plugin-uni-mini-ci");
});

test("uniMiniCI options keep config shape types", () => {
  const plugin = uniMiniCI({
    version: "1.0.0",
    desc: ({ platform, version }) => {
      expectTypeOf(platform).toEqualTypeOf<
        "mp-weixin" | "mp-alipay" | "mp-baidu" | "mp-jd" | "mp-toutiao"
      >();
      expectTypeOf(version).toEqualTypeOf<string>();
      return `${platform}-${version}`;
    },
    "mp-weixin": {
      appid: "wx-appid",
      privateKeyPath: "key/private.key",
    },
  });

  expect(plugin.name).toBe("vite-plugin-uni-mini-ci");
});
```

Update the import line:

```ts
import { defineConfig, supportedOperations, supportedPlatforms, uniMiniCI } from "../src/index";
```

- [ ] **Step 2: Run public API tests**

Run:

```bash
pnpm test tests/index.test.ts
```

Expected: all public API tests pass.

- [ ] **Step 3: Run test typecheck**

Run:

```bash
pnpm run typecheck:test
```

Expected: type assertion tests compile.

- [ ] **Step 4: Commit only with authorization**

Do not commit automatically. If the user explicitly authorizes Git commits, run:

```bash
git add tests/index.test.ts
git commit -m "test: cover vite plugin public api"
```

## Task 6: README Documentation

**Files:**

- Modify: `README.md`

- [ ] **Step 1: Add Vite plugin section**

After the current “配置” section, add:

````md
## Vite 插件

如果项目已经通过 Vite 配置 uniapp 构建，可以直接在 `vite.config.ts` 中使用插件：

```ts
import { defineConfig } from "vite";
import { uniMiniCI } from "uni-mini-ci-cli";

export default defineConfig({
  plugins: [
    uniMiniCI({
      version: "1.0.0",
      desc: ({ platform, version }) => `${platform} ${version} 自动构建`,
      "mp-weixin": {
        appid: "微信小程序 appid",
        privateKeyPath: "key/private.key",
        robot: 1,
      },
    }),
  ],
});
```

插件模式下不读取 `minici.config.ts`。配置直接写在 `uniMiniCI(options)` 中。

通过 uni 命令透传参数触发操作：

```bash
uni build -p mp-weixin -- --upload
uni build -p mp-weixin -- --preview
uni build -p mp-weixin -- --open
uni dev -p mp-weixin -- --open
```

`--` 后只支持 `--open`、`--preview`、`--upload`。平台和产物目录由 uni 注入的 `UNI_PLATFORM`、`UNI_OUTPUT_DIR` 提供；如果需要覆盖产物目录，可以配置 `uniMiniCI({ projectPath: "..." })`。
````

- [ ] **Step 2: Add source distinction**

In the existing “参数优先级” area, add:

````md
CLI 模式读取 `minici.config.ts`：

```txt
命令行参数 > minici.config > package.json > 自动默认值
```

Vite 插件模式读取 `uniMiniCI(options)`：

```txt
插件操作参数 > uniMiniCI(options) > package.json > 自动默认值
```
````

- [ ] **Step 3: Run markdown smoke check**

Run:

```bash
rg -n "uniMiniCI|UNI_PLATFORM|UNI_OUTPUT_DIR|uni dev -p mp-weixin -- --open" README.md
```

Expected: all four topics are present.

- [ ] **Step 4: Commit only with authorization**

Do not commit automatically. If the user explicitly authorizes Git commits, run:

```bash
git add README.md
git commit -m "docs: document vite plugin usage"
```

## Task 7: Full Verification

**Files:**

- Verify all modified source, tests, docs, and lockfile.

- [ ] **Step 1: Run plugin test suite**

Run:

```bash
pnpm test tests/plugin-args.test.ts tests/plugin.test.ts tests/index.test.ts
```

Expected: all plugin and public API tests pass.

- [ ] **Step 2: Run existing focused suites**

Run:

```bash
pnpm test tests/command.test.ts tests/config.test.ts tests/runner.test.ts
```

Expected: existing CLI, config, and runner behavior still passes.

- [ ] **Step 3: Run all tests**

Run:

```bash
pnpm test
```

Expected: all Vitest suites pass.

- [ ] **Step 4: Run type checks**

Run:

```bash
pnpm run typecheck
pnpm run typecheck:test
```

Expected: both TypeScript checks pass.

- [ ] **Step 5: Run build**

Run:

```bash
pnpm run build
```

Expected: `dist/index.mjs`, `dist/cli.mjs`, and declaration files are generated successfully.

- [ ] **Step 6: Run lint and format check**

Run:

```bash
pnpm run lint
pnpm run fmt:check
```

Expected: no lint or formatting errors.

- [ ] **Step 7: Final Git commit only with authorization**

Do not commit automatically. If the user explicitly authorizes Git commits after all verification passes, run:

```bash
git add package.json pnpm-lock.yaml src tests README.md docs/superpowers/specs/2026-05-13-vite-plugin-uni-mini-ci-design.md docs/superpowers/plans/2026-05-13-vite-plugin-uni-mini-ci.md
git commit -m "feat: add uni mini ci vite plugin"
```
