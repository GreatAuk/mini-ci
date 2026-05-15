# hooks 机制设计文档

## 背景

`uni-mini-ci` 当前已经拆分为 `uni-mini-ci-core`、`uni-mini-ci-cli` 和 `vite-plugin-uni-mini-ci`。CLI 和 Vite 插件都通过 `runMiniCIWithConfig()` 进入共享运行时，平台 CI 适配器在 `preview()` / `upload()` 成功后返回 `MiniCISingleResult`，其中已经包含平台、版本、描述、项目目录、二维码本地路径和二维码内容。

本设计新增共享 hooks 机制，让用户可以在 CLI 的 `minici.config.ts` 和 Vite 插件的 `uniMiniCI(options)` 中配置同一套 hooks。第一版只覆盖 `preview`、`upload` 完成通知和共享错误通知，不引入完整生命周期系统。

## 已确认决策

- hooks 作为共享配置能力进入 `MiniCIConfig`，CLI 和 Vite 插件都支持。
- 使用 `hooks` 命名空间，而不是把 hook 字段平铺到配置顶层。
- 新增 `hooks.onPreviewComplete`、`hooks.onUploadComplete` 和 `hooks.onError`。
- `onPreviewComplete` / `onUploadComplete` 在进入对应 `ci.preview()` / `ci.upload()` 后，成功和失败时都触发。
- `normalizeConfig()`、`projectPath` 检查、`ci.init()` 等前置失败只触发 `onError`，不触发 complete hook。
- `ci.preview()` / `ci.upload()` 失败时，同时触发对应 complete hook 和 `onError`。
- 同时触发时，顺序固定为：先 complete hook，再 `onError`，最后让主流程失败。
- hook 函数自身抛错或 reject 时，主流程失败，CLI 退出码为 `1`，Vite 插件继续向上抛错。
- `qrCodeLocalPath` 和 `qrCodeContent` 在 hook 数据中是可选字段，失败时不强行填空字符串。
- `onError` 覆盖 `runMiniCIWithConfig()` 内、已经拿到 `config.hooks` 之后的错误。
- `onError` 不覆盖 CLI 参数解析失败和配置文件加载失败，因为这些错误发生时还没有可用的 `MiniCIConfig`。

## API 结构

在 `packages/core/src/types.ts` 中新增 hooks 类型，并在 `MiniCIConfig` 顶层增加 `hooks?: MiniCIHooks`。

```ts
/** minici hooks 配置 */
export interface MiniCIHooks {
  /** CI 执行 preview 后触发，成功和失败都会触发 */
  onPreviewComplete?: MiniCICompleteHook;
  /** CI 执行 upload 后触发，成功和失败都会触发 */
  onUploadComplete?: MiniCICompleteHook;
  /** 共享错误通知，在 runMiniCIWithConfig 内捕获到错误后触发 */
  onError?: MiniCIErrorHook;
}

/** minici 完成 hook 函数 */
export type MiniCICompleteHook = (data: MiniCICompleteHookData) => void | Promise<void>;

/** minici 错误 hook 函数 */
export type MiniCIErrorHook = (data: MiniCIErrorHookData) => void | Promise<void>;

/** minici 完成 hook 数据 */
export interface MiniCICompleteHookData {
  /** 当前操作是否成功 */
  success: boolean;
  /** 当前操作上下文和产物信息 */
  data: {
    /** 当前构建的小程序平台 */
    platform: MiniCIPlatform;
    /** 预览码本地路径 */
    qrCodeLocalPath?: string;
    /** 预览码内容 */
    qrCodeContent?: string;
    /** 插件或 CLI 传递的版本号 */
    version: string;
    /** 插件或 CLI 传递的描述文本 */
    desc: string;
    /** 预览或上传的目录路径 */
    projectPath: string;
  };
  /** 错误对象 */
  error?: Error;
}

/** minici 错误 hook 数据 */
export interface MiniCIErrorHookData {
  /** 错误发生在哪个操作；如果还没进入具体操作则为空 */
  operation?: MiniCIOperation;
  /** 当前平台；从运行参数能拿到时提供 */
  platform?: MiniCIPlatform;
  /** 错误对象 */
  error: Error;
  /** 已经解析出来的上下文；失败太早时可能为空或只有部分字段 */
  data?: Partial<{
    /** 当前构建的小程序平台 */
    platform: MiniCIPlatform;
    /** 预览码本地路径 */
    qrCodeLocalPath: string;
    /** 预览码内容 */
    qrCodeContent: string;
    /** 插件或 CLI 传递的版本号 */
    version: string;
    /** 插件或 CLI 传递的描述文本 */
    desc: string;
    /** 预览或上传的目录路径 */
    projectPath: string;
  }>;
}
```

