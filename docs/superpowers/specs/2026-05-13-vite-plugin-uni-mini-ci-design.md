# vite-plugin-uni-mini-ci 设计文档

## 背景

当前仓库已经提供 `minici` CLI，用于在 uniapp 小程序构建产物生成后执行 `open`、`preview`、`upload`。CLI 的配置来源是 `minici.config.ts`，命令参数负责指定操作、平台和少量覆盖项。

本轮目标是在不改包名、不移除 CLI 的前提下，新增一个 Vite 插件导出函数，让用户可以直接在 `vite.config.ts` 的插件 options 中配置小程序 CI，并通过 uni 命令的透传参数启用指定操作。

## 已确认决策

- 包名保持 `uni-mini-ci-cli`（CLI 包），插件拆分为 `vite-plugin-uni-mini-ci`。
- CLI bin 继续保持 `minici`。
- 新增主入口导出函数 `uniMiniCI()`。
- Vite 插件对象的 `name` 为 `vite-plugin-uni-mini-ci`。
- Vite 插件 options 直接复用现有 `MiniCIConfig` 结构，不再读取 `minici.config.ts`。
- 插件模式下 `--` 后只支持 `--open`、`--preview`、`--upload`。
- 插件模式下平台不解析 `-p/--platform`，直接读取 `process.env.UNI_PLATFORM`。
- 插件模式下默认产物目录优先读取 options 中的 `projectPath`，否则读取 `process.env.UNI_OUTPUT_DIR`。
- CLI 模式保持现有行为，通过 `--dev` 决定默认 `projectPath` 是 `dist/dev/<platform>` 还是 `dist/build/<platform>`。
- 设计文档只写入仓库，不执行 git 提交；提交需要用户单独授权。

## 使用方式

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

命令示例：

```bash
uni build -p mp-weixin -- --upload
uni build -p mp-weixin -- --preview
uni build -p mp-weixin -- --open
uni dev -p mp-weixin -- --open
```

`--` 用来结束 uni 自身参数，后续参数由插件解析。插件只识别 `--open`、`--preview`、`--upload`，其他透传参数都视为错误。

## 架构

采用“入口适配层 + 共享执行层”的结构。

```txt
CLI 入口
  parseCliArgs(argv)
  loadMiniCIConfig(cwd, config)
  runMiniCIWithConfig(...)

Vite 插件入口
  parsePluginOperation(process.argv)
  read process.env.UNI_PLATFORM
  read process.env.UNI_OUTPUT_DIR
  uniMiniCI(options)
  runMiniCIWithConfig(...)

共享执行层
  loadPackageJson(cwd)
  normalizeConfig({ args, cwd, config, packageJson })
  assert projectPath exists
  createCI(normalized)
  ci.init()
  ci[operation]()
```

CLI 继续负责命令行参数和 `minici.config`。Vite 插件只负责从 uni 环境变量和插件透传参数中取得运行输入。两种入口最终进入同一个共享执行函数，避免重复平台 CI、配置校验和默认值逻辑。

## 共享执行函数

新增共享执行函数，例如：

```ts
interface RunMiniCIWithConfigOptions {
  args: ParsedCliArgs;
  cwd: string;
  config: MiniCIConfig;
}
```

职责：

- 读取 `package.json`。
- 调用现有 `normalizeConfig()`。
- 校验 `projectPath` 是否存在。
- 创建当前平台 CI 实例。
- 执行 `init()` 和目标操作。

现有 `runMiniCI({ argv, cwd })` 保留为 CLI 外观函数：

```txt
parseCliArgs(argv)
  -> loadMiniCIConfig()
  -> runMiniCIWithConfig()
```

插件入口直接构造 `ParsedCliArgs`：

```txt
parsePluginOperation(process.argv)
  -> read UNI_PLATFORM
  -> merge projectPath from options or UNI_OUTPUT_DIR
  -> runMiniCIWithConfig()
```

## 插件参数解析

插件只解析第一个 `--` 后面的参数。

```bash
uni build -p mp-weixin -- --upload
```

解析结果：

```txt
operation: upload
platform: process.env.UNI_PLATFORM
projectPath: options.projectPath ?? process.env.UNI_OUTPUT_DIR
```

规则：

- 没有 `--open`、`--preview`、`--upload`：插件跳过，不执行 CI。
- 同时传多个操作：按固定顺序 `open -> preview -> upload` 执行。
- `--` 后出现其他参数：报错。
- 不支持 `--platform`、`--projectPath`、`--version`、`--desc`、`--config`、`--cwd`、`--dev`。
- `version` 和 `desc` 需要通过 `uniMiniCI(options)` 配置。
- `projectPath` 需要通过 `uniMiniCI(options)` 配置，或由 uni 提供的 `UNI_OUTPUT_DIR` 环境变量提供。

## 平台和产物目录来源

插件模式下：

```txt
platform = process.env.UNI_PLATFORM
projectPath = options.projectPath ?? process.env.UNI_OUTPUT_DIR
```

错误规则：

