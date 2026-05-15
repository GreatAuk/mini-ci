# 日志输出优化设计文档

## 背景

`uni-mini-ci` 当前已经拆分为 `uni-mini-ci-core`、`uni-mini-ci-cli` 和 `vite-plugin-uni-mini-ci`。共享运行入口 `runMiniCIWithConfig()` 已经支持多 action 顺序执行，平台 CI 适配器负责具体 `open()`、`preview()`、`upload()` 行为，CLI 顶层会输出最终二维码路径、二维码内容和错误消息。

仓库里已经有 `packages/core/src/runtime/logger.ts`，并且 `uni-mini-ci-core` 已依赖 `picocolors`。但当前日志仍比较分散：平台适配器中存在大量直接 `console.log()` / `console.warn()` / `console.error()`，CLI 顶层也直接输出结果。这会导致用户难以一眼分辨开始、成功、警告和错误，也容易在多 action 场景里看不清日志归属。

本设计只优化默认日志输出，让日志更明显、美观、直观。不新增日志配置项，不改变 CLI 参数、配置 schema、hook 语义、返回结构和 exit code。

## 已确认决策

- 优化范围覆盖 core 运行日志、五个平台适配器日志，以及 CLI 顶层结果和错误输出。
- 日志视觉方向采用“分组块”：整体运行一个块，每个 operation 一个块，块内用缩进展示状态和辅助信息。
- 颜色语义使用 `picocolors`：错误红色、成功绿色、信息或开始蓝色/青色、警告黄色、辅助信息灰色。
- 默认不为每一行添加时间戳，只在关键成功、失败或阶段结束处用灰色显示少量时间信息。
- 使用轻量 Unicode 符号，例如 `●`、`◇`、`✓`、`✕`；不新增 plain mode 或符号开关。
- 不新增 `logLevel`、`format`、`timestamp`、`symbols` 等用户配置项。
- `--help` 和 `--version` 保持普通 `console.log()` 输出，避免影响脚本读取。
- 二维码终端图本身继续由 `printQrcode2Terminal()` 输出，不强行包进 logger 样式。
- 本设计文档按 brainstorming 流程写入仓库；实现另行创建 implementation plan。

## 目标输出形态

默认日志使用分组块和缩进表达结构：

```txt
● minici mp-weixin · 1.0.0
  projectPath dist/build/mp-weixin
  operations  preview, upload

◇ preview 上传开发版并生成预览码
  ✓ 开发版上传成功 10:24:12
  ✓ 二维码已保存
    /repo/dist/build/mp-weixin/preview.jpg
  qr https://example.com/preview

◇ upload 上传体验版并生成体验码
  ✓ 体验版上传成功 10:24:16
  ✓ 二维码已保存
    /repo/dist/build/mp-weixin/upload.png

✓ 完成 2 个操作执行成功
```

失败时输出应保持单次、清晰：

```txt
✕ 执行失败
  operation preview
  platform mp-weixin
  error mp-weixin preview 执行失败：...
```

如果失败发生在参数解析或配置加载阶段，没有 operation 或 platform 时，只输出能安全取得的上下文，不猜缺失字段。

## 架构设计

日志展示层集中在 `packages/core/src/runtime/logger.ts`。现有 `Logger` 接口可以扩展少量语义方法，用来表达分组、状态行和辅助信息，但不做完整 formatter 系统。logger 负责颜色、符号、缩进、空行和辅助信息灰显。

`runMiniCIWithConfig()` 创建本次运行使用的 logger，并通过 `createCI(normalized, logger)` 传给平台 CI。`BaseCI` 持有 logger，并向 `WeappCI`、`AlipayCI`、`SwanCI`、`TTCI`、`JdCI` 提供统一输出能力。logger 不进入 `NormalizedMiniCIConfigBase`，避免把展示层对象混入已归一化配置数据。

`runMiniCIWithConfig()` 负责跨 operation 的结构化日志：

- 输出整体运行头。
- 在每个 operation 前输出 `◇ operation` 分组。
- 在全部结果收集完成后输出整体成功摘要。
- 在捕获失败时输出一次错误摘要。

平台 CI 适配器只输出平台 SDK 内部细节，例如“开发版上传成功”“二维码已保存”“版本号低于最新上传版本”。这样边界是：runner 管流程，CI adapter 管平台动作。

CLI 顶层 `packages/cli/src/cli.ts` 使用同一套 logger 展示普通执行结果和 catch 错误。`uni-mini-ci-core` 需要从入口导出 `Logger` 类型和 `createLogger()`，供 sibling package 复用；这不是用户配置项。由于 core 已经输出二维码路径和内容，CLI 顶层不应重复打印同一份二维码信息；实现时通过测试确认不会出现重复路径。

## 数据流设计

执行入口在拿到已解析参数后开始建立日志上下文。整体运行头的数据来自 `args.operations` 和首个已归一化配置，包括平台、版本、产物目录和操作列表。

多 action 场景中，每次循环仍按当前 operation 调用 `normalizeConfig()`，生成单 action 的 `NormalizedMiniCIConfig`。每个 operation 的分组日志在进入平台动作前输出；平台适配器返回 `MiniCISingleResult` 后，runner 根据结果输出该 operation 的完成状态和二维码摘要。

`printQrcode2Terminal()` 保持专注于二维码字符图输出，不负责业务状态文本。调用方在二维码图前后用 logger 输出说明，避免二维码图和业务日志混在同一行。

## 错误处理设计

日志优化不改变错误语义：

- 不吞错误。
- 不改变 `MiniCIResult` 和 `MiniCISingleResult`。
- 不改变 `onPreviewComplete`、`onUploadComplete`、`onError` 的触发顺序。
- 不改变 CLI exit code。
- 不改变 Vite 插件向上抛错行为。

可恢复的辅助失败输出为警告，例如二维码内容读取失败但 CI 操作本身成功。真正导致流程失败的错误输出为红色错误，并由 runner 或 CLI catch 统一输出一次，平台适配器不再重复 `console.error()`。

hook 自身报错时沿用现有 cause 保留逻辑。最终展示只负责把错误消息和已知上下文排版清楚。

## 测试设计

测试分三层：

1. `packages/core/tests/runtime.test.ts` 增加 logger 字符串断言，覆盖分组、成功、警告、错误和灰色辅助信息。测试中需要稳定颜色输出或只断言关键片段，避免终端环境差异导致快照不稳定。
2. runner 相关测试补充多 operation 日志分组行为，确认执行顺序、hook 语义和 fail-fast 语义不变。日志断言只覆盖关键文本，不把长日志完整写死。
3. CLI 测试补充顶层结果和错误输出断言，确认 `--help`、`--version` 保持原始输出，普通执行不重复打印二维码路径。

实现后至少运行：

```bash
pnpm run test
pnpm run typecheck
pnpm run typecheck:test
```

如果实现触及 lint 或格式敏感区域，再补跑：

```bash
pnpm run lint
pnpm run fmt:check
```

## 非目标

- 不新增日志配置字段。
- 不新增 JSON 日志、plain mode、静默模式或日志级别系统。
- 不改平台 SDK 调用参数。
- 不改 hooks API。
- 不手动修改 `.d.ts` 和 `.d.ts.map` 生成文件。
- 不重写 README 或 docs 中用户自定义 hook 的 `console.log()` 示例；仅在已有文档展示内置 CLI 输出时同步对应示例。
