# uni-mini-ci

做 uniapp 小程序开发时，很多团队每天都在重复同一套流程：先执行 uni build，再打开对应平台开发者工具，手动导入
构建产物，点击预览、上传，最后再把二维码或上传结果发给测试、产品或运营。
uni-mini-ci 想解决的就是这件事：把构建后的 CI 操作自动化。

目前提供 **CLI** 和 **Vite 插件**（推荐）两种使用方式。在 `uni` 的 `build` 或 `dev` 命令完成后自动执行:

- 打开开发者工具并打开项目
- 上传开发版并生成预览二维码（等同于点击微信开发者工具中的“预览”按钮）
- 上传体验版并生成预览二维码 (等同于点击微信开发者工具中的“上传”按钮)
- 交交互式的更新版本号 -> 创建 git commit 和 tag -> git push。

如我开发微信小程序的常用工作流

```json
{
  "scripts": {
    // [开发] 运行开发模式 -> 自动打开微信开发者工具并打开项目
    "dev:mp-weixin": "uni dev -p mp-weixin -- --open",

    // [测试] 构建生产包（测试接口） -> 终端显示预览二维码。（等同 `build` 生产包后，点击微信开发工具的『预览』按钮）
    "build:mp-weixin:preview:test": "uni build -p mp-weixin --mode test -- --preview",

    // [测试] 构建生产包（生产接口） -> 上传代码到微信控制台作为开发版本 -> 终端显示预览二维码
    "build:mp-weixin:upload": "uni build -p mp-weixin -- --upload",

    // [上线] 更新 package.json 版本号，创建 git commit 和 tag -> 构建生产包（生产接口） -> 上传代码到微信控制台作为开发版本 -> 终端显示预览二维码
    "build:mp-weixin:release": "uni build -p mp-weixin -- --bump --upload"
  }
}
```

## 支持的平台

> 目前我只测试了微信小程序的，其他平台因为需要开发账号，所以还没测试😬。如果有问题欢迎反馈。