- 传了操作但 `UNI_PLATFORM` 为空：报错 `无法确定 platform，请检查 UNI_PLATFORM`。
- `UNI_PLATFORM` 不是 `mp-weixin | mp-alipay | mp-baidu | mp-jd | mp-toutiao`：沿用当前不支持平台错误。
- `options.projectPath` 和 `UNI_OUTPUT_DIR` 都为空：报错 `无法确定 projectPath，请配置 uniMiniCI({ projectPath }) 或检查 UNI_OUTPUT_DIR`。

CLI 模式下保持原规则：

```txt
命令行参数 > minici.config > package.json > 自动默认值
```

插件模式下配置来源为：

```txt
插件透传操作参数 > uniMiniCI(options) > package.json > 自动默认值
```

其中插件透传参数只提供 `operation`，不覆盖 `version`、`desc`、`projectPath`。

## Vite 触发时机

插件需要区分 Vite 的 `serve` 和 `build` 命令。实现上使用 Vite 插件上下文中的 resolved config，例如 `config.command`。

规则：

- `build` 模式下，`--open`、`--preview`、`--upload` 都允许，可组合传入，在 `closeBundle` 阶段按固定顺序执行，确保构建产物已经写出。
- `serve` 模式下，允许 `--open` 和 `--preview`，在 `configureServer` 阶段执行一次。
- `serve` 模式下传 `--upload`，直接报错，提示 `upload 只支持 build 模式`。

这样可以支持：

```bash
uni dev -p mp-weixin -- --open
uni dev -p mp-weixin -- --open --preview
```

同时避免在常驻开发服务中误触发发布动作。

## 公开 API

主入口新增导出：

```ts
import type { Plugin } from "vite";

export interface UniMiniCIPluginOptions extends MiniCIConfig {}

export function uniMiniCI(options: UniMiniCIPluginOptions): Plugin;
```

继续导出现有 API：

```ts
export { defineConfig, runMiniCI, supportedOperations, supportedPlatforms };
```

`defineConfig()` 的类型推断能力需要保持不变。`uniMiniCI()` 的 options 也应保留与 `MiniCIConfig` 一致的平台配置类型和 `desc` 函数上下文类型。

## 依赖策略

新增依赖：

- `minimist`：运行时依赖，用于插件解析 `--` 后的简单参数。
- `vite`：`peerDependencies`，避免把 Vite 打入本包运行依赖。
- `vite`：`devDependencies`，用于类型和测试。

CLI 可继续使用 `cac`，不强行迁移到 `minimist`。CLI 和插件的参数语义不同，分开解析更清晰。

## 错误处理

- 插件未传操作：跳过，不输出错误。
- 多个操作：按固定顺序执行，不报错。
- 插件模式未知参数：`Vite 插件模式暂不支持参数：--xxx`。
- 缺少 `UNI_PLATFORM`：`无法确定 platform，请检查 UNI_PLATFORM`。
- 缺少 `projectPath` 来源：`无法确定 projectPath，请配置 uniMiniCI({ projectPath }) 或检查 UNI_OUTPUT_DIR`。
- `serve` 模式执行 `upload`：`upload 只支持 build 模式`。
- 配置错误、路径错误、平台 SDK 错误继续沿用现有抛错方式，不吞掉原始错误。

## 测试策略

新增插件参数解析测试：

- 从 `["--", "--upload"]` 解析为 `upload`。
- 从 `["--", "--open"]` 解析为 `open`。
- 没有 `--` 或 `--` 后没有操作时返回跳过。
- 同时传 `--open --upload` 按顺序执行。
- 传 `--version`、`--platform` 等未知参数报错。

新增插件执行测试：

- `build` 模式下构建完成后执行 `upload`。
- `build` 模式下构建完成后执行 `preview`。
- `build` 模式下构建完成后执行 `open`。
- `serve` 模式下允许执行 `open` 和 `preview`。
- `serve` 模式下拒绝 `upload`。
- 插件 options 中的 `projectPath` 优先于 `UNI_OUTPUT_DIR`。
- 缺少 options `projectPath` 时使用 `UNI_OUTPUT_DIR`。
- 缺少 `UNI_PLATFORM` 且传了操作时报错。
- `UNI_PLATFORM` 非支持平台时报错。

保留现有 CLI 测试：

- CLI 继续读取 `minici.config`。
- CLI 继续支持 `--dev` 默认路径。
- CLI 参数严格校验不被插件改动影响。
- `defineConfig()` 和 `NormalizedMiniCIConfig` 的类型推断继续通过。

## 文档更新

README 需要新增 Vite 插件用法：

- 插件安装和配置示例。
- `uni build -p mp-weixin -- --upload` 等命令示例。
- `uni dev -p mp-weixin -- --open` 示例。
- 明确 CLI 和 Vite 插件配置来源不同。
- 明确插件模式只支持 `--open`、`--preview`、`--upload`。
- 明确插件依赖 `UNI_PLATFORM` 和 `UNI_OUTPUT_DIR`，通常由 uni 命令提供。

## 非目标

- 不改包名。
- 不移除 `minici` CLI。
- 不让 Vite 插件读取 `minici.config.ts`。
- 不支持插件模式下的 `--version`、`--desc`、`--projectPath`、`--platform` 等透传参数。
- 不支持 `serve` 模式下执行 `upload`。
