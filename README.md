# uni-mini-ci

uniapp 小程序 CI 工具集，在 `uni build` 完成后自动执行打开开发者工具、上传开发版预览、上传体验版等操作。提供 **CLI** 和 **Vite 插件**两种使用方式，底层共享同一套平台 CI 运行时。

## 包结构

本仓库为 monorepo，包含三个独立发布的 npm 包：

| 包名                      | 说明                                       |
| ------------------------- | ------------------------------------------ |
| `uni-mini-ci-cli`         | CLI 命令 `minici` 和 `defineConfig()`      |
| `vite-plugin-uni-mini-ci` | Vite 插件 `uniMiniCI()`                    |
| `uni-mini-ci-core`        | 共享运行时（内部依赖，通常不需要直接安装） |

`uni-mini-ci-core` 承载平台 CI 实现、配置归一化、公共类型和 `runMiniCIWithConfig()`，由 CLI 和 Vite 插件各自作为普通依赖引入，不需要手动安装。

## 支持的平台

| 平台         | SDK 包名            |
| ------------ | ------------------- |
| `mp-weixin`  | `miniprogram-ci`    |
| `mp-alipay`  | `minidev`           |
| `mp-baidu`   | `swan-toolkit`      |
| `mp-jd`      | `jd-miniprogram-ci` |
| `mp-toutiao` | `tt-ide-cli`        |

按需安装目标平台 SDK：

```bash
pnpm add -D miniprogram-ci   # 微信
pnpm add -D minidev           # 支付宝
pnpm add -D swan-toolkit      # 百度
pnpm add -D jd-miniprogram-ci # 京东
pnpm add -D tt-ide-cli        # 抖音
```

## 支持的操作

两种使用方式均支持以下三个操作：

| 操作        | 说明                       |
| ----------- | -------------------------- |
| `--open`    | 打开开发者工具             |
| `--preview` | 上传开发版并生成预览二维码 |
| `--upload`  | 上传体验版                 |

`--open`、`--preview`、`--upload` 可以组合使用；组合时执行顺序固定为 `open -> preview -> upload`，不受命令行书写顺序影响。

## 共享配置字段

CLI 的 `minici.config.ts` 和 Vite 插件的 `uniMiniCI(options)` 使用同一套配置结构：

| 字段          | 类型                        | 说明                                                                                                                                       |
| ------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `version`     | `string`                    | 发布版本号，不定义时默认读取 `package.json` 中的 `version`                                                                                 |
| `desc`        | `string \| (ctx) => string` | 发布描述，不定义时默认取 package.json 中的 description；函数形式时 ctx: `{ operation, platform, version, projectPath, cwd, packageJson }`. |
| `projectPath` | `string`                    | 构建产物目录，支持相对路径                                                                                                                 |
| `hooks`       | `MiniCIHooks`               | 完成和错误 hook。支持 `onPreviewComplete`、`onUploadComplete`、`onError`，CLI 和 Vite 插件共享同一结构 |
| `mp-weixin`   | `WeappConfig`               | 微信小程序平台配置                                                                                                                         |
| `mp-alipay`   | `AlipayConfig`              | 支付宝小程序平台配置                                                                                                                       |
| `mp-baidu`    | `SwanConfig`                | 百度小程序平台配置                                                                                                                         |
| `mp-jd`       | `JdConfig`                  | 京东小程序平台配置                                                                                                                         |
| `mp-toutiao`  | `TTConfig`                  | 抖音小程序平台配置                                                                                                                         |

各平台配置字段的详细说明见对应使用文档。

## CLI 使用

```bash
pnpm add -D uni-mini-ci-cli
```

在项目根目录创建 `minici.config.ts`：

```ts
import { defineConfig } from "uni-mini-ci-cli";

export default defineConfig({
  version: "1.0.0",
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
  "mp-weixin": {
    appid: "wx1234567890abcdef",
    privateKeyPath: "key/private.key",
    robot: 1,
  },
});
```

构建后执行 CI 操作：

```bash
minici --upload --platform mp-weixin
minici --preview --platform mp-weixin
minici --open   --platform mp-weixin --dev
minici --open --preview --upload --platform mp-weixin
```

详细用法、参数说明和平台配置 → [docs/cli.md](docs/cli.md)

## Vite 插件使用

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
      version: "1.0.0",
      desc: ({ platform, version }) => `${platform} v${version} 自动构建`,
      "mp-weixin": {
        appid: "wx1234567890abcdef",
        privateKeyPath: "key/private.key",
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
uni dev   -p mp-weixin -- --open
uni dev   -p mp-weixin -- --open --preview
```

`uni dev` 场景支持 `--open` 和 `--preview`，不支持 `--upload`。

插件模式不读取 `minici.config.ts`，平台和产物目录由 `UNI_PLATFORM`、`UNI_OUTPUT_DIR` 自动注入。

详细用法、构建模式差异和多平台配置 → [docs/vite-plugin.md](docs/vite-plugin.md)

## 开发

```bash
pnpm install
pnpm run test
pnpm run build
```
