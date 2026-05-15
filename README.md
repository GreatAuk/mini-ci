# uni-mini-ci

uniapp 小程序 CI 工具集，在 `uni build` 完成后自动执行打开开发者工具、上传开发版预览、上传体验版等操作。提供 **CLI** 和 **Vite 插件**（推荐）两种使用方式。

## 支持的平台

| 平台                     | 依赖SDK 包名        | SDK 文档                                                                                                                                     |
| ------------------------ | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `mp-weixin（微信）`      | `miniprogram-ci`    | [查看](https://developers.weixin.qq.com/miniprogram/dev/devtools/ci.html)                                                                    |
| `mp-alipay（阿里）`      | `minidev`           | [查看](https://opendocs.alipay.com/mini/02q29z)                                                                                              |
| `mp-baidu（百度）`       | `swan-toolkit`      | [查看](https://smartprogram.baidu.com/docs/develop/devtools/smartapp_cli_function/)                                                          |
| `mp-jd（京东）`          | `jd-miniprogram-ci` | [查看](https://www.npmjs.com/package/jd-miniprogram-ci)                                                                                      |
| `mp-toutiao（字节抖音）` | `tt-ide-cli`        | [查看](https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/dev-tools/developer-instrument/development-assistance/ide-cli) |

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
| `--open`    | 打开开发者工具并打开项目   |
| `--preview` | 上传开发版并生成预览二维码 |
| `--upload`  | 上传体验版并生成预览二维码 |

`--open`、`--preview`、`--upload` 可以组合使用；组合时执行顺序固定为 `open -> preview -> upload`，不受命令行书写顺序影响。

## 共享配置字段

CLI 的 `minici.config.ts` 和 Vite 插件的 `uniMiniCI(options)` 使用同一套配置结构：

| 字段          | 类型                        | 说明                                                                                                                                       |
| ------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `version`     | `string`                    | 发布版本号，不定义时默认读取 `package.json` 中的 `version`                                                                                 |
| `desc`        | `string \| (ctx) => string` | 发布描述，不定义时默认取 package.json 中的 description；函数形式时 ctx: `{ operation, platform, version, projectPath, cwd, packageJson }`. |
| `projectPath` | `string`                    | 构建产物目录，支持相对路径                                                                                                                 |
| `hooks`       | `MiniCIHooks`               | 完成和错误 hook。支持 `onPreviewComplete`、`onUploadComplete`、`onError`，CLI 和 Vite 插件共享同一结构                                     |
| `mp-weixin`   | `WeappConfig`               | 微信小程序平台配置                                                                                                                         |
| `mp-alipay`   | `AlipayConfig`              | 支付宝小程序平台配置                                                                                                                       |
| `mp-baidu`    | `SwanConfig`                | 百度小程序平台配置                                                                                                                         |
| `mp-jd`       | `JdConfig`                  | 京东小程序平台配置                                                                                                                         |
| `mp-toutiao`  | `TTConfig`                  | 抖音小程序平台配置                                                                                                                         |

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

详细用法、构建模式差异和多平台配置 → [docs/vite-plugin.md](docs/vite-plugin.md)

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
minici --open   --platform mp-weixin --dev
minici --open --preview --upload --platform mp-weixin
```

详细用法、参数说明和平台配置 → [docs/cli.md](docs/cli.md)

## Tip

常用 script 示例:

```json
{
  "scripts": {
    // 构建生产包（测试接口） -> 终端显示预览二维码。（等同 `build` 生产包后，点击微信开发工具的『预览』按钮）
    "build:mp-weixin:preview:test": "uni build -p mp-weixin --mode test -- --preview",

    // 构建生产包（生产接口） -> 上传代码到微信控制台作为开发版本 -> 终端显示预览二维码
    "build:mp-weixin:upload": "uni build -p mp-weixin -- --upload",

    // 运行开发模式 -> 自动打开微信开发者工具并打开项目
    "dev:mp-weixin": "uni dev -p mp-weixin -- --open"
  }
}
```

---

`desc` 支持函数形式， 如下面的配置支持让用户手动输入，部分 script 命令时又可自动生成

```ts
import readline from "node:readline/promises";
import process from "node:process";

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

export default defineConfig({
  plugins: [
    uni(),
    uniMiniCI({
      desc: getDesc,
    }),
  ],
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
