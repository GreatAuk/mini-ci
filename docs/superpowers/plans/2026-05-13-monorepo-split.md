# uni-mini-ci Monorepo Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the current single-package project into a pnpm monorepo with `uni-mini-ci-core`, `uni-mini-ci-cli`, and `vite-plugin-uni-mini-ci`.

**Architecture:** Move shared runtime, platform CI, config normalization, tools, and shared types into `packages/core`. Keep CLI-specific argv parsing, config file loading, `defineConfig()`, and bin entry in `packages/cli`; keep Vite lifecycle and plugin argv parsing in `packages/vite-plugin`. The root package becomes a private workspace orchestrator only.

**Tech Stack:** TypeScript ESM, pnpm workspace, tsdown, Vitest, c12, zod, cac, minimist, Vite plugin API, oxlint, oxfmt.

---

## File Structure

- Create `pnpm-workspace.yaml`: declare `packages/*` workspaces.
- Modify `package.json`: convert root package to private workspace orchestrator.
- Create `tsconfig.base.json`: shared compiler options.
- Create `packages/core/package.json`: publish `uni-mini-ci-core`.
- Create `packages/core/tsconfig.json`, `packages/core/tsconfig.test.json`, `packages/core/tsdown.config.ts`.
- Move to `packages/core/src`: `types.ts`, `runMiniCIWithConfig.ts`, `config/schema.ts`, `config/normalize.ts`, `runtime/*`, `ci/*`, `utils/*`.
- Create `packages/core/src/index.ts`: shared public API.
- Move to `packages/core/tests`: `config.test.ts`, `runner.test.ts`, `runtime.test.ts`, `platform-preflight.test.ts`, `ci-base.test.ts`, `utils.test.ts`.
- Create `packages/cli/package.json`: publish `uni-mini-ci-cli` with bin `minici`.
- Create `packages/cli/tsconfig.json`, `packages/cli/tsconfig.test.json`, `packages/cli/tsdown.config.ts`.
- Move to `packages/cli/src`: `cli.ts`, `index.ts`, `command/parseArgs.ts`, `config/loadConfig.ts`.
- Move to `packages/cli/tests`: `command.test.ts`, `index.test.ts`.
- Create `packages/vite-plugin/package.json`: publish `vite-plugin-uni-mini-ci`.
- Create `packages/vite-plugin/tsconfig.json`, `packages/vite-plugin/tsconfig.test.json`, `packages/vite-plugin/tsdown.config.ts`.
- Move to `packages/vite-plugin/src`: `parsePluginArgs.ts`, `uniMiniCI.ts`.
- Create `packages/vite-plugin/src/index.ts`: plugin public API.
- Move to `packages/vite-plugin/tests`: `plugin-args.test.ts`, `plugin.test.ts`.
- Modify `README.md`, `docs/cli.md`, `docs/vite-plugin.md`: document package split and new plugin import.

## Task 1: Workspace Skeleton

**Files:**

- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Modify: `package.json`

- [ ] **Step 1: Create workspace declaration**

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - "packages/*"
```

- [ ] **Step 2: Create shared TypeScript config**

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "esnext",
    "lib": ["es2023"],
    "moduleDetection": "force",
    "module": "preserve",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "types": ["node"],
    "strict": true,
    "noUnusedLocals": true,
    "declaration": true,
    "emitDeclarationOnly": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true
  }
}
```

- [ ] **Step 3: Convert root package to private workspace root**

Replace the root `package.json` package identity, bin, exports, files, dependencies, peer dependencies, and publish metadata with root-only workspace metadata. Preserve existing useful repo metadata such as `description`, `license`, `author`, `repository`, `homepage`, and `bugs`.

The resulting root `package.json` must include:

```json
{
  "name": "uni-mini-ci",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*"],
  "scripts": {
    "build": "pnpm -r --if-present run build",
    "dev": "pnpm -r --if-present run dev",
    "test": "pnpm -r --if-present run test",
    "typecheck": "pnpm -r --if-present run typecheck",
    "typecheck:test": "pnpm -r --if-present run typecheck:test",
    "lint": "pnpm -r --if-present run lint",
    "lint:fix": "pnpm -r --if-present run lint:fix",
    "fmt": "pnpm -r --if-present run fmt",
    "fmt:check": "pnpm -r --if-present run fmt:check"
  },
  "devDependencies": {
    "@types/minimist": "^1.2.5",
    "@types/node": "^25.6.2",
    "@types/qrcode": "^1.5.6",
    "@types/resolve": "^1.20.6",
    "@types/shelljs": "^0.10.0",
    "@typescript/native-preview": "7.0.0-dev.20260509.2",
    "bumpp": "^11.1.0",
    "oxfmt": "^0.49.0",
    "oxlint": "^1.64.0",
    "tsdown": "^0.22.0",
    "typescript": "^6.0.3",
    "vite": "^7.3.1",
    "vitest": "^4.1.5"
  }
}
```

Do not keep root `bin`, root `exports`, root `files`, root `dependencies`, root `peerDependencies`, or root `peerDependenciesMeta`.

- [ ] **Step 4: Verify root metadata parses**

Run:

```bash
node -e "const pkg=require('./package.json'); console.log(pkg.private, pkg.workspaces.join(','))"
```

Expected: prints `true packages/*`.

- [ ] **Step 5: Defer commit until authorization**

Do not run Git commands yet. If the user explicitly authorizes commits later, use:

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json
git commit -m "chore: create monorepo workspace root"
```

## Task 2: Core Package Metadata And Public API

**Files:**

- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/tsconfig.test.json`
- Create: `packages/core/tsdown.config.ts`
- Create: `packages/core/src/index.ts`
- Move: `src/types.ts` -> `packages/core/src/types.ts`
- Test: `packages/core/tests/index.test.ts`

- [ ] **Step 1: Create package directories**

Run:

```bash
mkdir -p packages/core/src packages/core/tests
```

Expected: directories exist.

- [ ] **Step 2: Create core package metadata**

Create `packages/core/package.json`:

```json
{
  "name": "uni-mini-ci-core",
  "version": "0.0.0",
  "description": "Shared mini program CI runtime for uni-mini-ci packages.",
  "license": "MIT",
  "author": "greatauk11@gmail.com",
  "type": "module",
  "files": ["dist"],
  "exports": {
    ".": {
      "types": "./dist/index.d.mts",
      "import": "./dist/index.mjs"
    },
    "./package.json": "./package.json"
  },
  "scripts": {
    "build": "tsdown",
    "dev": "tsdown --watch",
    "test": "vitest",
    "typecheck": "tsc --noEmit",
    "typecheck:test": "tsc --noEmit -p tsconfig.test.json",
    "lint": "oxlint",
    "lint:fix": "oxlint --fix",
    "fmt": "oxfmt",
    "fmt:check": "oxfmt --check",
    "prepublishOnly": "pnpm run build"
  },
  "dependencies": {
    "axios": "^1.6.8",
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
    "jd-miniprogram-ci": { "optional": true },
    "minidev": { "optional": true },
    "miniprogram-ci": { "optional": true },
    "swan-toolkit": { "optional": true },
    "tt-ide-cli": { "optional": true }
  }
}
```

- [ ] **Step 3: Create core TypeScript configs**

Create `packages/core/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

Create `packages/core/tsconfig.test.json`:

```json
{
  "extends": "./tsconfig.json",
  "include": ["src", "tests"]
}
```

- [ ] **Step 4: Create core tsdown config**

Create `packages/core/tsdown.config.ts`:

```ts
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
  },
  dts: {
    tsgo: true,
  },
  exports: true,
});
```

- [ ] **Step 5: Move shared types**

Move `src/types.ts` to `packages/core/src/types.ts`.

Then edit `packages/core/src/types.ts` and remove these entry-layer-only declarations from core:

```ts
export interface CliOptions {
  /** 命令参数 */
  argv: string[];
  /** 当前工作目录 */
  cwd?: string;
  /** 是否直接退出进程 */
  exitProcess?: boolean;
}

