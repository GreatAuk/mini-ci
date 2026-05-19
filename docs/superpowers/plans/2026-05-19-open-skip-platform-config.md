# Pure Open Platform Config Skip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让纯 `--open` 在缺少 `MiniCIConfig[platform]` 时仍能打开小程序开发者工具，同时保持 `preview` / `upload` 的严格平台配置校验。

**Architecture:** 入口层继续只解析操作和平台，语义落在 `uni-mini-ci-core` 的共享 normalize 和 runner 中。`runMiniCIWithConfig()` 基于最终 `runtimeArgs.operations` 判断 pure open，允许 `normalizeConfig()` 缺少平台配置，并跳过完整 `ci.init()`；各平台 `open()` 只走打开 IDE 所需的最小初始化路径。

**Tech Stack:** TypeScript ESM、pnpm workspace、Turbo、Vitest、zod、cac、minimist、Vite 插件。

---

## File Structure

- Modify: `packages/core/src/types.ts`  
  让 `NormalizedMiniCIConfig.platformConfig` 变为可选，表达 pure open 时平台私密配置可能不存在。
- Modify: `packages/core/src/config/normalize.ts`  
  新增 `allowMissingPlatformConfig?: boolean`，仅在 pure open 时允许缺少整段平台配置。
- Modify: `packages/core/src/ci/BaseCI.ts`  
  新增 `requirePlatformConfig()`，让 `init`、`preview`、`upload` 在需要私密配置时继续 fail-fast。
- Modify: `packages/core/src/ci/WeappCI.ts`  
  `open()` 使用默认微信开发者工具路径，不依赖 `miniprogram-ci`、`appid`、`privateKeyPath`。
- Modify: `packages/core/src/ci/AlipayCI.ts`  
  拆出 `loadMinidev()`；pure open 只加载 SDK 并打开 IDE，不执行私钥鉴权初始化。
- Modify: `packages/core/src/ci/SwanCI.ts`  
  `open()` 使用默认百度开发者工具路径，不依赖 `swan-toolkit` 和 `token`。
- Modify: `packages/core/src/ci/TTCI.ts`  
  拆出 `loadTT()`；pure open 只加载 SDK 并打开 IDE，不执行邮箱密码登录。
- Modify: `packages/core/src/ci/JdCI.ts`  
  `open()` 保持 warning 结果，不依赖 SDK 和 `privateKey`。
- Modify: `packages/core/src/runMiniCIWithConfig.ts`  
  判断 pure open，传递 normalize 选项，并在 pure open 时跳过完整 `ci.init()`。
- Test: `packages/core/tests/config.test.ts`
- Test: `packages/core/tests/hooks.test.ts`
- Test: `packages/cli/tests/runner.test.ts`
- Test: `packages/vite-plugin/tests/plugin.test.ts`
- Modify: `README.md`
- Modify: `docs/cli.md`
- Modify: `docs/vite-plugin.md`

---

### Task 1: Normalize 层允许 pure open 缺少平台配置

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/config/normalize.ts`
- Test: `packages/core/tests/config.test.ts`

- [ ] **Step 1: 写 normalize 失败测试**

在 `packages/core/tests/config.test.ts` 的 `describe("normalizeConfig")` 测试组中追加：

```ts
test("纯 open 允许缺少当前平台配置", async () => {
  /** 当前工作目录 */
  const cwd = "/workspace/project";

  await expect(
    normalizeConfig({
      cwd,
      args: {
        operation: "open",
        platform: "mp-weixin",
        projectPath: "dist/dev/mp-weixin",
      },
      config: {},
      packageJson: {
        version: "1.0.0",
        description: "包描述",
      },
      allowMissingPlatformConfig: true,
    }),
  ).resolves.toMatchObject({
    operation: "open",
    platform: "mp-weixin",
    version: "1.0.0",
    desc: "包描述",
    projectPath: path.join(cwd, "dist/dev/mp-weixin"),
  });
});

