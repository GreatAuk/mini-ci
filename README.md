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
