# Vite 插件使用文档

`vite-plugin-uni-mini-ci` 提供 `uniMiniCI()` Vite 插件，与 uniapp 的 Vite 构建流程深度集成，构建完成后自动执行 CI 操作。

> monorepo 拆分后，`uniMiniCI()` 只从 `vite-plugin-uni-mini-ci` 导出；`uni-mini-ci-cli` 只保留 CLI 入口和 `defineConfig()`。

## 安装

```bash
pnpm add -D vite-plugin-uni-mini-ci
```

同样需要安装目标平台 SDK：

```bash
# 微信
pnpm add -D miniprogram-ci
# 支付宝
pnpm add -D minidev
# 其他平台参考 CLI 文档
```

## 基本用法

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
      // 函数形式仅在 upload 操作时调用，open/preview 操作跳过并使用默认描述
      desc: ({ platform, version }) => `${platform} v${version} 自动构建`,
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
        robot: 1,
      },
      "mp-alipay": {
        appid: "2021001100000001",
        toolId: "tool-id-xxx",
        privateKeyPath: "key/alipay.key",
      },
    }),
  ],
});
```

## 触发操作

插件通过 `--` 后的参数来决定执行哪个 CI 操作：

```bash
# 构建后上传体验版
uni build -p mp-weixin -- --upload

# 构建后生成预览二维码
uni build -p mp-weixin -- --preview

# 构建后打开开发者工具
uni build -p mp-weixin -- --open

# 开发模式打开开发者工具
uni dev -p mp-weixin -- --open
```

> **注意**：`--` 是参数分隔符，它之后的参数不会被 uni 命令消费，而是透传给 Vite 插件。

如果不传 `--` 后面的参数，插件不会执行任何操作，构建正常完成。

## 工作原理

### 平台检测

插件通过 `UNI_PLATFORM` 环境变量获取当前编译平台。这个变量由 uni 构建命令自动设置：

```
uni build -p mp-weixin  →  UNI_PLATFORM="mp-weixin"
```

### 产物目录

产物目录通过以下优先级确定：

1. 插件配置中的 `projectPath`
2. `UNI_OUTPUT_DIR` 环境变量（uni 自动设置）

```ts
uniMiniCI({
  // 显式指定产物目录（优先级最高）
  projectPath: "dist/build/mp-weixin",
  // ...
});
```

### 构建模式 vs 开发模式

| 模式    | 触发时机               | 允许的操作                  |
| ------- | ---------------------- | --------------------------- |
| `build` | `closeBundle` hook     | `open`、`preview`、`upload` |
| `serve` | `configureServer` hook | 仅 `open`                   |

开发模式（`uni dev`）下只能执行 `--open` 操作。尝试在 serve 模式使用 `--preview` 或 `--upload` 会抛出错误。

## 插件配置

`uniMiniCI(options)` 接受的配置与 `minici.config.ts` 结构一致：

```ts
interface UniMiniCIPluginOptions {
  /** 发布版本号 */
  version?: string;
  /** 发布描述 */
  desc?: string | ((ctx) => string);
  /** 构建产物目录（优先于 UNI_OUTPUT_DIR） */
  projectPath?: string;
  /** 二维码图片保存路径（可选，未配置时各平台使用默认路径） */
  qrcodePath?: {
    /** preview 操作的二维码图片保存路径 */
    preview?: string;
    /** upload 操作的二维码图片保存路径 */
    upload?: string;
  };
  /** hooks（可选）：preview/upload 完成或错误时触发 */
  hooks?: MiniCIHooks;
  /** 微信小程序配置 */
  "mp-weixin"?: WeappConfig;
  /** 支付宝小程序配置 */
  "mp-alipay"?: AlipayConfig;
  /** 百度小程序配置 */
  "mp-baidu"?: SwanConfig;
  /** 京东小程序配置 */
  "mp-jd"?: JdConfig;
  /** 抖音小程序配置 */
  "mp-toutiao"?: TTConfig;
}
```

> **重要**：插件模式不读取 `minici.config.ts` 配置文件，所有配置直接写在 `uniMiniCI()` 参数中。

## 与 CLI 模式的区别

| 特性     | CLI 模式                        | 插件模式                                 |
| -------- | ------------------------------- | ---------------------------------------- |
| 配置来源 | `minici.config.ts`              | `uniMiniCI(options)`                     |
| 平台指定 | `--platform` 参数               | `UNI_PLATFORM` 环境变量                  |
| 产物目录 | `--projectPath` 或配置          | `projectPath` 或 `UNI_OUTPUT_DIR`        |
| 触发方式 | 手动执行命令                    | 构建完成自动触发                         |
| 开发模式 | `--dev` 标记                    | 由 Vite `serve` 命令决定                 |
| 操作指定 | `--open`/`--preview`/`--upload` | `-- --open`/`-- --preview`/`-- --upload` |

CLI 和插件模式共享同一套 `hooks` 结构。区别只是配置来源不同：CLI 从 `minici.config.ts` 读取，插件从 `uniMiniCI(options)` 读取。

## 多平台配置示例

在同一份 `vite.config.ts` 中配置多个平台，插件会根据当前编译目标自动选择对应配置：

```ts
import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";
import { uniMiniCI } from "vite-plugin-uni-mini-ci";

export default defineConfig({
  plugins: [
    uni(),
    uniMiniCI({
      version: "2.0.0",
      desc: ({ platform, version }) => `${platform} v${version}`,

      "mp-weixin": {
        appid: "wx1234567890abcdef",
        privateKeyPath: "key/weixin.key",
        robot: 1,
      },

      "mp-alipay": {
        appid: "2021001100000001",
        toolId: "tool-id-xxx",
        privateKeyPath: "key/alipay.key",
        clientType: "alipay",
      },

      "mp-baidu": {
        token: "百度鉴权 token",
      },

      "mp-jd": {
        privateKey: "京东密钥",
      },

      "mp-toutiao": {
        email: "dev@example.com",
        password: "xxx",
      },
    }),
  ],
});
```

构建不同平台时，只需切换 `-p` 参数：

```bash
uni build -p mp-weixin -- --upload
uni build -p mp-alipay -- --upload
uni build -p mp-baidu -- --upload
```

## 常见问题

### Q: 为什么执行后没有任何操作？

确保 `--` 后面传了操作参数：

```bash
# ❌ 不会触发任何操作
uni build -p mp-weixin

# ✅ 正确
uni build -p mp-weixin -- --upload
```

### Q: 报错 "无法确定 platform"

确保通过 uni 命令启动构建，它会自动设置 `UNI_PLATFORM` 环境变量。直接用 `vite build` 不会设置此变量。

### Q: 报错 "preview/upload 只支持 build 模式"

开发模式（`uni dev`）下只允许 `--open` 操作。预览和上传需要完整构建产物，请使用 `uni build`。

### Q: 可以同时使用 CLI 和插件模式吗？

可以，但通常二选一：

- 如果已在 Vite 配置中使用插件，构建时自动触发，无需额外 CLI 命令
- 如果偏好手动控制时机，使用 CLI 模式，在 `uni build` 完成后单独执行
