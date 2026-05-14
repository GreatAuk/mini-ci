# minici CLI 设计文档

## 背景

当前仓库目标是把 Taro 的 `@tarojs/plugin-mini-ci` 改造成独立 CLI，供 uniapp 小程序构建完成后执行自动化打开、预览、上传。项目根目录目前还是 `tsdown` starter，`_temp/src` 中保留了 Taro 插件的参考实现，包括 `BaseCi.ts`、各平台 CI 类和二维码工具。

本设计只覆盖独立 CLI，不包装 uniapp 构建命令，也不实现 Taro 插件兼容层。

## 已确认决策

- bin 命令名为 `minici`。
- 命令形态采用操作 flag（可组合），不使用子命令：`minici --upload --platform mp-weixin --projectPath dist/build/mp-weixin`。
- 配置文件由 `c12` 加载，文件名为 `minici.config`。
- 参数校验使用 `zod`，不使用 Joi。
- 配置文件平台 key 使用 uniapp 平台名。
- `version` 和 `desc` 默认来源为：命令行参数 > `minici.config` > `package.json` > 自动默认值。
- `desc` 支持字符串，也支持同步或异步函数。
- 本轮只做独立 CLI，不提供 `minici run` 包装构建命令，也不解决 uniapp 开发服务常驻导致串行命令无法继续执行的问题。
- 不支持钉钉平台，因为本轮目标平台列表没有包含 `mp-dingtalk`。
- 设计文档先写入仓库，不执行 git 提交；提交需要用户单独授权。

## 支持平台

平台映射如下：

| uniapp 平台  | CI 实现       |
| ------------ | ------------- |
| `mp-weixin`  | `WeappCI.ts`  |
| `mp-alipay`  | `AlipayCI.ts` |
| `mp-baidu`   | `SwanCI.ts`   |
| `mp-jd`      | `JdCI.ts`     |
| `mp-toutiao` | `TTCI.ts`     |

平台 SDK 只在实际运行对应平台时检查。

## 架构

第一版采用“CLI 调度层 + 配置/校验层 + 平台 CI 适配层”的结构。

```txt
src/
  cli.ts
  index.ts
  config/
    loadConfig.ts
    schema.ts
    normalize.ts
  runtime/
    createContext.ts
    logger.ts
  ci/
    BaseCI.ts
    WeappCI.ts
    AlipayCI.ts
    JdCI.ts
    SwanCI.ts
    TTCI.ts
  utils/
    npm.ts
    qrcode.ts
    compareVersion.ts
```

`cli.ts` 负责解析 `--open | --preview | --upload` 操作 flag 和通用参数。`index.ts` 导出 `runMiniCI()`、`defineConfig()` 和相关类型，方便测试和配置文件获得类型提示。

平台 CI 类从 `_temp/src/*CI.ts` 迁移，但不再依赖 Taro 的 `IPluginContext`。新增 `RuntimeContext` 替代 Taro `ctx`，只提供项目根目录、日志、文件系统检查、用户目录和退出码处理等最小能力。

`BaseCI` 负责持有运行配置、计算 `version`、`desc`、`projectPath`，并统一返回执行结果。原 Taro 的 hooks 不保留为插件系统，CLI 成功后直接输出二维码路径和内容，失败时输出错误并设置退出码。

## 配置文件