export interface UniMiniCIPluginOptions extends MiniCIConfig {}
```

Keep these shared declarations in core:

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

export interface RunMiniCIWithConfigOptions {
  /** 已解析的运行参数 */
  args: ParsedCliArgs;
  /** 当前工作目录 */
  cwd: string;
  /** 已加载或直接传入的 minici 配置 */
  config: MiniCIConfig;
}
```

Keep `ParsedCliArgs` in core for now because `runMiniCIWithConfig()` consumes the normalized entry input from both CLI and plugin.

- [ ] **Step 6: Create core public API**

Create `packages/core/src/index.ts`:

```ts
export { runMiniCIWithConfig } from "./runMiniCIWithConfig";
export {
  supportedOperations,
  supportedPlatforms,
  type AlipayClientType,
  type AlipayConfig,
  type JdConfig,
  type MiniCIConfig,
  type MiniCIDescContext,
  type MiniCIDescFunction,
  type MiniCIOperation,
  type MiniCIPlatform,
  type MiniCIResult,
  type NormalizedMiniCIConfig,
  type NormalizedMiniCIConfigBase,
  type ParsedCliArgs,
  type PlatformConfigMap,
  type ProjectType,
  type RunMiniCIWithConfigOptions,
  type SwanConfig,
  type TTConfig,
  type WeappConfig,
} from "./types";
```

- [ ] **Step 7: Write core API smoke test**

Create `packages/core/tests/index.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { supportedOperations, supportedPlatforms } from "../src/index";

describe("core public api", () => {
  test("exports supported operations", () => {
    expect(supportedOperations).toEqual(["open", "preview", "upload"]);
  });

  test("exports supported platforms", () => {
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

- [ ] **Step 8: Run core API test**

Run:

```bash
pnpm --filter uni-mini-ci-core test tests/index.test.ts
```

Expected: fails until `runMiniCIWithConfig` and moved imports are migrated in Task 3. Continue to Task 3.

## Task 3: Move Shared Runtime Into Core

**Files:**

- Move: `src/runMiniCIWithConfig.ts` -> `packages/core/src/runMiniCIWithConfig.ts`
- Move: `src/config/schema.ts` -> `packages/core/src/config/schema.ts`
- Move: `src/config/normalize.ts` -> `packages/core/src/config/normalize.ts`
- Move: `src/runtime/logger.ts` -> `packages/core/src/runtime/logger.ts`
- Move: `src/runtime/createContext.ts` -> `packages/core/src/runtime/createContext.ts`
- Move: `src/ci/*` -> `packages/core/src/ci/*`
- Move: `src/utils/*` -> `packages/core/src/utils/*`
- Move tests: `tests/config.test.ts`, `tests/runner.test.ts`, `tests/runtime.test.ts`, `tests/platform-preflight.test.ts`, `tests/ci-base.test.ts`, `tests/utils.test.ts` -> `packages/core/tests/`

- [ ] **Step 1: Create core subdirectories**

Run:

```bash
mkdir -p packages/core/src/config packages/core/src/runtime packages/core/src/ci packages/core/src/utils packages/core/tests
```

Expected: directories exist.

- [ ] **Step 2: Move shared source files**

Move these files exactly:

```txt
src/runMiniCIWithConfig.ts -> packages/core/src/runMiniCIWithConfig.ts
src/config/schema.ts -> packages/core/src/config/schema.ts
src/config/normalize.ts -> packages/core/src/config/normalize.ts
src/runtime/logger.ts -> packages/core/src/runtime/logger.ts
src/runtime/createContext.ts -> packages/core/src/runtime/createContext.ts
src/ci/BaseCI.ts -> packages/core/src/ci/BaseCI.ts
src/ci/registry.ts -> packages/core/src/ci/registry.ts
src/ci/WeappCI.ts -> packages/core/src/ci/WeappCI.ts
src/ci/AlipayCI.ts -> packages/core/src/ci/AlipayCI.ts
src/ci/JdCI.ts -> packages/core/src/ci/JdCI.ts
src/ci/SwanCI.ts -> packages/core/src/ci/SwanCI.ts
src/ci/TTCI.ts -> packages/core/src/ci/TTCI.ts
src/utils/compareVersion.ts -> packages/core/src/utils/compareVersion.ts
src/utils/npm.ts -> packages/core/src/utils/npm.ts
src/utils/qrcode.ts -> packages/core/src/utils/qrcode.ts
```

- [ ] **Step 3: Fix core imports**

In moved core files, keep imports relative to `packages/core/src`. Examples that must compile:

```ts
import { createCI } from "./ci/registry";
import { loadPackageJson } from "./config/loadPackageJson";
import { normalizeConfig } from "./config/normalize";
```

`loadPackageJson` is CLI-neutral because core needs package defaults. Move only `loadPackageJson` into core by creating `packages/core/src/config/loadPackageJson.ts`:

```ts
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * 读取当前项目 package.json。
 *
 * @param cwd 当前工作目录
 * @returns package.json 内容；不存在时返回空对象
 */
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