导出策略：

- `uni-mini-ci-core` 导出 `MiniCIHooks`、`MiniCICompleteHook`、`MiniCIErrorHook`、`MiniCICompleteHookData`、`MiniCIErrorHookData`。
- `uni-mini-ci-cli` 从 core 转导这些类型。
- `vite-plugin-uni-mini-ci` 的 `UniMiniCIPluginOptions extends MiniCIConfig` 自动获得 `hooks` 字段。

## 配置示例

CLI 模式：

```ts
import { defineConfig } from "uni-mini-ci-cli";

export default defineConfig({
  version: "1.0.0",
  hooks: {
    async onPreviewComplete(result) {
      console.log("preview 完成", result.success, result.data.qrCodeLocalPath);
    },
    async onUploadComplete(result) {
      console.log("upload 完成", result.success, result.data.version);
    },
    async onError(result) {
      console.error("minici 执行失败", result.operation, result.error.message);
    },
  },
  "mp-weixin": {
    appid: "wx1234567890abcdef",
    privateKeyPath: "key/private.key",
  },
});
```

Vite 插件模式：

```ts
import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";
import { uniMiniCI } from "vite-plugin-uni-mini-ci";

export default defineConfig({
  plugins: [
    uni(),
    uniMiniCI({
      version: "1.0.0",
      hooks: {
        async onUploadComplete(result) {
          console.log("upload 完成", result.success, result.data.qrCodeContent);
        },
        async onError(result) {
          console.error("CI 错误", result.error.message);
        },
      },
      "mp-weixin": {
        appid: "wx1234567890abcdef",
        privateKeyPath: "key/private.key",
      },
    }),
  ],
});
```

## 触发位置

hook 不放进各个平台 CI 适配器里，而是放在 `runMiniCIWithConfig()` 的单 action 执行层。这样五个平台不需要重复实现 hook 逻辑，也能保证 CLI 和 Vite 插件行为一致。

执行流：

```txt
loadPackageJson(cwd)
for operation in args.operations
  try
    normalizeConfig({ args: { ...args, operation }, cwd, config, packageJson })
    assert projectPath exists
    createCI(normalized)
    ci.init()
  catch error
    await trigger onError
    throw error

  try
    result = await ci[operation]()
  catch error
    if operation is preview/upload
      await trigger complete hook with success: false
    await trigger onError
    throw error

  if operation is preview/upload
    try
      await trigger complete hook with success: true
    catch error
      await trigger onError
      throw error

  collect result
return aggregate result
```

`open` 不触发 complete hook。`open` 执行失败时触发 `onError`，因为它属于 `runMiniCIWithConfig()` 内已经拿到 hooks 配置后的错误。

## 数据来源

complete hook 数据由当前单 action 的规范化配置和执行结果组装：

- `platform`：来自 `normalized.platform`
- `version`：来自 `normalized.version`
- `desc`：来自 `normalized.desc`
- `projectPath`：来自 `normalized.projectPath`
- `qrCodeLocalPath` / `qrCodeContent`：成功时来自 `MiniCISingleResult`
- `error`：失败时传入规范化后的 `Error`

`onError` 数据尽量复用当前已知上下文：

- 已进入某个 action 时提供 `operation`
- 能从 `args.platform` 或 `normalized.platform` 取得平台时提供 `platform`
- 已完成 `normalizeConfig()` 时提供 `version`、`desc`、`projectPath`
- 如果错误发生在 `normalizeConfig()` 内，则 `data` 可以为空或只包含已经安全取得的字段
- 如果错误发生在 complete hook 内，则 `error` 是 hook 错误，`data` 复用对应 action 的上下文和结果字段

非 `Error` 抛出值统一包装成 `Error(String(value))` 后再传给 hook。

## 失败语义

`preview` 或 `upload` 成功：

```txt
ci.preview()/ci.upload() succeeds
trigger onPreviewComplete/onUploadComplete with success: true
collect result
continue next action
```

`preview` 或 `upload` 失败：

```txt
ci.preview()/ci.upload() throws
trigger onPreviewComplete/onUploadComplete with success: false and error
trigger onError with same error
throw error
```

前置失败：

```txt
normalizeConfig()/assertPathExists()/ci.init() throws
trigger onError
throw error
```

`open` 失败：

```txt
ci.open() throws
trigger onError
throw error
```

complete hook 自身失败：

```txt
ci.preview()/ci.upload() succeeds or fails
complete hook throws
trigger onError with hook error
throw hook error
```

