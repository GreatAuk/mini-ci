# 二维码图片保存路径自定义 — 设计文档

**日期：** 2026-05-14
**状态：** 待实现

---

## 背景

运行 `--preview` 或 `--upload` 时，各平台 CI 适配器会将二维码图片保存到本地。当前路径全部硬编码为 `<projectPath>/preview.jpg` 或 `<projectPath>/upload.png`（扩展名因平台而异），用户无法自定义保存位置。

---

## 目标

在顶层 `MiniCIConfig` 中增加可选的 `qrcodePath` 字段，允许用户分别指定 `preview` 和 `upload` 操作的二维码图片保存路径。未配置时回退到各平台原有默认路径。

---

## 配置结构

### 用户配置（`MiniCIConfig`）

```ts
interface MiniCIConfig {
  // ...已有字段...
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
}
```

- 路径可为绝对路径或相对路径
- 相对路径从 `cwd`（当前工作目录）解析，与 `privateKeyPath` 的处理规则一致
- 两个字段均为可选，未填写时各平台沿用现有默认路径

### Schema 校验（`schema.ts`）

新增：

```ts
const qrcodePathSchema = z
  .object({
    preview: z.string().optional(),
    upload: z.string().optional(),
  })
  .strict()
  .optional();
```

并在 `miniciConfigSchema` 中添加 `qrcodePath: qrcodePathSchema`。

---

## 规范化层（normalize）

### `NormalizedMiniCIConfigBase` 新增字段

```ts
interface NormalizedMiniCIConfigBase {
  // ...已有字段...
  qrcodePath?: {
    preview?: string; // 已解析为绝对路径
    upload?: string; // 已解析为绝对路径
  };
}
```

### `normalizeConfig` 处理逻辑

```ts
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
```

normalize 层只负责路径解析（相对 → 绝对），**不填充默认文件名**，因为各平台的默认扩展名不同。

---

## CI 适配器修改

共 5 个平台需要修改，改动模式一致：

### 修改模式

```ts
// preview() 中
const previewQrcodePath =
  this.config.qrcodePath?.preview ??
  path.join(this.config.projectPath, "<platform-default-filename>");

// upload() 中
const uploadQrcodePath =
  this.config.qrcodePath?.upload ??
  path.join(this.config.projectPath, "<platform-default-filename>");
```

### 各平台默认文件名（保持不变）

| 平台                 | preview 默认  | upload 默认  |
| -------------------- | ------------- | ------------ |
| mp-weixin (WeappCI)  | `preview.jpg` | `upload.png` |
| mp-alipay (AlipayCI) | `preview.png` | `upload.png` |
| mp-baidu (SwanCI)    | `preview.png` | `upload.png` |
| mp-toutiao (TTCI)    | `preview.png` | `upload.png` |
| mp-jd (JdCI)         | `preview.jpg` | `upload.jpg` |

---

## 数据流

```
用户配置文件 (minici.config.ts)
  └─ qrcodePath: { preview: "./output/preview.png" }
       ↓
validateConfig (schema.ts)  ← 字段合法性校验
       ↓
normalizeConfig (normalize.ts)  ← 相对路径解析为绝对路径
       ↓
NormalizedMiniCIConfig.qrcodePath = { preview: "/abs/path/preview.png" }
       ↓
CI 适配器 (e.g. WeappCI.preview())
  └─ const previewQrcodePath = this.config.qrcodePath?.preview ?? "<default>"
```

---

## 错误处理

- Schema 层：`qrcodePath.preview` / `upload` 若提供必须为非空字符串（但允许不提供）
- 路径解析：normalize 层复用现有 `normalizeProjectPath` 函数，无需额外错误处理
- 文件系统：CI 适配器在写入时若目录不存在，交由各平台 SDK 或 `generateQrcodeImageFile` 抛出原有错误，不新增额外检查

---

## 测试计划

### `config.test.ts`（已有文件，新增用例）

1. `qrcodePath` 未配置 → normalize 结果中 `qrcodePath` 为 `undefined`
2. 相对路径 `./output/preview.png` → 解析为 `<cwd>/output/preview.png`
3. 绝对路径 `/tmp/preview.png` → 原样保留
4. 仅配置 `preview` → `upload` 为 `undefined`

### `ci-base.test.ts`（已有文件，新增用例）或各平台专项测试

1. 配置了 `qrcodePath.preview` 时，CI 适配器使用该路径
2. 未配置 `qrcodePath` 时，CI 适配器使用各自平台默认路径

---

## 改动文件清单

| 文件                                             | 改动类型                                                                |
| ------------------------------------------------ | ----------------------------------------------------------------------- |
| `packages/core/src/types.ts`                     | 新增 `qrcodePath` 字段到 `MiniCIConfig` 和 `NormalizedMiniCIConfigBase` |
| `packages/core/src/config/schema.ts`             | 新增 `qrcodePathSchema` 及在 `miniciConfigSchema` 中引用                |
| `packages/core/src/config/normalize.ts`          | normalize 时解析 `qrcodePath` 路径                                      |
| `packages/core/src/ci/WeappCI.ts`                | preview/upload 使用可配置路径                                           |
| `packages/core/src/ci/AlipayCI.ts`               | preview/upload 使用可配置路径                                           |
| `packages/core/src/ci/SwanCI.ts`                 | preview/upload 使用可配置路径                                           |
| `packages/core/src/ci/TTCI.ts`                   | preview/upload 使用可配置路径                                           |
| `packages/core/src/ci/JdCI.ts`                   | preview/upload 使用可配置路径                                           |
| `packages/core/tests/config.test.ts`             | 新增 qrcodePath normalize 测试                                          |
| `packages/core/tests/ci-base.test.ts` 或新建文件 | 新增适配器路径选取测试                                                  |