Then update `packages/core/src/runMiniCIWithConfig.ts`:

```ts
import { loadPackageJson } from "./config/loadPackageJson";
```

Keep `loadMiniCIConfig` in CLI only.

- [ ] **Step 4: Move shared tests**

Move these tests:

```txt
tests/config.test.ts -> packages/core/tests/config.test.ts
tests/runner.test.ts -> packages/core/tests/runner.test.ts
tests/runtime.test.ts -> packages/core/tests/runtime.test.ts
tests/platform-preflight.test.ts -> packages/core/tests/platform-preflight.test.ts
tests/ci-base.test.ts -> packages/core/tests/ci-base.test.ts
tests/utils.test.ts -> packages/core/tests/utils.test.ts
```

Update imports in moved tests from `../src/...` to `../src/...`; because the test folder remains one level beside `src`, most relative paths should keep the same shape.

- [ ] **Step 5: Run core tests**

Run:

```bash
pnpm --filter uni-mini-ci-core test
```

Expected: all core tests pass. If failures mention `loadMiniCIConfig`, move only package-json reading to core as shown above and keep config-file loading in CLI.

- [ ] **Step 6: Run core typecheck**

Run:

```bash
pnpm --filter uni-mini-ci-core run typecheck
pnpm --filter uni-mini-ci-core run typecheck:test
```

Expected: both pass.

## Task 4: Move CLI Package

**Files:**

- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/tsconfig.test.json`
- Create: `packages/cli/tsdown.config.ts`
- Move: `src/cli.ts` -> `packages/cli/src/cli.ts`
- Move: `src/index.ts` -> `packages/cli/src/index.ts`
- Move: `src/command/parseArgs.ts` -> `packages/cli/src/command/parseArgs.ts`
- Move: `src/config/loadConfig.ts` -> `packages/cli/src/config/loadConfig.ts`
- Move: `tests/command.test.ts`, `tests/index.test.ts` -> `packages/cli/tests/`

- [ ] **Step 1: Create CLI directories**

Run:

```bash
mkdir -p packages/cli/src/command packages/cli/src/config packages/cli/tests
```

Expected: directories exist.

- [ ] **Step 2: Create CLI package metadata**

Create `packages/cli/package.json`:

```json
{
  "name": "uni-mini-ci-cli",
  "version": "0.0.0",
  "description": "A CLI for mini program CI after uniapp builds.",
  "homepage": "https://github.com/author/library#readme",
  "bugs": {
    "url": "https://github.com/author/library/issues"
  },
  "license": "MIT",
  "author": "greatauk11@gmail.com",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/author/library.git"
  },
  "bin": {
    "minici": "./dist/cli.mjs"
  },
  "files": ["dist"],
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.mts",
      "import": "./dist/index.mjs"
    },
    "./cli": "./dist/cli.mjs",
    "./package.json": "./package.json"
  },
  "scripts": {
    "build": "tsdown",
    "dev": "tsdown --watch",
    "test": "vitest",
    "typecheck": "tsc --noEmit",
    "typecheck:test": "tsc --noEmit -p tsconfig.test.json",
    "lint": "oxlint",
    "lint:fix": "oxlint --fix",
    "fmt": "oxfmt",
    "fmt:check": "oxfmt --check",
    "prepublishOnly": "pnpm run build"
  },
  "dependencies": {
    "c12": "^3.3.0",
    "cac": "^7.0.0",
    "uni-mini-ci-core": "workspace:*"
  }
}
```

- [ ] **Step 3: Create CLI TypeScript configs**

Create `packages/cli/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