test("非 pure open 缺少当前平台配置时仍失败", async () => {
  await expect(
    normalizeConfig({
      cwd: "/workspace/project",
      args: {
        operation: "preview",
        platform: "mp-weixin",
      },
      config: {},
      packageJson: {},
      allowMissingPlatformConfig: false,
    }),
  ).rejects.toThrow("mp-weixin 平台配置不能为空");
});

test("pure open 显式提供不完整平台配置时仍按 schema 失败", async () => {
  await expect(
    normalizeConfig({
      cwd: "/workspace/project",
      args: {
        operation: "open",
        platform: "mp-weixin",
      },
      config: {
        "mp-weixin": {
          appid: "wx-appid",
        } as never,
      },
      packageJson: {},
      allowMissingPlatformConfig: true,
    }),
  ).rejects.toThrow(/mp-weixin\.privateKeyPath/);
});
```

- [ ] **Step 2: 运行 normalize 测试确认失败**

Run:

```bash
pnpm exec vitest run packages/core/tests/config.test.ts
```

Expected: FAIL，TypeScript 或运行时错误指向 `allowMissingPlatformConfig` 还不是 `NormalizeConfigInput` 字段，或缺少平台配置仍抛出 `mp-weixin 平台配置不能为空`。

- [ ] **Step 3: 修改 normalized config 类型**

在 `packages/core/src/types.ts` 中将 `NormalizedMiniCIConfig` 的 `platformConfig` 改成可选字段：

```ts
/** 规范化后的 minici 执行配置 */
export type NormalizedMiniCIConfig<P extends MiniCIPlatform = MiniCIPlatform> =
  P extends MiniCIPlatform
    ? NormalizedMiniCIConfigBase & {
        /** 当前平台 */
        platform: P;
        /** 当前平台配置；pure open 时允许不存在 */
        platformConfig?: PlatformConfigMap[P];
      }
    : never;
```

- [ ] **Step 4: 修改 normalize 入参和平台配置分支**

在 `packages/core/src/config/normalize.ts` 中把 `NormalizeConfigInput` 改为：

```ts
/** 配置归一化入参 */
export interface NormalizeConfigInput<P extends MiniCIPlatform = MiniCIPlatform> {
  /** 已解析的单次执行参数 */
  args: SingleOperationArgs<P>;
  /** 当前工作目录 */
  cwd: string;
  /** 已加载的 minici 配置 */
  config: MiniCIConfig;
  /** 当前项目 package.json 内容 */
  packageJson: Record<string, unknown>;
  /** 是否允许缺少当前平台私密配置 */
  allowMissingPlatformConfig?: boolean;
}
```

在 `normalizeConfig()` 中用下面逻辑替换当前平台配置读取：

```ts
/** 校验后的完整配置 */
const config = validateConfig(input.config);
/** 当前平台原始配置 */
const rawPlatformConfig = config[input.args.platform];
/** 当前平台配置 */
const platformConfig = rawPlatformConfig
  ? validatePlatformConfig(input.args.platform, config)
  : undefined;

