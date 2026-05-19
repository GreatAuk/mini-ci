# 纯 open 跳过平台配置校验 — 设计文档

**日期：** 2026-05-19
**状态：** 待实现

---

## 背景

当前 `runMiniCIWithConfig()` 会对每个 operation 调用 `normalizeConfig()`，而
`normalizeConfig()` 总是通过 `validatePlatformConfig()` 要求当前平台的
`MiniCIConfig[platform]` 存在且满足完整平台 schema。

这导致 `--open` 也必须配置微信、支付宝、百度、京东、字节等平台的私密 CI 配置。
但 `open` 的目标只是打开开发者工具和项目目录，不需要 appid、私钥、token、账号密码等
`preview` / `upload` 才需要的发布凭证。

---

## 已确认决策

- 只在“纯 `open`”场景免平台私密配置校验。
- “纯 `open`”定义为 `operations.length === 1 && operations[0] === "open"`。
- `--open --preview`、`--open --upload`、`--preview`、`--upload` 保持当前严格校验。
- 组合操作缺少平台配置时，应在执行任何操作前失败，避免先打开 IDE 后再失败。
- CLI、Vite 插件和程序化 `runMiniCIWithConfig()` 都应使用同一套共享语义。

---

## 目标

1. 允许用户在只执行 `--open` 时不配置 `MiniCIConfig["mp-weixin"]` 等平台配置。
2. 保持 `preview` / `upload` 的平台配置校验不变。
3. 保持多 action 固定执行顺序 `open -> preview -> upload` 不变。
4. 对所有已支持平台统一处理：`mp-weixin`、`mp-alipay`、`mp-baidu`、`mp-jd`、`mp-toutiao`。

## 非目标

- 不新增 open-only partial platform config schema。
- 不放宽 `preview` / `upload` 的 appid、私钥、token、账号密码等校验。
- 不改变 `--open --preview` 或 `--open --upload` 的失败时机。
- 不新增平台别名、平台自动推断或新的 CLI 参数。

---

## 架构设计

改动落在 `packages/core` 的共享归一化和执行链路中，而不是只改 CLI 或只改 Vite 插件。

```txt
CLI / Vite 插件 / 程序化 API
  -> runMiniCIWithConfig()
       -> 判断是否 pureOpen
       -> normalizeConfig({ allowMissingPlatformConfig: pureOpen })
       -> assert projectPath exists
       -> createCI(normalized)
       -> pureOpen 时执行 open 最小初始化路径
       -> ci.open()
```

这样所有入口的行为保持一致：

- `minici --open --platform mp-weixin --dev`
- `uni dev -p mp-weixin -- --open`
- `runMiniCIWithConfig({ args: { operations: ["open"], platform } })`

都可以在缺少平台配置时打开项目。

---

## 配置归一化

### pureOpen 判断

在 `runMiniCIWithConfig()` 中基于最终运行参数判断：

```ts
const pureOpen = runtimeArgs.operations.length === 1 && runtimeArgs.operations[0] === "open";
```

这个判断必须使用 bump 后的 `runtimeArgs`，确保 bump-only 和 bump + upload 不受影响。

### `normalizeConfig()` 行为

`normalizeConfig()` 增加一个内部选项，用于表达是否允许当前操作缺少平台配置。

```ts
normalizeConfig({
  args,
  cwd,
  config,
  packageJson,
  allowMissingPlatformConfig: pureOpen,
});
```

规则：

- `allowMissingPlatformConfig === false`：保持当前行为，缺少 `config[platform]` 时报错。
- `allowMissingPlatformConfig === true`：允许 `config[platform]` 缺失。
- 如果用户显式提供了 `config[platform]`，仍沿用现有平台 schema 校验；本轮不支持只写
  `devToolsInstallPath` 的半配置。
- 顶层共享配置仍需要校验，例如 `version`、`desc`、`projectPath`、`qrcodePath`、`hooks`、
  `bumpOptions`。

---

## CI 初始化

只跳过 `validatePlatformConfig()` 不够，因为当前 runner 在每个 operation 前都会执行
`ci.init()`。部分平台的 `init()` 会加载 SDK、读取私钥或登录凭证。

pureOpen 场景需要让 open 走最小初始化路径：

- `mp-weixin`：`open()` 只需要微信开发者工具路径和 `projectPath`，不需要
  `miniprogram-ci`、`appid` 或 `privateKeyPath`。
- `mp-baidu`：`open()` 只需要百度开发者工具路径和 `projectPath`，不需要 `swan-toolkit` 或
  `token`。
- `mp-jd`：当前 `open()` 仅输出“不支持 open 操作”的 warning，不需要 SDK 或私钥。
- `mp-alipay`：`open()` 需要 `minidev` 调用 IDE，但不需要鉴权私钥；应只加载 SDK，不执行
  私钥读取和 `useDefaults()` 鉴权配置。