Create `packages/cli/tsconfig.test.json`:

```json
{
  "extends": "./tsconfig.json",
  "include": ["src", "tests"]
}
```

- [ ] **Step 4: Create CLI tsdown config**

Create `packages/cli/tsdown.config.ts`:

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
  exports: false,
});
```

- [ ] **Step 5: Move CLI files**

Move these files:

```txt
src/cli.ts -> packages/cli/src/cli.ts
src/index.ts -> packages/cli/src/index.ts
src/command/parseArgs.ts -> packages/cli/src/command/parseArgs.ts
src/config/loadConfig.ts -> packages/cli/src/config/loadConfig.ts
tests/command.test.ts -> packages/cli/tests/command.test.ts
tests/index.test.ts -> packages/cli/tests/index.test.ts
```

- [ ] **Step 6: Rewrite CLI public API**

Edit `packages/cli/src/index.ts` so it imports shared runtime from core and no longer exports `uniMiniCI`:

```ts
import { parseCliArgs } from "./command/parseArgs";
import { loadMiniCIConfig } from "./config/loadConfig";
import { runMiniCIWithConfig } from "uni-mini-ci-core";

import type { CliOptions } from "./types";
import type { MiniCIConfig, MiniCIResult } from "uni-mini-ci-core";

export {
  runMiniCIWithConfig,
  supportedOperations,
  supportedPlatforms,
  type AlipayClientType,
  type AlipayConfig,
  type JdConfig,
  type MiniCIOperation,
  type MiniCIConfig,
  type MiniCIDescContext,
  type MiniCIDescFunction,
  type MiniCIPlatform,
  type MiniCIResult,
  type NormalizedMiniCIConfig,
  type NormalizedMiniCIConfigBase,
  type ParsedCliArgs,
  type PlatformConfigMap,
  type ProjectType,
  type RunMiniCIWithConfigOptions,
  type SwanConfig,
  type TTConfig,
  type WeappConfig,
} from "uni-mini-ci-core";

export type { CliOptions } from "./types";

/**
 * 定义 minici 配置并保留完整类型推导。
 *
 * @param config minici 配置对象
 * @returns 原始配置对象
 */
export function defineConfig<const T extends MiniCIConfig>(config: T): T {
  return config;
}

/**
 * 运行 minici CLI 流程。
 *
 * @param options CLI 入口选项
 * @returns minici 执行结果
 */