如果 CI 操作失败后 complete hook 也失败，最终抛 complete hook 错误，并通过 `cause` 保留原始 CI 错误。此时 `onError` 接收 complete hook 错误，原始 CI 错误可从 `error.cause` 追溯。

如果 `onError` 自身失败，最终抛 `onError` 的错误，并通过 `cause` 保留触发 `onError` 的原始错误。

## 多 action 行为

多 action 顺序继续由 `supportedOperations` 固定为 `open -> preview -> upload`，用户传参顺序不影响执行顺序。

示例：

```bash
minici --open --preview --upload --platform mp-weixin
uni build -p mp-weixin -- --preview --upload
```

触发规则：

- `open` 成功：不触发 complete hook，也不触发 `onError`
- `preview` 成功：触发 `hooks.onPreviewComplete`
- `upload` 成功：触发 `hooks.onUploadComplete`
- `preview` 前置失败：只触发 `hooks.onError`，然后 fail-fast，`upload` 不执行
- `preview` CI 方法失败：触发 `hooks.onPreviewComplete({ success: false })`，再触发 `hooks.onError`，然后 fail-fast，`upload` 不执行
- `upload` 前置失败：只触发 `hooks.onError`，然后 fail-fast
- `upload` CI 方法失败：触发 `hooks.onUploadComplete({ success: false })`，再触发 `hooks.onError`，然后 fail-fast

## 配置校验

在 `packages/core/src/config/schema.ts` 中新增 `hooksSchema`：

- `hooks` 是可选对象。
- `onPreviewComplete` / `onUploadComplete` / `onError` 若提供，必须是函数。
- `hooks` 使用 `.strict()`，未知字段报配置错误。
- hook 函数不在 schema 阶段执行，只在对应 action 完成或失败后执行。

## 测试计划

`packages/core/tests/config.test.ts`：

- `hooks` 未配置时配置校验通过。
- `hooks.onPreviewComplete`、`hooks.onUploadComplete`、`hooks.onError` 为函数时校验通过。
- hook 字段为非函数时报配置错误。
- `hooks` 中存在未知字段时报配置错误。

`packages/cli/tests/runner.test.ts` 或新增 core runner 测试：

- `preview` 成功时触发 `onPreviewComplete`，数据包含 `success: true`、平台、版本、描述、项目目录和二维码字段。
- `upload` 成功时触发 `onUploadComplete`。
- `open` 成功时不触发 complete hook。
- `preview` 失败时先触发 `onPreviewComplete({ success: false })`，再触发 `onError`。
- `upload` 失败时先触发 `onUploadComplete({ success: false })`，再触发 `onError`。
- `preview` / `upload` 的前置失败只触发 `onError`，不触发 complete hook。
- `open` 失败时触发 `onError`。
- complete hook 抛错时 `runMiniCIWithConfig()` reject，并触发 `onError`。
- `onError` 抛错时 `runMiniCIWithConfig()` reject，最终错误来自 `onError`。
- CI 方法失败后 complete hook 也抛错时，最终错误来自 complete hook，原始 CI 错误保存在 `cause`。
- 多 action 中 `preview` 失败后 fail-fast，不执行 `upload`，也不触发 `onUploadComplete`。

`packages/vite-plugin/tests/plugin.test.ts`：

- `uniMiniCI({ hooks })` 透传到共享 runner，`--preview` 成功时触发 `onPreviewComplete`。
- `--upload` 失败时触发 `onUploadComplete` 和 `onError`。

`packages/cli/tests/runner.test.ts`：

- `minici.config.mjs` 中配置 `hooks` 时，CLI 执行 `--preview` 能触发 `onPreviewComplete`。

## 文档同步

需要同步更新：

- `README.md`：共享配置字段表增加 `hooks`，并说明 CLI 和 Vite 插件共享。
- `docs/cli.md`：配置示例增加 `hooks`，补充失败时也会触发 complete hook。
- `docs/vite-plugin.md`：插件配置示例增加 `hooks`，说明插件模式不读取 `minici.config.ts` 但 hook 结构一致。

## 成功标准

- `MiniCIConfig` 支持 `hooks` 命名空间。
- CLI 和 Vite 插件都能配置并触发同一套 hooks。
- `preview` / `upload` 进入 CI 方法后的成功和失败都会触发对应 complete hook。
- `preview` / `upload` 的 CI 方法失败时同时触发 `onError`。
- `preview` / `upload` 的前置失败只触发 `onError`。
- `open` 不触发 complete hook，但失败时触发 `onError`。
- hook 自身失败会让主流程失败。
- 配置 schema 保持 strict，非函数 hook 和未知 hook 字段会报错。
- 文档、类型导出和测试覆盖同步更新。
