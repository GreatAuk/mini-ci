# QR Code 图片保存路径自定义 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在顶层 `MiniCIConfig` 中添加可选的 `qrcodePath` 字段，允许用户分别指定 preview / upload 操作的二维码图片保存路径，未配置时各平台沿用原有默认路径。

**Architecture:** 在 `types.ts` 和 `schema.ts` 增加 `qrcodePath` 配置项，在 `normalize.ts` 中解析路径为绝对路径，然后在 5 个 CI 适配器中读取该值并以 `??` fallback 到原有默认路径。

**Tech Stack:** TypeScript, Zod (schema 校验), Node.js `path` 模块, Vitest

---

## 文件清单

| 文件                                    | 类型                                                                  |
| --------------------------------------- | --------------------------------------------------------------------- |
| `packages/core/src/types.ts`            | 修改：`MiniCIConfig` + `NormalizedMiniCIConfigBase` 新增 `qrcodePath` |
| `packages/core/src/config/schema.ts`    | 修改：新增 `qrcodePathSchema`，加入 `miniciConfigSchema`              |
| `packages/core/src/config/normalize.ts` | 修改：normalize 时解析 `qrcodePath` 路径                              |
| `packages/core/src/ci/WeappCI.ts`       | 修改：preview/upload 使用可配置路径                                   |
| `packages/core/src/ci/AlipayCI.ts`      | 修改：preview/upload 使用可配置路径                                   |
| `packages/core/src/ci/SwanCI.ts`        | 修改：preview/upload 使用可配置路径                                   |
| `packages/core/src/ci/TTCI.ts`          | 修改：preview/upload 使用可配置路径                                   |
| `packages/core/src/ci/JdCI.ts`          | 修改：preview/upload 使用可配置路径                                   |
| `packages/core/tests/config.test.ts`    | 修改：新增 qrcodePath normalize 测试                                  |
| `packages/core/tests/ci-base.test.ts`   | 修改：新增路径选取行为测试                                            |

---

## Task 1: 更新类型定义

**Files:**

- Modify: `packages/core/src/types.ts`

- [ ] **Step 1: 在 `MiniCIConfig` 中添加 `qrcodePath` 字段**

在 `packages/core/src/types.ts` 中，找到 `MiniCIConfig` interface，添加字段：

```ts
/** minici 配置文件结构 */
export interface MiniCIConfig {
  /** 发布版本号 */
  version?: string;
  /** 发布描述 */
  desc?: string | MiniCIDescFunction;
  /** 小程序构建产物目录 */
  projectPath?: string;
  /** 二维码图片保存路径 */
  qrcodePath?: {
    /**
     * preview 操作的二维码图片保存路径。
     * @example "./output/preview.png"
     * @example "/tmp/my-preview.jpg"
     */
    preview?: string;
    /**
     * upload 操作的二维码图片保存路径。
     * @example "./output/upload.png"
     * @example "/tmp/my-upload.jpg"
     */
    upload?: string;
  };
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
```

- [ ] **Step 2: 在 `NormalizedMiniCIConfigBase` 中添加 `qrcodePath` 字段**

找到 `NormalizedMiniCIConfigBase` interface，添加字段：

```ts
/** 规范化后的 minici 执行配置公共字段 */
export interface NormalizedMiniCIConfigBase {
  /** 当前操作 */
  operation: MiniCIOperation;
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
  /** 二维码图片保存路径（已解析为绝对路径） */
  qrcodePath?: {
    /** preview 操作的二维码图片保存路径 */
    preview?: string;
    /** upload 操作的二维码图片保存路径 */
    upload?: string;
  };
}
```

- [ ] **Step 3: 确认无 TypeScript 编译错误**

```bash
cd packages/core && npx tsc --noEmit
```