| 平台                     | 依赖 CI SDK 包名    | SDK 文档                                                                                                                                     |
| ------------------------ | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `mp-weixin（微信）`      | `miniprogram-ci`    | [查看](https://developers.weixin.qq.com/miniprogram/dev/devtools/ci.html)                                                                    |
| `mp-alipay（阿里）`      | `minidev`           | [查看](https://opendocs.alipay.com/mini/02q29z)                                                                                              |
| `mp-baidu（百度）`       | `swan-toolkit`      | [查看](https://smartprogram.baidu.com/docs/develop/devtools/smartapp_cli_function/)                                                          |
| `mp-jd（京东）`          | `jd-miniprogram-ci` | [查看](https://www.npmjs.com/package/jd-miniprogram-ci)                                                                                      |
| `mp-toutiao（字节抖音）` | `tt-ide-cli`        | [查看](https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/dev-tools/developer-instrument/development-assistance/ide-cli) |

按需安装目标平台 CI SDK：

```bash
pnpm add -D miniprogram-ci   # 微信
pnpm add -D minidev           # 支付宝
pnpm add -D swan-toolkit      # 百度
pnpm add -D jd-miniprogram-ci # 京东
pnpm add -D tt-ide-cli        # 抖音
```

## 支持的操作

两种使用方式均支持以下操作：

| 操作        | 说明                                                                                                      |
| ----------- | --------------------------------------------------------------------------------------------------------- |
| `--open`    | 打开开发者工具并打开项目                                                                                  |
| `--preview` | 上传开发版并生成预览二维码（等同于点击微信开发者工具中的“预览”按钮）                                      |
| `--upload`  | 上传体验版并生成预览二维码 (等同于点击微信开发者工具中的“上传”按钮)                                       |
| `--bump`    | 在执行 CI 操作前调用 bumpp 交互式的更新版本号 -> 创建 git commit 和 tag -> git push（适用于发布生产版本） |

`--open`、`--preview`、`--upload` 可以组合使用；组合时执行顺序固定为 `open -> preview -> upload`，不受命令行书写顺序影响。

## 共享配置字段

CLI 的 `minici.config.ts` 和 Vite 插件的 `uniMiniCI(options)` 使用同一套配置结构[MiniCIConfig](https://github.com/GreatAuk/mini-ci/blob/e144a9f580d1897da56a38409d20af1fb41e8b89/packages/core/src/types.ts#L207)：

| 字段          | 类型                                                                                                     | 说明                                                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `version`     | `string`                                                                                                 | 发布版本号(一般不建议配置)，不定义时默认读取 `package.json` 中的 `version`。 如果配置了 --bump, 这个配置将不再生效        |
| `desc`        | `string \| (context: MiniCIDescContext) => string \| Promise<string>`                                    | 发布描述，--upload 时使用。不定义时默认取 package.json 中的 description；如果想每次 upload 时自定义，可以参考 [Tip](#Tip) |
| `projectPath` | `string`                                                                                                 | 构建产物目录，支持相对路径。正常不需要定义，内部自动判断                                                                  |
| `hooks`       | `MiniCIHooks`                                                                                            | 完成和错误 hook。支持 `onPreviewComplete`、`onUploadComplete`、`onError`                                                  |
| `qrcodePath`  | `{preview?: string, upload: string}`                                                                     | 二维码图片保存路径, 可选                                                                                                  |
| `bumpOptions` | `VersionBumpOptions \| ((ctx: BumpOptionsContext) => VersionBumpOptions \| Promise<VersionBumpOptions>)` | bumpp 程序化 API 参数。mini-ci 默认 `commit` 为 `true`、`tag/push` 为 `false`，可在此显式覆盖                             |
| `mp-weixin`   | `WeappConfig`                                                                                            | 微信小程序平台配置                                                                                                        |
| `mp-alipay`   | `AlipayConfig`                                                                                           | 支付宝小程序平台配置                                                                                                      |
| `mp-baidu`    | `SwanConfig`                                                                                             | 百度小程序平台配置                                                                                                        |
| `mp-jd`       | `JdConfig`                                                                                               | 京东小程序平台配置                                                                                                        |
| `mp-toutiao`  | `TTConfig`                                                                                               | 抖音小程序平台配置                                                                                                        |

### hooks

`hooks` 支持同步或异步函数，异步函数执行完成后才会继续后续流程。CLI 和 Vite 插件共用以下回调：

| 回调                | 触发时机                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------- |
| `onPreviewComplete` | 进入 `preview` CI 方法后触发，成功和失败都会触发。可在此发送预览结果的邮件、飞书等通知                        |
| `onUploadComplete`  | 进入 `upload` CI 方法后触发，成功和失败都会触发。可在此发送上传结果的邮件、飞书等通知                         |
| `onError`           | bump、配置归一化、项目路径检查、CI 初始化、CI 操作或 complete hook 发生错误时触发，用于统一记录或上报错误信息 |

`onPreviewComplete` 和 `onUploadComplete` 接收相同的数据结构：

| 字段                   | TypeScript 类型       | 说明                                    |
| ---------------------- | --------------------- | --------------------------------------- |
| `success`              | `boolean`             | 当前 `preview` 或 `upload` 操作是否成功 |
| `data.platform`        | `MiniCIPlatform`      | 当前小程序平台                          |
| `data.version`         | `string`              | 当前版本号                              |
| `data.desc`            | `string`              | 当前发布描述                            |
| `data.projectPath`     | `string`              | 小程序构建产物目录                      |
| `data.qrCodeLocalPath` | `string \| undefined` | 二维码本地路径，未生成时为空            |
| `data.qrCodeContent`   | `string \| undefined` | 二维码内容，未生成时为空                |
| `error`                | `Error \| undefined`  | 操作失败时的错误对象，成功时为空        |

`onError` 接收 `error` 错误对象，以及可能存在的 `operation`、`platform` 和 `data` 上下文。错误发生得越早，可提供的上下文字段越少；例如 bump 失败时 `operation` 为空。

当 `preview` 或 `upload` CI 方法失败时，会先执行对应的 complete hook（`success` 为 `false`），再执行 `onError`，最后终止主流程。配置归一化、项目路径检查、CI 初始化等前置阶段失败时只执行 `onError`。`open` 操作不执行 complete hook，但执行失败时会触发 `onError`。

可以通过 `result.success` 区分成功和失败通知。以下 `sendNotification` 是业务侧通知函数的示例，可替换为邮件服务或飞书机器人接口：

```ts
import { defineConfig } from "uni-mini-ci-cli";

/**
 * 发送构建结果通知。
 *
 * @param input 通知内容
 */
async function sendNotification(input: { title: string; message: string }) {
  // 在这里调用邮件或飞书通知 API
}

export default defineConfig({
  hooks: {
    /** preview 完成后发送通知 */
    async onPreviewComplete(result) {
      await sendNotification({
        title: result.success ? "小程序预览成功" : "小程序预览失败",
        message: result.success
          ? [
              `二维码路径：${result.data.qrCodeLocalPath ?? "未生成"}`,
              `二维码 URL/内容：${result.data.qrCodeContent ?? "未生成"}`,
            ].join("\n")
          : (result.error?.message ?? "未知错误"),
      });
    },
    /** upload 完成后发送通知 */
    async onUploadComplete(result) {
      await sendNotification({
        title: result.success ? "小程序上传成功" : "小程序上传失败",
        message: result.success
          ? [
              `${result.data.platform} v${result.data.version}`,
              `二维码路径：${result.data.qrCodeLocalPath ?? "未生成"}`,
              `二维码 URL/内容：${result.data.qrCodeContent ?? "未生成"}`,
            ].join("\n")
          : (result.error?.message ?? "未知错误"),
      });
    },
  },
});
```

### bumpOptions

`bumpOptions` 复用 [bumpp](https://github.com/antfu-collective/bumpp) 的 `VersionBumpOptions`。文档只列出常用字段：

| 字段      | 说明                                                                                   |
| --------- | -------------------------------------------------------------------------------------- |
| `release` | 发布类型或明确版本号，例如 `patch`、`minor`、`major`、`1.2.3`                          |
| `commit`  | 是否创建 git commit。 默认 `true`                                                      |
| `tag`     | 是否创建 git tag。默认 `false`                                                         |
| `push`    | 是否推送 commit 和 tag。 默认 `false`                                                  |
| `confirm` | 是否让用户执行确认提示，默认是 true. 如果需要适用 CI/CD 等自动化场景，建议设置为 false |

各平台配置字段的详细说明见对应使用文档。

## Vite 插件使用(推荐)

```bash
pnpm add -D vite-plugin-uni-mini-ci
```

在 `vite.config.ts` 中注册插件：

```ts
import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";
import { uniMiniCI } from "vite-plugin-uni-mini-ci";

export default defineConfig({
  plugins: [
    uni(),
    uniMiniCI({
      desc: ({ platform, version }) => `${platform} v${version} 自动构建`,
      "mp-weixin": {
        // 如果只想 --open 操作，可以不配置 "mp-weixin"
        appid: "wx1234567890abcdef",
        privateKeyPath: "./key/private.key",
        robot: 1,
      },
    }),
  ],
});
```

通过 `--` 向插件透传操作参数，构建完成后自动执行：

```bash
uni build -p mp-weixin -- --upload
uni build -p mp-weixin -- --preview
uni build -p mp-weixin -- --preview --upload
uni -p mp-weixin -- --open
```

> ！`-- --upload` 开头的 `--` 是必须的，用来结束 uni 自身参数，后续参数由插件解析（因为 uni 命令不支持新增命令参数，所以只能出此下策）。

`uni dev` 场景支持 `--open` 和 `--preview`，不支持 `--upload`。

详细用法、构建模式差异 → [docs/vite-plugin.md](docs/vite-plugin.md)

## CLI 使用

```bash
pnpm add -D uni-mini-ci-cli
```

在项目根目录创建 `minici.config.ts`：

```ts
import { defineConfig } from "uni-mini-ci-cli";

export default defineConfig({
  desc: ({ platform, version }) => `${platform} v${version} 自动构建`,
  hooks: {
    async onPreviewComplete(result) {
      console.log("preview 完成", result.success, result.data.qrCodeLocalPath);
    },
    async onUploadComplete(result) {
      console.log("upload 完成", result.success, result.data.version);
    },
    async onError(result) {
      console.error("CI 错误", result.operation, result.error.message);
    },
  },
  // bumpp 配置（可选）：版本更新相关
  bumpOptions: {
    commit: true,
    tag: true,
    push: false,
  },
  "mp-weixin": {
    appid: "wx1234567890abcdef",
    privateKeyPath: "./key/private.key",
    robot: 1,
  },
});
```

构建后执行 CI 操作：

```bash
minici --upload --platform mp-weixin
minici --preview --platform mp-weixin
minici --open --platform mp-weixin --dev # 开发环境下，需要显示的定义 --dev, 否则会从 dist/build/mp-weixin 读取产物。
minici --open --preview --upload --platform mp-weixin
```

注意，使用 cli，如果你想开发时直接打开开发工具 `"dev:mp-weixin": "uni -p mp-weixin && minici --open --platform mp-weixin",`, `--open` 并不会生效，因为 `uni dev` 会启动一个持续监听的本地开发服务器，导致命令不会结束，无法运行 `&&` 后续的 `minici` 命令。如果需要这样使用，建议让 AI 找找 hack 方案，或者直接使用 Vite 插件版本。

## Tip

常用 script 示例:

```json
{
  "scripts": {
    // [开发] 运行开发模式 -> 自动打开微信开发者工具并打开项目
    "dev:mp-weixin": "uni dev -p mp-weixin -- --open",

    // [测试] 构建生产包（测试接口） -> 终端显示预览二维码。（等同 `build` 生产包后，点击微信开发工具的『预览』按钮）
    "build:mp-weixin:preview:test": "uni build -p mp-weixin --mode test -- --preview",

    // [测试] 构建生产包（生产接口） -> 上传代码到微信控制台作为开发版本 -> 终端显示预览二维码
    "build:mp-weixin:upload": "uni build -p mp-weixin -- --upload",

    // [上线] 更新 package.json 版本号，创建 git commit 和 tag -> 构建生产包（生产接口） -> 上传代码到微信控制台作为开发版本 -> 终端显示预览二维码
    "build:mp-weixin:release": "uni build -p mp-weixin -- --upload --bump"
  }
}
```

```ts
// vite.config.ts
export default defineConfig({
  plugins: [
    uniMiniCI({
      ...
      bumpOptions: {
        commit: true,
        tag: true,
        push: true,
      },
    }),
  ],
});
```

---

`desc` 支持函数形式， 如下面的配置支持让用户手动输入，部分 script 命令时又可自动生成

```ts
import readline from "node:readline/promises";
import process from "node:process";

export default defineConfig({
  plugins: [
    uni(),
    uniMiniCI({
      desc: getDesc,
    }),
  ],
});

async function getDesc() {
  // 当前执行的 npm script
  const npmScript = process.env.npm_lifecycle_event;

  // 只有 npm 命令以 :upload:release 结尾才会询问用户，填写更新备注
  if (npmScript?.endsWith(":upload:release")) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const desc = await rl.question("请填写更新备注(如不填写，默认：优化体验，修复缺陷)：");
    rl.close();
    return desc;
  }
  if (npmScript?.endsWith(":test")) return "优化体验，修复缺陷 [测试环境接口]";

  return "优化体验，修复缺陷";
}
```

## Programmatic API

也可以在代码中调用：

```ts
import { runMiniCIWithConfig } from "uni-mini-ci-core";

// 直接传入配置
await runMiniCIWithConfig({
  args: {
    operation: "upload",
    platform: "mp-weixin",
    projectPath: "dist/build/mp-weixin",
  },
  cwd: process.cwd(),
  config: {
    version: "1.0.0",
    "mp-weixin": {
      appid: "wx1234567890abcdef",
      privateKeyPath: "key/private.key",
    },
  },
});
```

## 平台配置详解

### 微信小程序 (`mp-weixin`)

```ts
{
  "mp-weixin": {
    appid: "wx1234567890abcdef",    // 必填
    privateKeyPath: "key/private.key", // 必填，CI 密钥文件路径
    robot: 1,                        // 机器人编号 1-30
    type: "miniProgram",             // 项目类型
    ignores: ["node_modules/**"],    // 上传排除目录
    setting: {},                     // 编译设置
    devToolsInstallPath: "",         // 开发者工具安装路径
  }
}
```

### 支付宝小程序 (`mp-alipay`)

```ts
{
  "mp-alipay": {
    appid: "2021001100000001",       // 必填
    toolId: "tool-id-xxx",           // 必填
    privateKeyPath: "key/alipay.key", // 私钥文件路径（二选一）
    privateKey: "-----BEGIN...",      // 私钥文本（二选一）
    clientType: "alipay",            // 上传终端类型
    deleteVersion: "0.0.1",          // 上传时删除的旧版本
    devToolsInstallPath: "",         // 开发者工具安装路径
  }
}
```

### 百度小程序 (`mp-baidu`)

```ts
{
  "mp-baidu": {
    token: "百度小程序鉴权 token",    // 必填
    minSwanVersion: "3.350.0",       // 最低基础库版本
    devToolsInstallPath: "",         // 开发者工具安装路径
  }
}
```

### 京东小程序 (`mp-jd`)

```ts
{
  "mp-jd": {
    privateKey: "京东小程序密钥",      // 必填
    robot: 1,                        // 机器人编号
    ignores: [],                     // 上传忽略规则
  }
}
```

### 抖音小程序 (`mp-toutiao`)

```ts
{
  "mp-toutiao": {
    email: "dev@example.com",        // 必填
    password: "xxx",                 // 必填
    setting: {
      skipDomainCheck: false,        // 是否跳过域名校验
    },
  }
}
```

## 开发

```bash
pnpm install
pnpm run test
pnpm run build
```

## 包结构

本仓库为 monorepo，包含三个独立发布的 npm 包：

| 包名                      | 说明                                       |
| ------------------------- | ------------------------------------------ |
| `uni-mini-ci-cli`         | CLI 命令 `minici` 和 `defineConfig()`      |
| `vite-plugin-uni-mini-ci` | Vite 插件 `uniMiniCI()`                    |
| `uni-mini-ci-core`        | 共享运行时（内部依赖，通常不需要直接安装） |

`uni-mini-ci-core` 承载平台 CI 实现、配置归一化、公共类型和 `runMiniCIWithConfig()`，由 CLI 和 Vite 插件各自作为普通依赖引入，不需要手动安装。

## 感谢

[taro-plugin-mini-ci](https://github.com/NervJS/taro/tree/main/packages/taro-plugin-mini-ci)