export async function runMiniCI(options: CliOptions): Promise<MiniCIResult> {
  const args = parseCliArgs(options.argv);
  const cwd = args.cwd || options.cwd || process.cwd();
  const config = await loadMiniCIConfig({ cwd, config: args.config });

  return runMiniCIWithConfig({ args, cwd, config });
}
```

Create `packages/cli/src/types.ts` for CLI-only options:

```ts
/** CLI 入口选项 */
export interface CliOptions {
  /** 命令参数 */
  argv: string[];
  /** 当前工作目录 */
  cwd?: string;
  /** 是否直接退出进程 */
  exitProcess?: boolean;
}
```

- [ ] **Step 7: Fix CLI imports**

In `packages/cli/src/command/parseArgs.ts`, import shared constants and types from core:

```ts
import { supportedOperations, supportedPlatforms } from "uni-mini-ci-core";
import type { MiniCIOperation, MiniCIPlatform, ParsedCliArgs } from "uni-mini-ci-core";
```

In `packages/cli/src/config/loadConfig.ts`, keep only config-file loading and import `MiniCIConfig` from core:

```ts
import { loadConfig } from "c12";

import type { MiniCIConfig } from "uni-mini-ci-core";

/** 加载 minici 配置的选项 */
interface LoadMiniCIConfigOptions {
  /** 当前工作目录 */
  cwd: string;
  /** 显式配置文件路径 */
  config?: string;
}

/**
 * 使用 c12 加载 minici.config 配置文件。
 *
 * @param options 加载选项
 * @returns 已加载的配置对象
 */
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
```

- [ ] **Step 8: Run CLI tests**

Run:

```bash
pnpm --filter uni-mini-ci-cli test
```

Expected: CLI tests pass and no test imports `../src/plugin/...`.

- [ ] **Step 9: Run CLI typecheck**

Run:

```bash
pnpm --filter uni-mini-ci-cli run typecheck
pnpm --filter uni-mini-ci-cli run typecheck:test
```

Expected: both pass.

## Task 5: Move Vite Plugin Package

**Files:**

- Create: `packages/vite-plugin/package.json`
- Create: `packages/vite-plugin/tsconfig.json`
- Create: `packages/vite-plugin/tsconfig.test.json`
- Create: `packages/vite-plugin/tsdown.config.ts`
- Create: `packages/vite-plugin/src/index.ts`
- Move: `src/plugin/parsePluginArgs.ts` -> `packages/vite-plugin/src/parsePluginArgs.ts`
- Move: `src/plugin/uniMiniCI.ts` -> `packages/vite-plugin/src/uniMiniCI.ts`
- Move: `tests/plugin-args.test.ts`, `tests/plugin.test.ts` -> `packages/vite-plugin/tests/`

- [ ] **Step 1: Create plugin directories**

Run:

```bash
mkdir -p packages/vite-plugin/src packages/vite-plugin/tests
```

Expected: directories exist.

- [ ] **Step 2: Create plugin package metadata**

Create `packages/vite-plugin/package.json`:

```json
{
  "name": "vite-plugin-uni-mini-ci",
  "version": "0.0.0",
  "description": "Vite plugin for mini program CI after uniapp builds.",
  "license": "MIT",
  "author": "greatauk11@gmail.com",
  "type": "module",
  "files": ["dist"],
  "exports": {
    ".": {
      "types": "./dist/index.d.mts",
      "import": "./dist/index.mjs"
    },
    "./package.json": "./package.json"
  },
  "scripts": {
    "build": "tsdown",
    "dev": "tsdown --watch",
    "test": "vitest",
    "typecheck": "tsc --noEmit",
    "typecheck:test": "tsc --noEmit -p tsconfig.test.json",
    "lint": "oxlint",
    "lint:fix": "oxlint --fix",
    "fmt": "oxfmt",
    "fmt:check": "oxfmt --check",
    "prepublishOnly": "pnpm run build"
  },
  "dependencies": {
    "minimist": "^1.2.8",
    "uni-mini-ci-core": "workspace:*"
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

- [ ] **Step 3: Create plugin TypeScript configs**

Create `packages/vite-plugin/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

Create `packages/vite-plugin/tsconfig.test.json`:

```json
{
  "extends": "./tsconfig.json",
  "include": ["src", "tests"]
}
```

- [ ] **Step 4: Create plugin tsdown config**

Create `packages/vite-plugin/tsdown.config.ts`:

```ts
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
  },
  dts: {
    tsgo: true,
  },
  exports: true,
});
```

- [ ] **Step 5: Move plugin files**

Move these files:

```txt
src/plugin/parsePluginArgs.ts -> packages/vite-plugin/src/parsePluginArgs.ts
src/plugin/uniMiniCI.ts -> packages/vite-plugin/src/uniMiniCI.ts
tests/plugin-args.test.ts -> packages/vite-plugin/tests/plugin-args.test.ts
tests/plugin.test.ts -> packages/vite-plugin/tests/plugin.test.ts
```

- [ ] **Step 6: Create plugin public API**

Create `packages/vite-plugin/src/index.ts`:

```ts
export { uniMiniCI } from "./uniMiniCI";
export type { UniMiniCIPluginOptions } from "./uniMiniCI";
```

- [ ] **Step 7: Fix plugin imports and local type**

In `packages/vite-plugin/src/uniMiniCI.ts`, import shared runtime and types from core:

```ts
import { runMiniCIWithConfig } from "uni-mini-ci-core";
import type { MiniCIConfig, MiniCIPlatform } from "uni-mini-ci-core";
```

Define plugin options locally:

```ts
/** Vite 插件配置结构 */
export interface UniMiniCIPluginOptions extends MiniCIConfig {}
```

In `packages/vite-plugin/src/parsePluginArgs.ts`, import shared operation constants from core:

```ts
import { supportedOperations } from "uni-mini-ci-core";
import type { MiniCIOperation } from "uni-mini-ci-core";
```

If `uniMiniCI.ts` currently imports `isPlatform` from CLI, replace it with a local helper:

```ts
import { supportedPlatforms } from "uni-mini-ci-core";