if (!platformConfig && !input.allowMissingPlatformConfig) {
  validatePlatformConfig(input.args.platform, config);
}
```

在 `normalizedConfig` 对象中把 `platformConfig` 改为条件注入：

```ts
/** 规范化后的配置 */
const normalizedConfig = {
  operation: input.args.operation,
  platform: input.args.platform,
  cwd: input.cwd,
  projectPath,
  version,
  desc,
  packageJson: input.packageJson,
  ...(qrcodePath && { qrcodePath }),
  ...(platformConfig && { platformConfig }),
} as NormalizedMiniCIConfig<P>;
```

- [ ] **Step 5: 运行 normalize 测试确认通过**

Run:

```bash
pnpm exec vitest run packages/core/tests/config.test.ts
```

Expected: PASS。

- [ ] **Step 6: 提交 Task 1**

```bash
git add packages/core/src/types.ts packages/core/src/config/normalize.ts packages/core/tests/config.test.ts
git commit -m "fix(core): allow pure open normalize without platform config"
```

---

### Task 2: Runner 和 CI 适配器支持 pure open 最小初始化

**Files:**
- Modify: `packages/core/src/ci/BaseCI.ts`
- Modify: `packages/core/src/ci/WeappCI.ts`
- Modify: `packages/core/src/ci/AlipayCI.ts`
- Modify: `packages/core/src/ci/SwanCI.ts`
- Modify: `packages/core/src/ci/TTCI.ts`
- Modify: `packages/core/src/ci/JdCI.ts`
- Modify: `packages/core/src/runMiniCIWithConfig.ts`
- Test: `packages/core/tests/hooks.test.ts`

- [ ] **Step 1: 写 runner 失败测试**

在 `packages/core/tests/hooks.test.ts` 中把 type import 改为：

```ts
import type { MiniCIConfig, MiniCIOperation, MiniCIPlatform } from "../src/types";
```

在 `calls` 后新增：

```ts
/** mock init 执行记录 */
const initCalls: MiniCIOperation[] = [];
```

把 mock `init` 改为记录当前 operation：

```ts
init: vi.fn().mockImplementation(() => {
  initCalls.push(config.operation);
  if (failingMethod === "init") {
    throw new Error("init failed");
  }
}),
```

把 `afterEach` 中的清理改为：

```ts
afterEach(async () => {
  calls.length = 0;
  initCalls.length = 0;
  failingMethod = undefined;
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});
```

在 `createProject()` 后新增通用项目 helper：

```ts
/**
 * 创建指定平台的临时测试项目。
 *
 * @param platform 当前平台
 * @returns 临时项目目录和构建产物目录
 */
async function createProjectForPlatform(
  platform: MiniCIPlatform,
): Promise<{ cwd: string; projectPath: string }> {
  /** 临时项目目录 */
  const cwd = await mkdtemp(path.join(os.tmpdir(), "minici-hooks-"));
  /** 小程序构建产物目录 */
  const projectPath = path.join(cwd, `dist/build/${platform}`);

  tempDirs.push(cwd);
  await mkdir(projectPath, { recursive: true });
  await writeFile(path.join(cwd, "package.json"), JSON.stringify({ version: "1.0.0" }));

  return { cwd, projectPath };
}

/**
 * 执行最小配置的共享 runner。
 *
 * @param operations 当前操作列表
 * @param platform 当前平台
 * @param config minici 配置
 * @returns minici 执行结果
 */
async function runWithConfig(
  operations: MiniCIOperation[],
  platform: MiniCIPlatform,
  config: MiniCIConfig,
) {
  /** 临时项目 */
  const project = await createProjectForPlatform(platform);

  return runMiniCIWithConfig({
    args: {
      operations,
      platform,
      projectPath: project.projectPath,
    },
    cwd: project.cwd,
    config,
  });
}
```

在 `describe("runMiniCIWithConfig hooks")` 测试组中追加：

```ts
test("纯 open 缺少平台配置时执行 open 并跳过完整 init", async () => {
  await runWithConfig(["open"], "mp-weixin", {
    version: "1.0.0",
    desc: "测试描述",
  });

  expect(calls).toEqual(["open"]);
  expect(initCalls).toEqual([]);
});

test("open 与 preview 组合时缺少平台配置会直接失败且不执行 open", async () => {
  await expect(
    runWithConfig(["open", "preview"], "mp-weixin", {
      version: "1.0.0",
      desc: "测试描述",
    }),
  ).rejects.toThrow("mp-weixin 平台配置不能为空");

  expect(calls).toEqual([]);
  expect(initCalls).toEqual([]);
});

