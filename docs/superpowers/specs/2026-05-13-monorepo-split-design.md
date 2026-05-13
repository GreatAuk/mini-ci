# uni-mini-ci monorepo 拆分设计文档

## 背景

当前项目已经在同一个包内同时提供 `minici` CLI 和 `uniMiniCI()` Vite 插件能力。代码集中在根目录 `src/` 下，包含命令行参数解析、插件参数解析、配置加载、配置归一化、平台 CI 适配、运行时上下文、二维码工具和共享类型。

现有两份设计文档已经分别确认 CLI 与 Vite 插件行为：

- `docs/superpowers/specs/2026-05-11-minici-cli-design.md`
- `docs/superpowers/specs/2026-05-13-vite-plugin-uni-mini-ci-design.md`

本设计只覆盖仓库结构和包边界拆分，不重新设计 CLI 或 Vite 插件的业务语义。

## 已确认决策

- 仓库拆成 monorepo，根 `package.json` 改为私有 workspace 聚合包。
- 采用 `packages/cli`、`packages/vite-plugin`、`packages/core` 三包结构。
- `packages/cli` 发布包名继续为 `uni-mini-ci-cli`，继续提供 bin `minici`。
- `packages/vite-plugin` 发布包名为 `vite-plugin-uni-mini-ci`。
- `packages/core` 发布包名为 `uni-mini-ci-core`，作为公开运行时依赖。
- `uni-mini-ci-cli` 和 `vite-plugin-uni-mini-ci` 都通过普通依赖使用 `uni-mini-ci-core`，不把 core 打包进各自 dist。
- `uni-mini-ci-cli` 不再导出 `uniMiniCI()`；插件用户需要改为从 `vite-plugin-uni-mini-ci` 导入。
- `defineConfig()` 只保留在 `uni-mini-ci-cli` 中；`vite-plugin-uni-mini-ci` 不导出配置 helper。

## 目标结构

```txt
package.json
pnpm-workspace.yaml
tsconfig.base.json
packages/
  core/
    package.json
    tsdown.config.ts
    tsconfig.json
    src/
    tests/
  cli/
    package.json
    tsdown.config.ts
    tsconfig.json
    tsconfig.test.json
    src/
    tests/
  vite-plugin/
    package.json
    tsdown.config.ts
    tsconfig.json
    tsconfig.test.json
    src/
    tests/
```

根目录负责统一安装、测试、类型检查和构建编排。真正发布的包全部位于 `packages/*`。

## 包职责

### `packages/core`

`uni-mini-ci-core` 是共享执行层，负责所有与“小程序 CI 怎么运行”相关的能力。

核心内容：

- 平台常量：`supportedOperations`、`supportedPlatforms`。
- 共享类型：`MiniCIConfig`、`MiniCIOperation`、`MiniCIPlatform`、`MiniCIResult`、`RunMiniCIWithConfigOptions` 等。
- 配置 schema 和归一化逻辑。
- 平台 CI 类和 registry。
- `RuntimeContext`、logger、路径校验和平台依赖检查。
- `runMiniCIWithConfig()`。
- 二维码、版本比较、npm 包解析等工具函数。

core 不负责读取 `minici.config`，也不关心 CLI argv、Vite 生命周期或 uni 环境变量。

### `packages/cli`

`uni-mini-ci-cli` 是 CLI 入口层，保留现有包名和命令名。

核心内容：

- bin 入口 `minici`。
- `parseCliArgs()`。
- `loadMiniCIConfig()`。
- `runMiniCI()`。
- `defineConfig()`。
- CLI help 文案。
- CLI 专属导出和 CLI 文档。

CLI 包依赖 `uni-mini-ci-core`，通过 core 执行平台 CI，不再包含平台 CI 实现。

### `packages/vite-plugin`

`vite-plugin-uni-mini-ci` 是 Vite 插件入口层。

核心内容：

- `uniMiniCI()`。
- `parsePluginArgs()`。
- `UniMiniCIPluginOptions`。
- `UNI_PLATFORM` 和 `UNI_OUTPUT_DIR` 读取。
- `serve/build` 生命周期判断。