Expected: 无报错（或只有原有的已知报错）。

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/types.ts
git commit -m "feat(core): add qrcodePath to MiniCIConfig and NormalizedMiniCIConfigBase types"
```

---

## Task 2: 更新 Schema 校验

**Files:**

- Modify: `packages/core/src/config/schema.ts`

- [ ] **Step 1: 新增 `qrcodePathSchema`**

在 `packages/core/src/config/schema.ts` 中，在 `miniciConfigSchema` 定义之前，新增：

```ts
/** 二维码图片保存路径 schema */
const qrcodePathSchema = z
  .object({
    /** preview 操作的二维码图片保存路径 */
    preview: z.string().optional(),
    /** upload 操作的二维码图片保存路径 */
    upload: z.string().optional(),
  })
  .strict()
  .optional();
```

- [ ] **Step 2: 在 `miniciConfigSchema` 中引用**

找到 `miniciConfigSchema` 的 `.object({...})` 部分，在 `"mp-toutiao"` 字段之前（或 `projectPath` 之后）插入：

```ts
/** 二维码图片保存路径 */
qrcodePath: qrcodePathSchema,
```

完整的 `miniciConfigSchema` 相关片段应形如：

```ts
export const miniciConfigSchema = z
  .object({
    version: nonEmptyStringSchema.optional(),
    desc: z.union([nonEmptyStringSchema, descFunctionSchema]).optional(),
    projectPath: nonEmptyStringSchema.optional(),
    qrcodePath: qrcodePathSchema,
    "mp-weixin": weappConfigSchema.optional(),
    "mp-alipay": alipayConfigSchema.optional(),
    "mp-baidu": swanConfigSchema.optional(),
    "mp-jd": jdConfigSchema.optional(),
    "mp-toutiao": ttConfigSchema.optional(),
  })
  .strict() satisfies z.ZodType<MiniCIConfig>;
```

- [ ] **Step 3: 确认无 TypeScript 编译错误**

```bash
cd packages/core && npx tsc --noEmit
```

Expected: 无新增报错。

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/config/schema.ts
git commit -m "feat(core): add qrcodePath to miniciConfigSchema"
```

---

## Task 3: 更新 normalize 层

**Files:**

- Modify: `packages/core/src/config/normalize.ts`

- [ ] **Step 1: 在 `normalizeConfig` 函数中解析 `qrcodePath`**

在 `normalizeConfig` 函数末尾，找到 `const normalizedConfig = { ... }` 这段代码，在 `platformConfig` 之后添加 `qrcodePath` 解析：

```ts
/** 解析后的二维码图片保存路径 */
const qrcodePath = config.qrcodePath
  ? {
      preview: config.qrcodePath.preview
        ? normalizeProjectPath(input.cwd, config.qrcodePath.preview)
        : undefined,
      upload: config.qrcodePath.upload
        ? normalizeProjectPath(input.cwd, config.qrcodePath.upload)
        : undefined,
    }
  : undefined;

/** 规范化后的配置 */
const normalizedConfig = {
  operation: input.args.operation,
  platform: input.args.platform,
  cwd: input.cwd,
  projectPath,
  version,
  desc,
  packageJson: input.packageJson,
  platformConfig,
  qrcodePath,
} as NormalizedMiniCIConfig<P>;
```

- [ ] **Step 2: 确认无 TypeScript 编译错误**

```bash
cd packages/core && npx tsc --noEmit
```