配置文件使用 uniapp 平台名作为顶层 key。

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

  "mp-alipay": {
    appid: "支付宝小程序 appid",
    toolId: "工具 id",
    privateKeyPath: "key/pkcs8-private-pem",
  },
});
```

`c12` 负责加载 `minici.config.ts`、`minici.config.js`、`minici.config.mjs`、`minici.config.cjs` 等常见格式。

## 命令参数

支持三个操作 flag：

```bash
minici --open --platform mp-weixin
minici --preview --platform mp-alipay
minici --upload --platform mp-baidu --projectPath dist/build/mp-baidu
minici --open --preview --upload --platform mp-weixin
```

通用参数：

- `--open`：打开开发者工具。
- `--preview`：上传开发版并生成预览二维码。
- `--upload`：上传体验版。
- `--platform`：必填，支持 `mp-weixin | mp-alipay | mp-baidu | mp-jd | mp-toutiao`。
- `--projectPath`：可选，指定已构建的小程序产物目录。
- `--version`：可选，覆盖发布版本号。
- `--desc`：可选，覆盖发布描述；命令行传入时按字符串处理，并覆盖配置文件中的 `desc` 函数。
- `--dev`：可选，标记为开发构建；默认 `projectPath` 使用 `dist/dev/<platform>`。
- `--config`：可选，指定配置文件路径；不传时从当前工作目录向上查找 `minici.config`。
- `--cwd`：可选，指定项目根目录；不传时使用当前工作目录。

操作参数规则：

- `--open`、`--preview`、`--upload` 至少传入一个，可以组合传入。
- 组合时执行顺序固定为 `open -> preview -> upload`，不受命令行书写顺序影响。
- 不再支持 `minici open`、`minici preview`、`minici upload` 这种位置参数形式。
- 传入任何位置参数都视为参数错误，避免旧命令形态和新命令形态同时存在。

参数优先级：

```txt
命令行参数 > minici.config > package.json > 自动默认值
```

具体规则：

- `platform` 必须来自命令行参数，不从配置文件推断，避免自动化脚本误上传。
- `projectPath` 优先使用命令行参数，其次配置文件；都没有时，若传入 `--dev` 则默认为 `dist/dev/<platform>`，否则默认为 `dist/build/<platform>`。
- `version` 优先使用命令行参数，其次配置文件，再读 `package.json.version`，最后为 `0.0.0`。
- `desc` 优先使用命令行参数，其次配置文件，再读 `package.json.description`，最后为 `CI 自动构建于 <时间>`。
- 当配置文件中的 `desc` 是函数时，支持返回 `string | Promise<string>`，函数会在 `version`、`projectPath` 和平台配置归一化后执行。
- 平台私有配置只校验当前运行平台对应的顶层 key。

`desc` 函数签名：

```ts
type MiniCIDescFunction = (context: {
  operation: "open" | "preview" | "upload";
  platform: "mp-weixin" | "mp-alipay" | "mp-baidu" | "mp-jd" | "mp-toutiao";
  version: string;
  projectPath: string;
  cwd: string;
  packageJson: Record<string, unknown>;
}) => string | Promise<string>;
```

示例：

```ts
export default defineConfig({
  version: "1.0.0",
  desc: async ({ operation, platform, version, packageJson }) => {
    return `${packageJson.name || "miniapp"} ${platform} ${operation} ${version} 自动构建`;
  },
  "mp-weixin": {
    appid: "微信小程序 appid",
    privateKeyPath: "key/private.key",
  },
});
```

## 校验策略

`zod` 校验分两层：

1. 全局配置校验：校验 `version`、`desc`、`projectPath` 和平台 key 的形状；`desc` 允许字符串或函数。
2. 当前平台校验：根据 `--platform` 校验对应平台的必填字段。

示例：

- 运行 `mp-weixin` 时必须有 `'mp-weixin'.appid` 和 `'mp-weixin'.privateKeyPath`。
- 运行 `mp-alipay` 时必须有 `'mp-alipay'.appid`、`toolId`，且 `privateKeyPath` 和 `privateKey` 至少提供一个。
- 运行 `mp-jd` 时必须有 `'mp-jd'.privateKey`。
- 运行 `mp-baidu` 时必须有 `'mp-baidu'.token`。
- 运行 `mp-toutiao` 时必须有 `'mp-toutiao'.email` 和 `password`。

错误信息需要包含字段路径，例如：`配置校验失败：mp-weixin.privateKeyPath 必填`。

## 数据流

命令执行流程：

```txt
解析命令行参数
  -> 使用 c12 加载 minici.config
  -> 读取 package.json
  -> 合并并归一化配置
  -> 使用 zod 校验全局参数和当前平台配置
  -> 解析 desc 字符串或函数
  -> 校验 projectPath 是否存在
  -> 根据 platform 实例化 CI 类
  -> init()
  -> 执行 operation 对应的 open / preview / upload
  -> 输出结果并设置退出码
