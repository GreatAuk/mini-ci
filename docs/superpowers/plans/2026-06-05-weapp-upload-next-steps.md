# Weapp Upload Next Steps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 微信 `mp-weixin` 上传成功后，在终端打印进入微信公众平台选为体验版的下一步操作提示。

**Architecture:** 改动留在 `packages/core/src/ci/WeappCI.ts` 的微信上传成功路径，避免通用 runner 混入微信平台专属文案。测试补在 `packages/core/tests/ci-qrcode-path.test.ts` 的微信适配器测试附近，通过 mock `console.log` 验证用户可见提示文本。

**Tech Stack:** TypeScript ESM, Vitest, pnpm, Turbo monorepo, existing `Logger`.

---

## File Structure

- Modify: `packages/core/tests/ci-qrcode-path.test.ts`
  - 负责微信 CI 适配器上传行为的回归测试。
  - 新增 ANSI 清理 helper 和微信上传成功提示断言。
- Modify: `packages/core/src/ci/WeappCI.ts`
  - 负责微信平台 open / preview / upload 行为。
  - 在 `upload()` 成功路径追加固定下一步提示。

不要修改自动生成的 `.d.ts` 或 `.d.ts.map` 文件。当前工作区有未归属的 `README.md` 改动，执行计划时不要暂存、提交或覆盖它。

### Task 1: 微信上传成功提示

**Files:**
- Modify: `packages/core/tests/ci-qrcode-path.test.ts`
- Modify: `packages/core/src/ci/WeappCI.ts`

- [ ] **Step 1: 写失败测试**

在 `packages/core/tests/ci-qrcode-path.test.ts` 的 `vi.mock("shelljs", ...)` 后新增 ANSI 清理 helper：

```ts
/**
 * 移除 ANSI 颜色控制字符。
 *
 * @param value 待处理文本
 * @returns 无颜色控制字符的文本
 */
function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-9;]*m/g, "");
}
```

在 `describe("WeappCI - qrcodePath 路径选取", () => { ... })` 内，放在两个 `upload()` 路径测试之后新增测试：

```ts
  it("upload() 成功后打印微信公众平台下一步操作提示", async () => {
    /** console.log mock */
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    /** 微信 CI 实例 */
    const ci = new WeappCI(makeWeappConfig());
    (ci as any).ci = {
      upload: vi.fn().mockResolvedValue({}),
    };
    (ci as any).instance = {};

    try {
      await ci.upload();

      /** 去除颜色后的日志文本 */
      const output = log.mock.calls.map(([line]) => stripAnsi(String(line))).join("\n");

      expect(output).toContain("下一步操作:");
      expect(output).toContain("1. 登录微信公众平台: https://mp.weixin.qq.com");
      expect(output).toContain('2. 进入 "管理 -> 版本管理"');
      expect(output).toContain('3. 在 "开发版本" 中找到刚上传的版本');
      expect(output).toContain('4. 点击 "选为体验版" 按钮');
    } finally {
      log.mockRestore();
    }
  });
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm --dir packages/core exec vitest tests/ci-qrcode-path.test.ts -t "upload() 成功后打印微信公众平台下一步操作提示"
```

Expected: FAIL，失败原因是 `output` 不包含 `下一步操作:`。

- [ ] **Step 3: 写最小实现**

在 `packages/core/src/ci/WeappCI.ts` 的 `upload()` 方法内，放在体验版二维码生成 `try/catch` 之后、`return this.createResult(true, ...)` 之前新增固定提示：

```ts
      this.logger.remind("下一步操作:");
      this.logger.remind("1. 登录微信公众平台: https://mp.weixin.qq.com");
      this.logger.remind('2. 进入 "管理 -> 版本管理"');
      this.logger.remind('3. 在 "开发版本" 中找到刚上传的版本');
      this.logger.remind('4. 点击 "选为体验版" 按钮');
```

插入后的局部代码应保持这个顺序，确保二维码生成失败但上传成功时仍会打印下一步提示：

```ts
      try {
        qrContent = `https://open.weixin.qq.com/sns/getexpappinfo?appid=${weappConfig.appid}#wechat-redirect`;
        await printQrcode2Terminal(qrContent);
        await generateQrcodeImageFile(uploadQrcodePath, qrContent);
        this.logger.success("体验版二维码已生成");
        this.logger.detail("path", uploadQrcodePath);
        this.logger.detail("qr", qrContent);
      } catch (error) {
        this.logger.warn(
          "体验二维码生成失败",
          error instanceof Error ? error.message : String(error),
        );
      }

      this.logger.remind("下一步操作:");
      this.logger.remind("1. 登录微信公众平台: https://mp.weixin.qq.com");
      this.logger.remind('2. 进入 "管理 -> 版本管理"');
      this.logger.remind('3. 在 "开发版本" 中找到刚上传的版本');
      this.logger.remind('4. 点击 "选为体验版" 按钮');

      return this.createResult(true, {
        qrCodeContent: qrContent,
        qrCodeLocalPath: uploadQrcodePath,
      });
```

- [ ] **Step 4: 运行聚焦测试确认通过**

Run:

```bash
pnpm --dir packages/core exec vitest tests/ci-qrcode-path.test.ts -t "upload() 成功后打印微信公众平台下一步操作提示"
```

Expected: PASS，测试报告显示该测试通过。

- [ ] **Step 5: 运行相关测试文件**

Run:

```bash
pnpm --dir packages/core exec vitest tests/ci-qrcode-path.test.ts
```

Expected: PASS，`ci-qrcode-path.test.ts` 内全部测试通过。

- [ ] **Step 6: 运行根目录验证**

Run:

```bash
pnpm run test
pnpm run typecheck
pnpm run typecheck:test
```

Expected: 三个命令全部成功退出。若格式或 lint 在实现过程中发现问题，再补跑：

```bash
pnpm run lint
pnpm run fmt:check
```

Expected: 如执行，两个命令均成功退出。

- [ ] **Step 7: 检查 diff 和提交**

Run:

```bash
git status --short
git diff -- packages/core/src/ci/WeappCI.ts packages/core/tests/ci-qrcode-path.test.ts
git add packages/core/src/ci/WeappCI.ts packages/core/tests/ci-qrcode-path.test.ts
git commit -m "feat(core): add weapp upload next steps"
```

Expected: 提交只包含 `packages/core/src/ci/WeappCI.ts` 和 `packages/core/tests/ci-qrcode-path.test.ts`。不要暂存或提交当前未归属的 `README.md` 修改。

## Self-Review

- Spec coverage: 计划实现了只在 `mp-weixin upload()` 成功后打印固定四步提示；失败路径不新增输出；其他平台没有改动；返回值、hooks、runner 和配置不变。
- Placeholder scan: 本计划没有空白项、空泛测试要求或未定义函数。
- Type consistency: 使用现有 `WeappCI`、`makeWeappConfig()`、`Logger.remind()`、Vitest `vi.spyOn()`，不新增公共类型或 API。