test.each(["mp-weixin", "mp-alipay", "mp-baidu", "mp-jd", "mp-toutiao"] as const)(
  "纯 open 缺少 %s 平台配置时不阻塞 runner",
  async (platform) => {
    await runWithConfig(["open"], platform, {
      version: "1.0.0",
      desc: "测试描述",
    });

    expect(calls).toEqual(["open"]);
    expect(initCalls).toEqual([]);
  },
);
```

- [ ] **Step 2: 运行 runner 测试确认失败**

Run:

```bash
pnpm exec vitest run packages/core/tests/hooks.test.ts
```

Expected: FAIL，缺少平台配置仍在 pure open 场景抛出，或 `initCalls` 记录到了 `"open"`。

- [ ] **Step 3: 在 BaseCI 中新增平台配置读取门禁**

在 `packages/core/src/ci/BaseCI.ts` 的 type import 中加入 `PlatformConfigMap`：

```ts
import type {
  MiniCIPlatform,
  MiniCISingleResult,
  NormalizedMiniCIConfig,
  PlatformConfigMap,
} from "../types";
```

在 `constructor` 后新增：

```ts
  /**
   * 读取需要 preview/upload 的平台私密配置。
   *
   * @returns 当前平台配置
   */
  protected requirePlatformConfig(): PlatformConfigMap[P] {
    if (!this.config.platformConfig) {
      throw new Error(`配置校验失败：${this.config.platform} 平台配置不能为空`);
    }

    return this.config.platformConfig;
  }
```

- [ ] **Step 4: 修改 runner pureOpen 分支**

在 `packages/core/src/runMiniCIWithConfig.ts` 的 `runtimeArgs` 后新增：

```ts
  /** 是否只执行 open 操作 */
  const pureOpen =
    runtimeArgs.operations.length === 1 && runtimeArgs.operations[0] === "open";
```

在调用 `normalizeConfig()` 时新增选项：

```ts
      normalized = await normalizeConfig({
        args: {
          ...runtimeArgs,
          platform: runtimeArgs.platform!,
          operation,
        },
        cwd: options.cwd,
        config: options.config,
        packageJson,
        allowMissingPlatformConfig: pureOpen,
      });
```

把 `ci.init()` 包成非 pure open 才执行：

```ts
    if (!pureOpen) {
      try {
        await ci.init();
      } catch (error) {
        /** 初始化错误 */
        const initError = toError(error);
        logFailure({
          logger,
          error: initError,
          operation,
          platform: runtimeArgs.platform,
        });
        await triggerErrorHook(
          options,
          createErrorHookData({
            error: initError,
            operation,
            platform: runtimeArgs.platform,
            normalized,
          }),
        );
        throw initError;
      }
    }
```

- [ ] **Step 5: 修改 WeappCI**

在 `packages/core/src/ci/WeappCI.ts` 中，在 `devToolsInstallPath` 字段后新增：

```ts
  /**
   * 读取微信开发者工具安装路径。
   *
   * @returns 开发者工具安装路径
   */
  private getDevToolsInstallPath(): string {
    return (
      this.config.platformConfig?.devToolsInstallPath ||
      (process.platform === "darwin"
        ? "/Applications/wechatwebdevtools.app"
        : "C:\\Program Files (x86)\\Tencent\\微信web开发者工具")
    );
  }
```

在 `init()` 中把第一行替换为：

```ts
    const weappConfig = this.requirePlatformConfig();
```

把 `init()` 中当前计算默认开发者工具路径的 `this.devToolsInstallPath` 赋值替换为：

```ts
    this.devToolsInstallPath = this.getDevToolsInstallPath();
```

在 `open()` 开头新增本地路径变量，并用它替换后续 `this.devToolsInstallPath`：

```ts
    /** 微信开发者工具安装路径 */
    const devToolsInstallPath = this.devToolsInstallPath || this.getDevToolsInstallPath();

    if (!existsSync(devToolsInstallPath)) {
      throw new Error(`微信开发者工具安装路径不存在：${devToolsInstallPath}`);
    }

    const cliPath = path.join(
      devToolsInstallPath,
      os.platform() === "win32" ? "/cli.bat" : "/Contents/MacOS/cli",
    );

    const isWindows = os.platform() === "win32";
    const installPath = isWindows ? devToolsInstallPath : `${devToolsInstallPath}/Contents/MacOS`;
```

在 `preview()` 和 `upload()` 中，把 `this.config.platformConfig` 替换为：

```ts
      const weappConfig = this.requirePlatformConfig();