插件包依赖 `uni-mini-ci-core`，直接把插件 options 作为 `MiniCIConfig` 传入 core。插件不读取 `minici.config.ts`，不导出 `defineConfig()`。

## 公开 API

### `uni-mini-ci-core`

```ts
export {
  runMiniCIWithConfig,
  supportedOperations,
  supportedPlatforms,
  type MiniCIConfig,
  type MiniCIOperation,
  type MiniCIPlatform,
  type ParsedCliArgs,
  type RunMiniCIWithConfigOptions,
  type MiniCIResult,
};
```

平台 CI 类、registry 内部细节和运行时私有工具不作为稳定 API 承诺。

### `uni-mini-ci-cli`

```ts
export { defineConfig, runMiniCI };
export {
  supportedOperations,
  supportedPlatforms,
  type MiniCIConfig,
  type MiniCIOperation,
  type MiniCIPlatform,
  type MiniCIResult,
} from "uni-mini-ci-core";
```

`defineConfig()` 保留现有类型推断能力：

```ts
export function defineConfig<const T extends MiniCIConfig>(config: T): T {
  return config;
}
```

`uni-mini-ci-cli` 不再导出 `uniMiniCI()`。

### `vite-plugin-uni-mini-ci`

```ts
export { uniMiniCI };
export type { UniMiniCIPluginOptions };
```

插件用户使用：

```ts
import { uniMiniCI } from "vite-plugin-uni-mini-ci";
```

旧写法需要迁移：

```ts
// 旧：import { uniMiniCI } from "uni-mini-ci-cli";
// 新：
import { uniMiniCI } from "vite-plugin-uni-mini-ci";
```

## 数据流

CLI 模式保持现有语义：

```txt
parseCliArgs(argv)
  -> loadMiniCIConfig({ cwd, config })
  -> runMiniCIWithConfig({ args, cwd, config })
  -> normalizeConfig()
  -> createCI()
  -> ci.open/preview/upload()
```

Vite 插件模式保持现有语义：

```txt
parsePluginArgs(process.argv)
  -> read UNI_PLATFORM
  -> read options.projectPath 或 UNI_OUTPUT_DIR
  -> runMiniCIWithConfig({ args, cwd: vite root, config: options })
  -> normalizeConfig()
  -> createCI()
  -> ci.open/preview/upload()
```

CLI 模式继续支持 `--platform`、`--projectPath`、`--version`、`--desc`、`--config`、`--cwd`、`--dev`。插件模式只支持 `--open`、`--preview`、`--upload`，其他透传参数继续报错。

## 依赖设计

根目录保留统一开发工具依赖，例如 TypeScript、Vitest、tsdown、oxlint、oxfmt 和发布工具。根包不发布。

`uni-mini-ci-core` 放运行时依赖：

- `zod`
- `picocolors`
- `resolve`
- `shelljs`
- `qrcode`
- `jimp`
- `jsqr`
- `axios`

平台 SDK 继续作为 optional peer dependencies 放在 core：

- `miniprogram-ci`
- `minidev`
- `jd-miniprogram-ci`
- `swan-toolkit`
- `tt-ide-cli`

`uni-mini-ci-cli` 放 CLI 专属依赖：

- `uni-mini-ci-core`
- `cac`
- `c12`

`vite-plugin-uni-mini-ci` 放插件专属依赖：

- `uni-mini-ci-core`
- `minimist`

`vite` 在插件包中保持 peer dependency 和 dev dependency，不进入普通 runtime dependencies。

## 构建设计

每个发布包独立维护 `tsdown.config.ts`。

入口设计：

```txt
core:        src/index.ts
cli:         src/index.ts, src/cli.ts
vite-plugin: src/index.ts
```

根脚本聚合执行：

```json
{
  "scripts": {
    "build": "pnpm -r --if-present run build",
    "test": "pnpm -r --if-present run test",
    "typecheck": "pnpm -r --if-present run typecheck",
    "typecheck:test": "pnpm -r --if-present run typecheck:test"
  }
}
```

由于 `cli` 和 `vite-plugin` 通过 workspace dependency 依赖 `core`，`pnpm -r --if-present run build` 应按依赖拓扑先构建 core。