Expected: 无新增报错。

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/config/normalize.ts
git commit -m "feat(core): resolve qrcodePath in normalizeConfig"
```

---

## Task 4: 为 normalize 层新增测试

**Files:**

- Modify: `packages/core/tests/config.test.ts`

查看现有测试结构后，在 `config.test.ts` 中新增以下测试用例（添加到现有 `normalizeConfig` describe 块中，或新建一个 describe 块）：

- [ ] **Step 1: 编写失败测试**

在 `packages/core/tests/config.test.ts` 中新增：

```ts
describe("normalizeConfig - qrcodePath", () => {
  const baseInput = {
    args: { operation: "preview" as const, platform: "mp-weixin" as const },
    cwd: "/project",
    config: {
      "mp-weixin": {
        appid: "wx123",
        privateKeyPath: "/key.pem",
      },
    },
    packageJson: { version: "1.0.0" },
  };

  it("未配置 qrcodePath 时，normalize 结果中 qrcodePath 为 undefined", async () => {
    const result = await normalizeConfig(baseInput);
    expect(result.qrcodePath).toBeUndefined();
  });

  it("配置相对路径 preview 时，解析为基于 cwd 的绝对路径", async () => {
    const result = await normalizeConfig({
      ...baseInput,
      config: {
        ...baseInput.config,
        qrcodePath: { preview: "./output/preview.png" },
      },
    });
    expect(result.qrcodePath?.preview).toBe("/project/output/preview.png");
    expect(result.qrcodePath?.upload).toBeUndefined();
  });

  it("配置绝对路径时，原样保留", async () => {
    const result = await normalizeConfig({
      ...baseInput,
      config: {
        ...baseInput.config,
        qrcodePath: { preview: "/tmp/preview.png", upload: "/tmp/upload.png" },
      },
    });
    expect(result.qrcodePath?.preview).toBe("/tmp/preview.png");
    expect(result.qrcodePath?.upload).toBe("/tmp/upload.png");
  });

  it("只配置 upload 时，preview 为 undefined", async () => {
    const result = await normalizeConfig({
      ...baseInput,
      config: {
        ...baseInput.config,
        qrcodePath: { upload: "./output/upload.png" },
      },
    });
    expect(result.qrcodePath?.preview).toBeUndefined();
    expect(result.qrcodePath?.upload).toBe("/project/output/upload.png");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd packages/core && npx vitest run tests/config.test.ts
```

Expected: 新增的 4 个测试失败（因为 normalize 层还未处理 qrcodePath）。

> 注意：如果 Task 3 已经完成，这些测试应该直接通过。按照当前计划顺序，Task 3 在 Task 4 之前，所以运行时测试应该通过。

- [ ] **Step 3: 运行测试确认通过**

```bash
cd packages/core && npx vitest run tests/config.test.ts
```

Expected: 所有测试通过。

- [ ] **Step 4: Commit**

```bash
git add packages/core/tests/config.test.ts
git commit -m "test(core): add qrcodePath normalize tests"
```

---

## Task 5: 修改 WeappCI 使用可配置路径

**Files:**

- Modify: `packages/core/src/ci/WeappCI.ts`

- [ ] **Step 1: 修改 `preview()` 方法中的路径**

找到 `preview()` 方法中这一行：

```ts
const previewQrcodePath = path.join(this.config.projectPath, "preview.jpg");
```

替换为：

```ts
const previewQrcodePath =
  this.config.qrcodePath?.preview ?? path.join(this.config.projectPath, "preview.jpg");
```

- [ ] **Step 2: 修改 `upload()` 方法中的路径**

找到 `upload()` 方法中这一行：

```ts
const uploadQrcodePath = path.join(this.config.projectPath, "upload.png");
```

替换为：

```ts
const uploadQrcodePath =
  this.config.qrcodePath?.upload ?? path.join(this.config.projectPath, "upload.png");
```

- [ ] **Step 3: 确认无 TypeScript 编译错误**

```bash
cd packages/core && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/ci/WeappCI.ts
git commit -m "feat(core): use configurable qrcodePath in WeappCI"
```

---

## Task 6: 修改 AlipayCI 使用可配置路径

**Files:**

- Modify: `packages/core/src/ci/AlipayCI.ts`

- [ ] **Step 1: 修改 `preview()` 方法中的路径**

找到 `preview()` 方法中这一行：

```ts
const previewQrcodePath = path.join(this.config.projectPath, "preview.png");
```

替换为：

```ts
const previewQrcodePath =
  this.config.qrcodePath?.preview ?? path.join(this.config.projectPath, "preview.png");
```

- [ ] **Step 2: 修改 `upload()` 方法中的路径**

找到 `upload()` 方法中这一行：

```ts
const uploadQrcodePath = path.join(this.config.projectPath, "upload.png");
```

替换为：

```ts
const uploadQrcodePath =
  this.config.qrcodePath?.upload ?? path.join(this.config.projectPath, "upload.png");
```

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/ci/AlipayCI.ts
git commit -m "feat(core): use configurable qrcodePath in AlipayCI"
```

---

## Task 7: 修改 SwanCI 使用可配置路径

**Files:**

- Modify: `packages/core/src/ci/SwanCI.ts`

- [ ] **Step 1: 修改 `preview()` 方法中的路径**

找到 `preview()` 方法中这一行：

```ts
const previewQrcodePath = path.join(this.config.projectPath, "preview.png");
```

替换为：

```ts
const previewQrcodePath =
  this.config.qrcodePath?.preview ?? path.join(this.config.projectPath, "preview.png");
```

- [ ] **Step 2: 修改 `upload()` 方法中的路径**

找到 `upload()` 方法中这一行（在 `async (_code, stdout, stderr) =>` 回调内）：

```ts
const uploadQrcodePath = path.join(this.config.projectPath, "upload.png");
```

替换为：

```ts
const uploadQrcodePath =
  this.config.qrcodePath?.upload ?? path.join(this.config.projectPath, "upload.png");
```

注意：SwanCI 的 `upload()` 中路径声明在 Promise 外层 vs 内层——请确保替换的是回调内部的那一行。

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/ci/SwanCI.ts
git commit -m "feat(core): use configurable qrcodePath in SwanCI"
```

---

## Task 8: 修改 TTCI 使用可配置路径

**Files:**

- Modify: `packages/core/src/ci/TTCI.ts`

- [ ] **Step 1: 修改 `preview()` 方法中的路径**

找到 `preview()` 方法中这一行：

```ts
const previewQrcodePath = path.join(this.config.projectPath, "preview.png");
```

替换为：

```ts
const previewQrcodePath =
  this.config.qrcodePath?.preview ?? path.join(this.config.projectPath, "preview.png");
```

- [ ] **Step 2: 修改 `upload()` 方法中的路径**

找到 `upload()` 方法中这一行：

```ts
const uploadQrcodePath = path.join(this.config.projectPath, "upload.png");
```

替换为：

```ts
const uploadQrcodePath =
  this.config.qrcodePath?.upload ?? path.join(this.config.projectPath, "upload.png");
```

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/ci/TTCI.ts
git commit -m "feat(core): use configurable qrcodePath in TTCI"
```

---

## Task 9: 修改 JdCI 使用可配置路径

**Files:**

- Modify: `packages/core/src/ci/JdCI.ts`

- [ ] **Step 1: 修改 `preview()` 方法中的路径**

找到 `preview()` 方法中这一行：

```ts
const previewQrcodePath = path.join(this.config.projectPath, "preview.jpg");
```

替换为：

```ts
const previewQrcodePath =
  this.config.qrcodePath?.preview ?? path.join(this.config.projectPath, "preview.jpg");
```

- [ ] **Step 2: 修改 `upload()` 方法中的路径**

找到 `upload()` 方法中这一行：

```ts
const uploadQrcodePath = path.join(this.config.projectPath, "upload.jpg");
```

替换为：

```ts
const uploadQrcodePath =
  this.config.qrcodePath?.upload ?? path.join(this.config.projectPath, "upload.jpg");
```

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/ci/JdCI.ts
git commit -m "feat(core): use configurable qrcodePath in JdCI"
```

---

## Task 10: 新增 CI 适配器路径选取行为测试

**Files:**

- Modify: `packages/core/tests/ci-base.test.ts`

查看 `ci-base.test.ts` 现有结构，在适当位置新增以下测试。如果现有文件中有 mock CI 实例的工厂函数，复用它；否则参考以下方式构造。

- [ ] **Step 1: 编写失败测试**

在 `packages/core/tests/ci-base.test.ts` 中（或新建 `packages/core/tests/ci-qrcode-path.test.ts`）新增：

```ts
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

/**
 * 测试 CI 适配器是否正确选取 qrcodePath（自定义路径 vs 默认路径）
 *
 * 注意：这里只测试路径选取逻辑，不涉及真实 SDK 调用。
 * 各平台 CI 适配器的 preview/upload 均将路径计算拆分后直接使用，
 * 所以通过检查 createResult 返回的 qrCodeLocalPath 来断言路径是否正确。
 */
describe("CI adapter - qrcodePath selection", () => {
  /** 创建最小化 normalized config */
  function makeConfig(platform: string, qrcodePath?: { preview?: string; upload?: string }) {
    return {
      operation: "preview" as const,
      platform,
      cwd: "/cwd",
      projectPath: "/project",
      version: "1.0.0",
      desc: "test",
      packageJson: {},
      platformConfig: {} as any,
      qrcodePath,
    };
  }

  it("WeappCI.preview() 未配置 qrcodePath 时使用默认路径 preview.jpg", async () => {
    const { WeappCI } = await import("../src/ci/WeappCI");
    const ci = new WeappCI(makeConfig("mp-weixin") as any);

    // mock ci 和 instance，避免真实 SDK 调用
    (ci as any).ci = {
      Project: vi.fn(),
      preview: vi.fn().mockResolvedValue({ subPackageInfo: [] }),
    };
    (ci as any).instance = {};

    // mock readQrcodeImageContent and printQrcode2Terminal
    vi.mock("../src/utils/qrcode", () => ({
      readQrcodeImageContent: vi.fn().mockResolvedValue("mock-qr"),
      printQrcode2Terminal: vi.fn().mockResolvedValue(undefined),
      generateQrcodeImageFile: vi.fn().mockResolvedValue(undefined),
    }));

    const result = await ci.preview();
    expect(result.qrCodeLocalPath).toBe("/project/preview.jpg");
  });

  it("WeappCI.preview() 配置了 qrcodePath.preview 时使用自定义路径", async () => {
    const { WeappCI } = await import("../src/ci/WeappCI");
    const config = makeConfig("mp-weixin", { preview: "/custom/preview.png" });
    const ci = new WeappCI(config as any);

    (ci as any).ci = {
      Project: vi.fn(),
      preview: vi.fn().mockResolvedValue({ subPackageInfo: [] }),
    };
    (ci as any).instance = {};

    const result = await ci.preview();
    expect(result.qrCodeLocalPath).toBe("/custom/preview.png");
  });
});
```

> **注意：** 如果现有的 `ci-base.test.ts` 已经有完整的 mock 设施，优先复用那里的 helper。如果 mock 策略和现有代码冲突，可另建 `ci-qrcode-path.test.ts`。

- [ ] **Step 2: 运行测试**

```bash
cd packages/core && npx vitest run tests/ci-base.test.ts
```

Expected: 新增测试通过。如果有 mock 问题，调整 mock 方式（例如改用 `vi.spyOn`）。

- [ ] **Step 3: 运行所有 core 测试，确认无回归**

```bash
cd packages/core && npx vitest run
```

Expected: 全部通过。

- [ ] **Step 4: Commit**

```bash
git add packages/core/tests/
git commit -m "test(core): add CI adapter qrcodePath selection tests"
```

---

## Task 11: 最终回归验证

- [ ] **Step 1: 运行全部测试**

```bash
pnpm test
```

Expected: 所有包的所有测试通过。

- [ ] **Step 2: 构建验证**

```bash
pnpm build
```

Expected: 构建成功，无 TypeScript 报错。

- [ ] **Step 3: 最终 Commit（如有遗漏）**

```bash
git add -A
git commit -m "feat(core): support custom qrcodePath for preview and upload QR code images"
```
