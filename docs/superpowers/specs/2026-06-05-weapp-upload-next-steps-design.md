# 微信上传成功下一步提示设计文档

## 背景

当前 `uni-mini-ci` 已经通过 `packages/core/src/ci/WeappCI.ts` 的 `upload()` 完成微信小程序体验版上传，并在成功后输出上传成功、体验版二维码路径和二维码内容。用户在完成微信 `--upload` 后，还需要登录微信公众平台，把刚上传的开发版本选为体验版。

本设计只新增微信上传成功后的终端提示。不改变上传参数、二维码生成、返回结果、hooks、CLI exit code、Vite 插件生命周期，也不影响其他平台。

## 已确认决策

- 提示只在 `mp-weixin` 的 `upload()` 成功后打印。
- `open()`、`preview()`、上传失败、二维码生成失败、其他平台 `upload()` 都不打印这段微信公众平台指引。
- 实现位置采用 `WeappCI.upload()` 成功路径，保持平台专属文案留在微信适配器内。
- CLI 和 Vite 插件共享 `uni-mini-ci-core`，因此不需要在 CLI 或插件层重复实现。
- 提示文案固定，不新增配置项、开关或 hook。
- 不手动修改 `.d.ts` 和 `.d.ts.map` 生成文件。

## 目标输出

微信 `--upload` 成功后，在现有成功日志和二维码日志之后追加：

```txt
下一步操作:
1. 登录微信公众平台: https://mp.weixin.qq.com
2. 进入 "管理 -> 版本管理"
3. 在 "开发版本" 中找到刚上传的版本
4. 点击 "选为体验版" 按钮
```

这段提示属于成功后的用户指引，不参与返回值，也不改变 `onUploadComplete` 收到的数据。

## 架构设计

改动集中在 `packages/core/src/ci/WeappCI.ts`。`WeappCI.upload()` 当前边界已经是微信平台上传行为，里面包含微信 SDK 调用、上传成功日志、体验版二维码生成和结果构造。新增提示放在该方法的成功流程末尾，确保只有 `this.ci.upload(...)` 成功返回后才输出。

日志输出复用现有 `Logger`。仓库已有 `logger.remind()`，语义适合普通提醒；如果实现时发现多行输出更适合 `logger.info()` 或 `logger.detail()`，也应保持同一处平台适配器内完成，不引入新的日志抽象。

不选择在 `runMiniCIWithConfig()` 判断 `platform === "mp-weixin" && operation === "upload"`，因为 runner 负责通用流程、分组和 hooks，微信后台路径属于平台专属知识。把提示留在 `WeappCI` 能避免通用 runner 混入平台文案。

## 数据流设计

执行流程保持不变：

1. CLI 或 Vite 插件解析出包含 `upload` 的操作。
2. `runMiniCIWithConfig()` 归一化配置并创建 `WeappCI`。
3. `WeappCI.upload()` 调用 `miniprogram-ci` 上传代码。
4. 上传成功后输出现有成功日志，尝试生成体验版二维码。
5. 输出“下一步操作”提示。
6. 返回原有 `MiniCISingleResult`。

如果二维码生成失败但上传成功，现有逻辑会输出警告并继续返回成功结果。新增提示仍应打印，因为用户仍需要在微信公众平台处理刚上传的版本。

## 错误处理设计

新增提示不改变错误处理：

- `this.ci.upload(...)` 抛错时，沿用现有 `mp-weixin upload 执行失败：...` 错误，不打印提示。
- 提示自身不做异步操作，不引入新的失败路径。
- hooks 触发顺序保持现状，仍由 `runMiniCIWithConfig()` 在 CI 方法返回后处理。
- 多 action 场景下如果 `preview` 失败，fail-fast 行为不变，后续 `upload` 不执行，也不会打印提示。

## 测试设计

测试补在 `packages/core` 现有微信 CI 测试附近，优先覆盖用户可见行为：

- mock `console.log` 或注入可观察 logger，执行 `WeappCI.upload()` 成功路径，断言输出包含完整“下一步操作”文案。
- 保留现有二维码路径测试，确保 `upload()` 返回值不变。
- 不为其他平台新增同款提示测试；其他平台没有代码路径变更，避免扩大测试范围。

实现后至少运行：

```bash
pnpm run test --filter uni-mini-ci-core
pnpm run typecheck --filter uni-mini-ci-core
pnpm run typecheck:test --filter uni-mini-ci-core
```

如果 Turbo filter 脚本不可用，则退回运行根目录：

```bash
pnpm run test
pnpm run typecheck
pnpm run typecheck:test
```

## 文档影响

这是终端成功提示的微小增强。实现时优先检查 `docs/cli.md`、`docs/vite-plugin.md` 或 `README.md` 是否已有微信上传成功输出示例需要同步；若更新文档，应只改与微信 `--upload` 输出直接相关的段落。当前工作区已有未归属的 `README.md` 修改，后续实现不得覆盖或夹带这部分改动。

## 非目标

- 不新增 CLI 参数。
- 不新增配置 schema 字段。
- 不改变 `MiniCIResult` 或 `MiniCISingleResult`。
- 不改变 `onUploadComplete`、`onError` 等 hook API。
- 不改变其他平台上传成功日志。
- 不重构 logger 或 runner。

## 成功标准

- `mp-weixin` 上传成功后打印指定四步提示。
- 微信上传失败时不打印提示。
- 非微信平台不打印这段微信提示。
- 现有上传返回值、二维码生成、hooks 和多 action 行为保持不变。