```

- [ ] **Step 6: 修改 AlipayCI**

在 `packages/core/src/ci/AlipayCI.ts` 中，在 `minidev` 字段后新增：

```ts
  /**
   * 加载 minidev SDK。
   *
   * @returns minidev 模块实例
   */
  private loadMinidev(): any {
    if (!this.minidev) {
      try {
        this.minidev = getNpmPkgSync("minidev", this.config.cwd);
      } catch {
        throw new Error("当前平台 mp-alipay 需要安装依赖：minidev");
      }
    }

    return this.minidev;
  }
```

把 `init()` 开头替换为：

```ts
    const alipayConfig = this.requirePlatformConfig();
    const minidev = this.loadMinidev();
```

把 `this.minidev.useDefaults({` 改为：

```ts
    minidev.useDefaults({
```

把 `open()` 改为：

```ts
  async open() {
    /** minidev 模块实例 */
    const minidev = this.minidev || this.loadMinidev();
    /** 支付宝平台配置 */
    const alipayConfig = this.config.platformConfig;

    try {
      this.logger.start("小程序开发者工具", this.config.projectPath);
      await minidev.minidev.startIde(
        Object.assign(
          { project: this.config.projectPath },
          alipayConfig?.devToolsInstallPath ? { appPath: alipayConfig.devToolsInstallPath } : {},
        ),
      );
      return this.createResult(true);
    } catch (error) {
      throw new Error(`mp-alipay open 执行失败：${error instanceof Error ? error.message : error}`);
    }
  }
```

在 `preview()` 和 `upload()` 中，把 `this.config.platformConfig` 替换为：

```ts
    const { appid: appId, clientType = "alipay" } = this.requirePlatformConfig();
```

和：

```ts
    const { clientType = "alipay", appid: appId, deleteVersion } =
      this.requirePlatformConfig();
```

- [ ] **Step 7: 修改 SwanCI**

在 `packages/core/src/ci/SwanCI.ts` 的 `open()` 中把平台配置读取改为可选：

```ts
    const devToolsInstallPath =
      this.config.platformConfig?.devToolsInstallPath ||
      (isMac ? "/Applications/百度开发者工具.app" : "C:\\Program Files\\swan-ide-gui");
```

在 `preview()` 和 `upload()` 中，把 `this.config.platformConfig` 替换为：

```ts
    const swanConfig = this.requirePlatformConfig();
```

- [ ] **Step 8: 修改 TTCI**

在 `packages/core/src/ci/TTCI.ts` 中，在 `tt` 字段后新增：

```ts
  /**
   * 加载 tt-ide-cli SDK。
   *
   * @returns tt-ide-cli 模块
   */
  private loadTT(): any {
    if (!this.tt) {
      try {
        this.tt = getNpmPkgSync("tt-ide-cli", this.config.cwd);
      } catch {
        throw new Error("当前平台 mp-toutiao 需要安装依赖：tt-ide-cli");
      }
    }

    return this.tt;
  }
```

把 `init()` 改为：

```ts
  async init(): Promise<void> {
    this.loadTT();
  }
```

在 `beforeCheck()` 中把配置读取改为：

```ts
    const ttConfig = this.requirePlatformConfig();
```

在 `open()` 开头新增：

```ts
      /** tt-ide-cli 模块 */
      const tt = this.tt || this.loadTT();
```

并把 `await this.tt.open({` 改为：

```ts
      await tt.open({
```

- [ ] **Step 9: 修改 JdCI**

在 `packages/core/src/ci/JdCI.ts` 中，把 `preview()` 和 `upload()` 的平台配置读取改为：

```ts
    const { privateKey, ignores } = this.requirePlatformConfig();
```

和：

```ts
    const { privateKey, robot, ignores } = this.requirePlatformConfig();
```

`open()` 保持现有 warning，不新增 SDK 依赖。

- [ ] **Step 10: 运行 core runner 测试确认通过**

Run:

```bash
pnpm exec vitest run packages/core/tests/config.test.ts packages/core/tests/hooks.test.ts packages/core/tests/platform-preflight.test.ts packages/core/tests/ci-base.test.ts
```

Expected: PASS。

- [ ] **Step 11: 提交 Task 2**

```bash
git add packages/core/src/ci/BaseCI.ts packages/core/src/ci/WeappCI.ts packages/core/src/ci/AlipayCI.ts packages/core/src/ci/SwanCI.ts packages/core/src/ci/TTCI.ts packages/core/src/ci/JdCI.ts packages/core/src/runMiniCIWithConfig.ts packages/core/tests/hooks.test.ts
git commit -m "fix(core): skip full init for pure open"
```

---

### Task 3: CLI 和 Vite 插件覆盖 pure open 行为

**Files:**
- Test: `packages/cli/tests/runner.test.ts`
- Test: `packages/vite-plugin/tests/plugin.test.ts`

- [ ] **Step 1: 写 CLI 外观失败测试**

在 `packages/cli/tests/runner.test.ts` 的 `describe("runMiniCI")` 测试组中追加：

```ts
test("纯 open 缺少平台配置时仍执行 open", async () => {
  const cwd = await createTempDir();
  const projectPath = path.join(cwd, "dist/dev/mp-weixin");
  await mkdir(projectPath, { recursive: true });
  await writeFile(path.join(cwd, "package.json"), JSON.stringify({ version: "1.0.0" }));
  await writeFile(path.join(cwd, "minici.config.mjs"), "export default {};");

  const { runMiniCI } = await import("../src/index");
  await runMiniCI({
    argv: ["--open", "--platform", "mp-weixin", "--projectPath", projectPath],
    cwd,
  });

  expect(calls).toEqual([{ method: "open" }]);
});

test("open 与 preview 组合缺少平台配置时仍失败且不执行 open", async () => {
  const cwd = await createTempDir();
  const projectPath = path.join(cwd, "dist/dev/mp-weixin");
  await mkdir(projectPath, { recursive: true });
  await writeFile(path.join(cwd, "package.json"), JSON.stringify({ version: "1.0.0" }));
  await writeFile(path.join(cwd, "minici.config.mjs"), "export default {};");

  const { runMiniCI } = await import("../src/index");

  await expect(
    runMiniCI({
      argv: ["--open", "--preview", "--platform", "mp-weixin", "--projectPath", projectPath],
      cwd,
    }),
  ).rejects.toThrow("mp-weixin 平台配置不能为空");

  expect(calls).toEqual([]);
});
```

- [ ] **Step 2: 写 Vite 插件入口失败测试**

在 `packages/vite-plugin/tests/plugin.test.ts` 的 `describe("uniMiniCI")` 测试组中追加：

```ts
test("serve 模式纯 open 缺少平台配置时仍执行 open", async () => {
  const { cwd, outputDir } = await createProject("serve");
  process.argv = ["node", "uni", "dev", "-p", "mp-weixin", "--", "--open"];
  process.env.UNI_PLATFORM = "mp-weixin";
  process.env.UNI_OUTPUT_DIR = outputDir;

  const plugin = uniMiniCI({});

  await runServePlugin(plugin, cwd);

  expect(calls).toEqual([{ method: "open", projectPath: outputDir, platform: "mp-weixin" }]);
});

test("serve 模式 open 与 preview 组合缺少平台配置时仍失败且不执行 open", async () => {
  const { cwd, outputDir } = await createProject("serve");
  process.argv = ["node", "uni", "dev", "-p", "mp-weixin", "--", "--open", "--preview"];
  process.env.UNI_PLATFORM = "mp-weixin";
  process.env.UNI_OUTPUT_DIR = outputDir;

  const plugin = uniMiniCI({});

  await expect(runServePlugin(plugin, cwd)).rejects.toThrow("mp-weixin 平台配置不能为空");
  expect(calls).toEqual([]);
});
```

- [ ] **Step 3: 运行入口测试确认行为**

Run:

```bash
pnpm exec vitest run packages/cli/tests/runner.test.ts packages/vite-plugin/tests/plugin.test.ts
```

Expected: PASS。若此时失败，错误应定位到入口未透传到共享 runner、测试 mock 仍假设平台配置必填，或 pure open 分支没有从共享 runner 传播到 CLI / Vite 插件。

- [ ] **Step 4: 提交 Task 3**

```bash
git add packages/cli/tests/runner.test.ts packages/vite-plugin/tests/plugin.test.ts
git commit -m "test: cover pure open without platform config"
```

---

### Task 4: 文档同步 pure open 语义

**Files:**
- Modify: `README.md`
- Modify: `docs/cli.md`
- Modify: `docs/vite-plugin.md`

- [ ] **Step 1: 更新 README 共享说明**

在 `README.md` 的这句后面：

```md
`--open`、`--preview`、`--upload` 可以组合使用；组合时执行顺序固定为 `open -> preview -> upload`，不受命令行书写顺序影响。
```

新增：

```md
纯 `--open` 只需要 `platform` 和 `projectPath`，不要求配置对应平台的 appid、私钥、token、账号密码等 CI 发布凭证；一旦与 `--preview` 或 `--upload` 组合，仍必须提供完整平台配置，且缺少配置时不会先执行 `open`。
```

- [ ] **Step 2: 更新 CLI 文档**

在 `docs/cli.md` 的 `### 操作` 表格后新增：

```md
纯 `--open` 不要求在 `minici.config` 中配置对应平台的私密 CI 配置；它只负责按 `platform` 和 `projectPath` 打开开发者工具。`--open --preview`、`--open --upload` 仍按发布类操作处理，必须提供完整平台配置。
```

- [ ] **Step 3: 更新 Vite 插件文档**

在 `docs/vite-plugin.md` 的 `## 触发操作` 命令示例后、`--bump` 说明前新增：

```md
纯 `--open` 可以配合空的 `uniMiniCI({})` 使用，只要 uni 提供了 `UNI_PLATFORM` 和 `UNI_OUTPUT_DIR`。如果同一次命令还包含 `--preview` 或 `--upload`，仍需要在 `uniMiniCI(options)` 中配置对应平台凭证。
```

- [ ] **Step 4: 检查文档文本存在**

Run:

```bash
rg -n '纯 `--open`|空的 `uniMiniCI\(\{\}\)`' README.md docs/cli.md docs/vite-plugin.md
```

Expected: PASS，输出包含 README、`docs/cli.md`、`docs/vite-plugin.md` 三个文件的匹配行。

- [ ] **Step 5: 提交 Task 4**

```bash
git add README.md docs/cli.md docs/vite-plugin.md
git commit -m "docs: explain pure open config requirements"
```

---

### Task 5: 全量验证和收尾

**Files:**
- No source edits unless verification exposes a regression.

- [ ] **Step 1: 运行 core 测试**

Run:

```bash
pnpm exec vitest run packages/core/tests/config.test.ts packages/core/tests/hooks.test.ts packages/core/tests/platform-preflight.test.ts packages/core/tests/ci-base.test.ts
```

Expected: PASS。

- [ ] **Step 2: 运行入口测试**

Run:

```bash
pnpm exec vitest run packages/cli/tests/runner.test.ts packages/vite-plugin/tests/plugin.test.ts
```

Expected: PASS。

- [ ] **Step 3: 运行全仓测试**

Run:

```bash
pnpm run test
```

Expected: PASS。

- [ ] **Step 4: 运行类型检查**

Run:

```bash
pnpm run typecheck
```

Expected: PASS。

- [ ] **Step 5: 运行测试类型检查**

Run:

```bash
pnpm run typecheck:test
```

Expected: PASS。

- [ ] **Step 6: 运行格式检查**

Run:

```bash
pnpm run fmt:check
```

Expected: PASS。

- [ ] **Step 7: 查看最终变更**

Run:

```bash
git status --short
git log --oneline -5
```

Expected: `git status --short` 没有未暂存或未提交改动；最近提交包含 Task 1 到 Task 4 的提交。