/**
 * 判断字符串是否为支持的 uniapp 小程序平台。
 *
 * @param value 待判断的平台字符串
 * @returns 是否为支持的平台
 */
function isPlatform(value: string): value is MiniCIPlatform {
  return supportedPlatforms.includes(value as MiniCIPlatform);
}
```

- [ ] **Step 8: Run plugin tests**

Run:

```bash
pnpm --filter vite-plugin-uni-mini-ci test
```

Expected: plugin tests pass and no import references `uni-mini-ci-cli`.

- [ ] **Step 9: Run plugin typecheck**

Run:

```bash
pnpm --filter vite-plugin-uni-mini-ci run typecheck
pnpm --filter vite-plugin-uni-mini-ci run typecheck:test
```

Expected: both pass.

## Task 6: Remove Root Source/Test Remnants And Refresh Lockfile

**Files:**

- Delete: root `src/` after all files are moved.
- Delete: root `tests/` after all tests are moved.
- Delete: root `tsconfig.json` if all packages use package-local configs.
- Delete: root `tsconfig.test.json` if all packages use package-local configs.
- Delete: root `tsdown.config.ts` if all packages use package-local configs.
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Confirm no source files remain at root**

Run:

```bash
rg --files src tests
```

Expected before deletion: command prints only files that have already been moved. If it prints a file not covered by Tasks 2-5, classify it before deleting.

- [ ] **Step 2: Delete empty root source/test/build config remnants**

After verifying every file was moved, remove empty or obsolete root paths:

```bash
rm -rf src tests tsconfig.json tsconfig.test.json tsdown.config.ts
```

Expected: root source/test/build config no longer exists.

- [ ] **Step 3: Install workspace dependencies**

Run:

```bash
pnpm install
```

Expected: lockfile updates and workspace dependencies resolve. If network access is blocked by sandboxing, rerun the same command with escalated permission.

- [ ] **Step 4: Verify workspace package discovery**

Run:

```bash
pnpm -r exec node -e "console.log(require('./package.json').name)"
```

Expected: prints these package names once each:

```txt
uni-mini-ci-core
uni-mini-ci-cli
vite-plugin-uni-mini-ci
```

## Task 7: Documentation Updates

**Files:**

- Modify: `README.md`
- Modify: `docs/cli.md`
- Modify: `docs/vite-plugin.md`
- Modify: `docs/superpowers/specs/2026-05-13-vite-plugin-uni-mini-ci-design.md`

- [ ] **Step 1: Update CLI install and config examples**

In `README.md` and `docs/cli.md`, keep CLI install examples on `uni-mini-ci-cli`:

```bash
pnpm add -D uni-mini-ci-cli
```

Keep config helper import from CLI:

```ts
import { defineConfig } from "uni-mini-ci-cli";
```

- [ ] **Step 2: Update Vite plugin install and import examples**

In `README.md`, `docs/vite-plugin.md`, and `docs/superpowers/specs/2026-05-13-vite-plugin-uni-mini-ci-design.md`, replace plugin import examples with:

```ts
import { uniMiniCI } from "vite-plugin-uni-mini-ci";
```

Use this install example:

```bash
pnpm add -D vite-plugin-uni-mini-ci
```

If docs mention `import { uniMiniCI } from "uni-mini-ci-cli"`, replace that sentence with:

```md
monorepo 拆分后，`uniMiniCI()` 只从 `vite-plugin-uni-mini-ci` 导出；`uni-mini-ci-cli` 只保留 CLI 入口和 `defineConfig()`。
```

- [ ] **Step 3: Document core package role**

Add this paragraph to `README.md` under package overview:

```md
`uni-mini-ci-core` 是 CLI 和 Vite 插件共享的运行时包，承载平台 CI、配置归一化、公共类型和 `runMiniCIWithConfig()`。普通业务项目通常不需要直接安装它；安装 `uni-mini-ci-cli` 或 `vite-plugin-uni-mini-ci` 时会作为依赖安装。
```

- [ ] **Step 4: Verify docs no longer use old plugin import**

Run:

```bash
rg -n "uniMiniCI.*uni-mini-ci-cli|from \"uni-mini-ci-cli\"|from 'uni-mini-ci-cli'" README.md docs packages
```

Expected: any remaining `uni-mini-ci-cli` import is for `defineConfig`, not `uniMiniCI`.

## Task 8: Full Verification

**Files:**

- Verify all package files.

- [ ] **Step 1: Run package tests**

Run:

```bash
pnpm run test
```

Expected: all package tests pass.

- [ ] **Step 2: Run typechecks**

Run:

```bash
pnpm run typecheck
pnpm run typecheck:test
```

Expected: both commands pass across packages.

- [ ] **Step 3: Run builds**

Run:

```bash
pnpm run build
pnpm --filter uni-mini-ci-core run build
pnpm --filter uni-mini-ci-cli run build
pnpm --filter vite-plugin-uni-mini-ci run build
```

Expected: each package emits `dist` successfully.

- [ ] **Step 4: Verify public exports**

Run:

```bash
node -e "import('./packages/cli/dist/index.mjs').then(m=>console.log(Boolean(m.defineConfig), Boolean(m.runMiniCI), 'uniMiniCI' in m))"
node -e "import('./packages/vite-plugin/dist/index.mjs').then(m=>console.log(Boolean(m.uniMiniCI)))"
node -e "import('./packages/core/dist/index.mjs').then(m=>console.log(Boolean(m.runMiniCIWithConfig), m.supportedPlatforms.length))"
```

Expected:

```txt
true true false
true
true 5
```

- [ ] **Step 5: Verify CLI bin output**

Run:

```bash
node packages/cli/dist/cli.mjs --help
```

Expected: help text includes `minici - uniapp 小程序 CI 工具`.

- [ ] **Step 6: Commit only with authorization**

Do not commit automatically. If the user explicitly authorizes Git commits, run:

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json packages README.md docs pnpm-lock.yaml
git commit -m "refactor: split uni mini ci into monorepo packages"
```
