# CLI 使用文档

`uni-mini-ci-cli` 提供 `minici` 命令，在 uniapp 小程序构建产物完成后执行打开开发者工具、上传预览版、上传体验版等操作。

## 安装

```bash
pnpm add -D uni-mini-ci-cli
```

按目标平台安装对应 SDK：

| 平台 | SDK 包名 |
| --- | --- |
| 微信 | `miniprogram-ci` |
| 支付宝 | `minidev` |
| 京东 | `jd-miniprogram-ci` |
| 百度 | `swan-toolkit` |
| 抖音 | `tt-ide-cli` |

```bash
# 示例：安装微信 SDK
pnpm add -D miniprogram-ci
```

## 配置文件

在项目根目录创建 `minici.config.ts`（也支持 `.js`、`.mjs`、`.json` 等格式，由 [c12](https://github.com/unjs/c12) 加载）：

```ts
import { defineConfig } from "uni-mini-ci-cli";

export default defineConfig({
  // 发布版本号，未指定时从 package.json version 字段读取
  version: "1.0.0",

  // 发布描述，支持字符串或函数
  desc: ({ platform, version }) => `${platform} v${version} 自动构建`,

  // 构建产物目录，未指定时默认为 dist/build/<platform>
  projectPath: "dist/build/mp-weixin",

  // 各平台私有配置
  "mp-weixin": {
    appid: "wx1234567890abcdef",
    privateKeyPath: "key/private.key",
    robot: 1,
  },
});
```

### 配置字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `version` | `string` | 发布版本号。默认读取 `package.json` 中的 `version` |
| `desc` | `string \| (ctx) => string` | 发布描述。函数形式接收 `{ operation, platform, version, projectPath, cwd, packageJson }` |
| `projectPath` | `string` | 构建产物目录。支持相对路径（相对 cwd），不填时为 `dist/build/<platform>` |
| `mp-weixin` | `WeappConfig` | 微信小程序平台配置 |
| `mp-alipay` | `AlipayConfig` | 支付宝小程序平台配置 |
| `mp-baidu` | `SwanConfig` | 百度小程序平台配置 |
| `mp-jd` | `JdConfig` | 京东小程序平台配置 |
| `mp-toutiao` | `TTConfig` | 抖音小程序平台配置 |

## 命令行用法

```bash
minici --<operation> --platform <platform> [options]
```

### 操作

| 操作 | 说明 |
| --- | --- |
| `--open` | 打开开发者工具 |
| `--preview` | 上传开发版并生成预览二维码 |
| `--upload` | 上传体验版 |

三个操作互斥，每次只能指定一个。

### 选项

| 选项 | 说明 |
| --- | --- |
| `--platform <platform>` | 目标平台（必填） |
| `--projectPath <path>` | 构建产物目录 |
| `--version <version>` | 发布版本号 |
| `--desc <desc>` | 发布描述 |
| `--config <path>` | 配置文件路径 |
| `--cwd <path>` | 项目根目录 |
| `--dev` | 标记为开发构建，默认 projectPath 使用 `dist/dev/<platform>` |
| `-h, --help` | 显示帮助信息 |
| `-v, --version` | 显示版本号 |

### 示例

```bash
# 上传微信小程序体验版
minici --upload --platform mp-weixin

# 预览支付宝小程序
minici --preview --platform mp-alipay --projectPath dist/build/mp-alipay

# 开发模式下打开开发者工具
minici --open --platform mp-weixin --dev

# 指定自定义配置文件
minici --upload --platform mp-weixin --config ./config/ci.config.ts
```

## 参数优先级

```
命令行参数 > minici.config 配置 > package.json 字段 > 自动默认值
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

## 与 uniapp 构建配合

典型的开发/构建流程：

```bash
# 构建后上传
uni build -p mp-weixin && minici --upload --platform mp-weixin

# 开发模式打开工具
uni dev -p mp-weixin && minici --open --platform mp-weixin --dev
```

如果希望构建完自动触发 CI 操作，推荐使用 [Vite 插件模式](./vite-plugin.md)。

## Programmatic API

也可以在代码中调用：

```ts
import { runMiniCI, runMiniCIWithConfig } from "uni-mini-ci-cli";

// 方式一：模拟 CLI 调用
await runMiniCI({
  argv: ["--upload", "--platform", "mp-weixin"],
  cwd: process.cwd(),
});

// 方式二：直接传入配置
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
