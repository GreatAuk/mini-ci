# uni-mini-ci-cli

`uni-mini-ci-cli` 是一个面向 uniapp 小程序构建产物的持续集成 CLI。它参考 Taro `@tarojs/plugin-mini-ci` 的平台实现，在 `uni build -p <platform>` 完成后执行打开开发者工具、上传开发版预览、上传体验版等操作。

## 安装

```bash
pnpm add -D uni-mini-ci-cli
```

按平台安装对应 SDK：

```bash
# 微信
pnpm add -D miniprogram-ci
# 支付宝
pnpm add -D minidev
# 京东
pnpm add -D jd-miniprogram-ci
# 百度
pnpm add -D swan-toolkit
# 抖音
pnpm add -D tt-ide-cli
```

## 配置

创建 `minici.config.ts`：

```ts
import { defineConfig } from "uni-mini-ci-cli";

export default defineConfig({
  version: "1.0.0",
  desc: ({ platform, version }) => `${platform} ${version} 自动构建`,
  projectPath: "dist/build/mp-weixin",
  "mp-weixin": {
    appid: "微信小程序 appid",
    privateKeyPath: "key/private.key",
    robot: 1,
  },
});
```

## 命令

```bash
minici --open --platform mp-weixin
minici --preview --platform mp-weixin
minici --upload --platform mp-weixin --projectPath dist/build/mp-weixin
```

支持的平台：

- `mp-weixin`
- `mp-alipay`
- `mp-baidu`
- `mp-jd`
- `mp-toutiao`

参数优先级：

```
命令行参数 > minici.config > package.json > 自动默认值
```

## Vite 插件

如果项目已经通过 Vite 配置 uniapp 构建，可以直接在 `vite.config.ts` 中使用插件：

```bash
pnpm add -D vite-plugin-uni-mini-ci
```

```ts
import { defineConfig } from "vite";
import { uniMiniCI } from "vite-plugin-uni-mini-ci";

export default defineConfig({
  plugins: [
    uniMiniCI({
      version: "1.0.0",
      desc: ({ platform, version }) => `${platform} ${version} 自动构建`,
      "mp-weixin": {
        appid: "微信小程序 appid",
        privateKeyPath: "key/private.key",
        robot: 1,
      },
    }),
  ],
});
```

插件模式下不读取 `minici.config.ts`。配置直接写在 `uniMiniCI(options)` 中。

通过 uni 命令透传参数触发操作：

```bash
uni build -p mp-weixin -- --upload
uni build -p mp-weixin -- --preview
uni build -p mp-weixin -- --open
uni dev -p mp-weixin -- --open
```

## 包结构

monorepo 拆分后，本项目包含三个独立发布的 npm 包：

| 包名                      | 说明                                         |
| ------------------------- | -------------------------------------------- |
| `uni-mini-ci-cli`         | CLI 入口 (`minici` 命令) 和 `defineConfig()` |
| `vite-plugin-uni-mini-ci` | Vite 插件 `uniMiniCI()`                      |
| `uni-mini-ci-core`        | 共享运行时（平台 CI、配置归一化、公共类型）  |

`uni-mini-ci-core` 是 CLI 和 Vite 插件共享的运行时包，承载平台 CI、配置归一化、公共类型和 `runMiniCIWithConfig()`。普通业务项目通常不需要直接安装它；安装 `uni-mini-ci-cli` 或 `vite-plugin-uni-mini-ci` 时会作为依赖安装。

`--` 后只支持 `--open`、`--preview`、`--upload`。平台和产物目录由 uni 注入的 `UNI_PLATFORM`、`UNI_OUTPUT_DIR` 提供；如果需要覆盖产物目录，可以配置 `uniMiniCI({ projectPath: "..." })`。

插件模式配置优先级：

```
插件操作参数 > uniMiniCI(options) > package.json > 自动默认值
```

## 与 uniapp 脚本配合

```json
{
  "scripts": {
    "build:mp-weixin": "uni build -p mp-weixin",
    "ci:mp-weixin": "minici --upload --platform mp-weixin --projectPath dist/build/mp-weixin"
  }
}
```

## 开发

```bash
pnpm install
pnpm run test
pnpm run build
```