- `mp-toutiao`：`open()` 需要 `tt-ide-cli` 打开项目，但不需要邮箱密码登录；应只加载 SDK，
  不执行登录。

组合操作不是 pureOpen，继续执行完整 `ci.init()`，保持原有严格行为。

---

## 数据流

### 纯 open

```txt
operations = ["open"]
config = {}
platform = "mp-weixin"
projectPath = "dist/dev/mp-weixin"
  ↓
pureOpen = true
  ↓
normalizeConfig 允许缺少 mp-weixin
  ↓
assert projectPath exists
  ↓
open 最小初始化路径
  ↓
ci.open()
```

### 组合操作

```txt
operations = ["open", "preview"]
config = {}
platform = "mp-weixin"
  ↓
pureOpen = false
  ↓
normalizeConfig 要求 mp-weixin 完整配置
  ↓
缺少配置，直接失败
  ↓
不执行 open
```

---

## 错误处理

- 纯 `open` 缺少平台配置：不报 `配置校验失败：<platform> 平台配置不能为空`。
- 纯 `open` 缺少 `platform`：仍报现有“请指定平台”错误。
- 纯 `open` 缺少 `projectPath` 或目录不存在：仍报现有 projectPath 错误。
- 纯 `open` 缺少开发者工具或命令行服务未开启：由各平台 `open()` 抛出现有工具类错误。
- 组合操作缺少平台配置：仍报现有平台配置错误，并且不执行任何 operation。
- `preview` / `upload` 平台配置不完整：仍报现有字段路径错误。

---

## 测试计划

### `packages/core/tests/config.test.ts`

新增 normalize 层用例：

1. `operation: "open"` 且允许缺少平台配置时，缺少 `config[platform]` 也能返回 normalized config。
2. `operation: "preview"` 缺少平台配置仍失败。
3. 显式提供不完整平台配置时，仍沿用现有 schema 报字段错误。

### `packages/core/tests/hooks.test.ts` 或 runner 专项测试

新增共享 runner 行为用例：

1. 纯 `["open"]` 且配置为空时，能执行 `open`。
2. `["open", "preview"]` 且配置为空时，直接失败且不执行 `open`。
3. 纯 `["open"]` 对多个平台都不要求平台私密配置。

### `packages/cli/tests/runner.test.ts`

新增 CLI 外观用例：

1. `minici --open --platform mp-weixin --projectPath <existing>`，配置文件为空时执行 open。
2. `minici --open --preview --platform mp-weixin`，配置文件为空时仍失败。

### `packages/vite-plugin/tests/plugin.test.ts`

新增插件用例：

1. `uni dev -p mp-weixin -- --open`，`uniMiniCI({})` 时执行 open。
2. `uni dev -p mp-weixin -- --open --preview`，`uniMiniCI({})` 时仍失败。

---

## 改动文件清单

| 文件                                        | 改动类型                                      |
| ------------------------------------------- | --------------------------------------------- |
| `packages/core/src/config/normalize.ts`     | 支持 pureOpen 时缺少平台配置                  |
| `packages/core/src/runMiniCIWithConfig.ts`  | 判断 pureOpen，并控制平台配置校验和初始化路径 |
| `packages/core/src/types.ts`                | 调整 normalized config 类型以表达可选平台配置 |
| `packages/core/src/ci/WeappCI.ts`           | open 使用可选平台配置和默认开发者工具路径     |
| `packages/core/src/ci/AlipayCI.ts`          | open 只加载 SDK，不执行私钥鉴权初始化         |
| `packages/core/src/ci/SwanCI.ts`            | open 使用可选平台配置和默认开发者工具路径     |
| `packages/core/src/ci/TTCI.ts`              | open 只加载 SDK，不执行登录                   |
| `packages/core/src/ci/JdCI.ts`              | open 不依赖 SDK 和平台私钥配置                |
| `packages/core/tests/config.test.ts`        | 新增 normalize 测试                           |
| `packages/core/tests/hooks.test.ts`         | 新增共享 runner 行为测试                      |
| `packages/cli/tests/runner.test.ts`         | 新增 CLI 外观测试                             |
| `packages/vite-plugin/tests/plugin.test.ts` | 新增插件入口测试                              |
| `README.md` / `docs/*.md`                   | 说明纯 open 不需要平台私密配置                |

---

## 验收标准

- 纯 `--open` 可以在没有对应平台配置的情况下运行到 `open()`。
- 组合操作缺少平台配置时，不执行 `open`，直接报平台配置错误。
- `preview` / `upload` 原有严格校验和错误文案保持不变。
- CLI、Vite 插件、程序化 API 行为一致。
- `pnpm run test`、`pnpm run typecheck`、`pnpm run typecheck:test` 通过。
