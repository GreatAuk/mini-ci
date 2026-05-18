1# CLI 使用文档

`uni-mini-ci-cli` 提供 `minici` 命令，在 uniapp 小程序构建产物完成后执行打开开发者工具、上传预览版、上传体验版等操作。

## 安装

```bash
pnpm add -D uni-mini-ci-cli
```

按目标平台安装对应 SDK：

```bash
# 微信
pnpm add -D miniprogram-ci
# 支付宝
pnpm add -D minidev
# 其他平台参考 README.md
```

## 配置文件

在项目根目录创建 `minici.config.ts`（也支持 `.js`、`.mjs`、`.json` 等格式，由 [c12](https://github.com/unjs/c12) 加载）：

```ts
import { defineConfig } from "uni-mini-ci-cli";

export default defineConfig({
  // 发布版本号，未指定时从 package.json version 字段读取
  version: "1.0.0",

  // 发布描述，支持字符串或函数（函数形式仅在 upload 操作时调用）
  desc: ({ platform, version }) => `${platform} v${version} 自动构建`,

  // 二维码图片保存路径（可选，未配置时各平台使用默认路径）
  qrcodePath: {
    preview: "./output/preview.png", // preview 操作的二维码路径
    upload: "./output/upload.png", // upload 操作的二维码路径
  },

  // hooks（可选）：preview/upload 完成或错误时触发
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

  // 各平台私有配置
  "mp-weixin": {
    appid: "wx1234567890abcdef",
    privateKeyPath: "key/private.key",
    robot: 1,
  },
});
```

## 命令行用法

```bash
minici --<operation> --platform <platform> [options]
```

### 操作

| 操作        | 说明                                                                    |
| ----------- | ----------------------------------------------------------------------- |
| `--open`    | 打开开发者工具                                                          |
| `--preview` | 上传开发版并生成预览二维码                                              |
| `--upload`  | 上传体验版                                                              |
| `--bump`    | 使用 bumpp 更新版本号。可单独执行；搭配 CI action 时必须包含 `--upload` |

### 选项

| 选项                    | 说明                                                                    |
| ----------------------- | ----------------------------------------------------------------------- |
| `--platform <platform>` | 目标平台（open, preview, upload 时必填）                                |
| `--projectPath <path>`  | 构建产物目录                                                            |
| `--version <version>`   | 发布版本号                                                              |
| `--desc <desc>`         | 发布描述                                                                |
| `--config <path>`       | 配置文件路径                                                            |
| `--cwd <path>`          | 项目根目录                                                              |
| `--dev`                 | 标记为开发构建，默认 projectPath 使用 `dist/dev/<platform>`             |
| `--bump`                | 使用 bumpp 更新版本号。可单独执行；搭配 CI action 时必须包含 `--upload` |
| `-h, --help`            | 显示帮助信息                                                            |
| `-v, --version`         | 显示版本号                                                              |

### 示例

```bash
# 上传微信小程序体验版
minici --upload --platform mp-weixin

# 预览支付宝小程序
minici --preview --platform mp-alipay --projectPath dist/build/mp-alipay

# 开发模式下打开开发者工具. 注意 --dev 是必须的，否则会从 dist/build/<platform> 读取产物，导致无法找到正确的 projectPath。
minici --open --platform mp-weixin --dev

# 指定自定义配置文件
minici --upload --platform mp-weixin --config ./config/ci.config.ts

# 只更新版本号
minici --bump

# 更新版本号后上传
minici --bump --upload --platform mp-weixin
```

### 参数优先级

```
命令行参数 > minici.config 配置
```

## 与 uniapp 构建配合

典型的开发/构建流程：

```bash
# 构建后上传
uni build -p mp-weixin && minici --upload --platform mp-weixin
```

如果希望构建完自动触发 CI 操作，推荐使用 [Vite 插件模式](./vite-plugin.md)。