## 测试策略

测试按包迁移，避免根目录测试继续依赖旧路径。

### core 测试

迁移共享行为测试：

- `config.test.ts`
- `runner.test.ts`
- `runtime.test.ts`
- `platform-preflight.test.ts`
- `ci-base.test.ts`
- `utils.test.ts`

验证重点：

- 配置 schema 和归一化。
- 平台映射。
- 默认 `projectPath`、`version`、`desc`。
- `desc` 字符串、同步函数、异步函数和命令行覆盖行为。
- `runMiniCIWithConfig()`。
- 平台依赖前置检查。
- 二维码、版本比较和 npm 解析工具。

### CLI 测试

迁移 CLI 行为测试：

- `command.test.ts`
- `index.test.ts`

验证重点：

- `parseCliArgs()` 严格参数校验。
- `--open`、`--preview`、`--upload` 互斥。
- 位置参数继续报错。
- `runMiniCI()` 继续读取 `minici.config`。
- `--dev` 默认路径规则。
- `defineConfig()` 类型推断。

### Vite 插件测试

迁移插件行为测试：

- `plugin-args.test.ts`
- `plugin.test.ts`

验证重点：

- `parsePluginArgs()` 只解析 `--` 后的操作参数。
- 未传操作时跳过。
- 未知参数和位置参数报错。
- `build` 模式允许 `open/preview/upload`。
- `serve` 模式只允许 `open`。
- `options.projectPath` 优先于 `UNI_OUTPUT_DIR`。
- 缺少 `UNI_PLATFORM` 或 `projectPath` 来源时报错。

## 迁移步骤

1. 建立 workspace 骨架和根脚本，不改变运行行为。
2. 迁移 core：类型、配置、运行时、平台 CI、工具和共享测试。
3. 迁移 CLI：参数解析、配置加载、bin、`defineConfig()`、CLI 测试和 CLI 文档。
4. 迁移 Vite 插件：插件入口、插件参数解析、插件测试和插件文档。
5. 更新 README、`docs/cli.md` 和 `docs/vite-plugin.md`，明确新包名和迁移方式。

## 验收标准

仓库级验证：

```bash
pnpm install
pnpm run test
pnpm run typecheck
pnpm run typecheck:test
pnpm run build
```

包级构建验证：

```bash
pnpm --filter uni-mini-ci-core run build
pnpm --filter uni-mini-ci-cli run build
pnpm --filter vite-plugin-uni-mini-ci run build
```

导出验证：

- `uni-mini-ci-cli` 可以运行 `minici`。
- `uni-mini-ci-cli` 可以导出 `defineConfig()` 和 `runMiniCI()`。
- `uni-mini-ci-cli` 不再导出 `uniMiniCI()`。
- `vite-plugin-uni-mini-ci` 可以导出 `uniMiniCI()`。
- `uni-mini-ci-core` 可以导出共享类型、常量和 `runMiniCIWithConfig()`。

## 非目标

- 不重新设计 CLI 参数语义。
- 不重新设计 Vite 插件参数语义。
- 不让 Vite 插件读取 `minici.config.ts`。
- 不在插件包中导出 `defineConfig()`。
- 不在 CLI 包中继续导出 `uniMiniCI()`。
- 不把 core 打包进 CLI 或插件 dist。
- 不新增真实平台上传集成测试。

## 风险与控制

- 破坏性导出调整：文档必须明确 `uniMiniCI()` 从 `vite-plugin-uni-mini-ci` 导入。
- 类型推断退化：`defineConfig<const T extends MiniCIConfig>(config: T): T` 必须保留。
- core API 过宽：只公开共享执行入口、常量和类型；平台类内部实现不作为稳定 API。
- 依赖放错包：`c12/cac` 属于 CLI，`minimist/vite` 属于插件，平台 SDK 和执行依赖属于 core。
- workspace 路径破坏测试：测试中的 fixture 和相对路径要按包根重新计算。
- 构建顺序异常：通过 workspace dependency 让 `core` 先于 `cli` 和 `vite-plugin` 构建。