```

## 错误处理

- 参数错误：缺少操作参数、同时传入多个操作参数、传入位置参数、缺少 `--platform` 或平台不支持，打印用法提示，退出码 `1`。
- 配置错误：打印 zod 格式化后的字段路径，退出码 `1`。
- 路径错误：`projectPath` 或私钥路径不存在时打印绝对路径，退出码 `1`。
- 平台依赖缺失：只检查当前平台需要的依赖，并提示安装命令，退出码 `1`。
- 平台 SDK 失败：保留原始错误信息，并补充平台和操作，退出码 `1`。
- 平台不支持操作：如果原实现仅提醒不支持且不影响流程，打印 warning 并退出码 `0`。

成功时输出版本、描述、项目路径、二维码本地路径和二维码内容。第一版只输出人类可读日志，不提供 JSON 输出。

## 依赖策略

正式依赖：

- `c12`
- `zod`
- 命令解析库
- 日志或颜色输出库
- 二维码生成和解析相关依赖
- `resolve` 或等价包解析工具
- `shelljs` 或等价子进程工具

平台 SDK 作为可选 peer dependency：

| 平台         | 依赖                |
| ------------ | ------------------- |
| `mp-weixin`  | `miniprogram-ci`    |
| `mp-alipay`  | `minidev`           |
| `mp-jd`      | `jd-miniprogram-ci` |
| `mp-baidu`   | `swan-toolkit`      |
| `mp-toutiao` | `tt-ide-cli`        |

`peerDependenciesMeta.optional` 标记这些平台依赖为可选，避免用户安装不使用的平台 SDK。

## 测试策略

测试不调用真实平台上传接口，重点验证本包自己的逻辑。

1. 纯逻辑单测
   - 配置归一化
   - 平台映射
   - 参数优先级
   - 默认 `projectPath`、`version`、`desc`
   - `desc` 字符串、同步函数、异步函数和命令行覆盖行为
   - zod 错误格式化

2. CLI 入口测试
   - 通过内部 `runMiniCI()` 模拟参数。
   - `--open`、`--preview`、`--upload` 能分别解析为对应操作。
   - 缺少操作参数时报错。
   - 同时传入多个操作参数时报错。
   - 传入 `minici open --platform mp-weixin` 这类旧位置参数时报错。
   - mock 平台 CI 类，验证操作、平台和配置传递正确。

3. 平台适配层测试
   - 缺平台配置时报错。
   - 缺私钥文件时报错。
   - 缺平台 SDK 时提示安装依赖。
   - `upload` 和 `preview` 传给 SDK 的 `version`、`desc`、`projectPath` 正确。

## 非目标范围

- 不执行 uniapp 构建命令。
- 不实现 `minici run`。
- 不处理 `uni -p <platform>` 常驻进程导致 `&& minici ...` 后续命令无法执行的问题。
- 不保留 Taro 插件生命周期和 hooks 系统。
- 不支持钉钉平台。
- 不实现 JSON 输出。
- 不对平台官方 SDK 的真实网络上传行为做集成测试。

## 风险与控制

- 平台 SDK 类型不完整：保持 Taro 插件中的按需动态加载策略，必要处用局部类型或 `unknown` 收敛。
- CLI 与平台类耦合过深：通过 `RuntimeContext` 控制边界，避免平台类直接依赖命令解析或配置加载。
- 配置字段命名迁移带来的混淆：文档明确使用 uniapp 平台名，内部集中做平台映射。
- 真实上传难以自动化测试：单测只覆盖参数传递和错误路径，真实上传交给用户环境验证。
