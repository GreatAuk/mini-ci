import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { runMiniCIWithConfig } from "../src/runMiniCIWithConfig";

import type { MiniCIConfig, MiniCIOperation } from "../src/types";

/** mock createCI 返回的执行记录 */
const calls: MiniCIOperation[] = [];
/** mock 失败的操作或初始化阶段 */
let failingMethod: MiniCIOperation | "init" | undefined;
/** 临时目录列表 */
const tempDirs: string[] = [];

vi.mock("../src/ci/registry", () => ({
  createCI: (config: any) => ({
    init: vi.fn().mockImplementation(() => {
      if (failingMethod === "init") {
        throw new Error("init failed");
      }
    }),
    open: vi.fn().mockImplementation(() => {
      if (failingMethod === "open") {
        throw new Error("open failed");
      }

      calls.push("open");

      return {
        success: true,
        operation: config.operation,
        platform: config.platform,
        version: config.version,
        desc: config.desc,
        projectPath: config.projectPath,
      };
    }),
    preview: vi.fn().mockImplementation(() => {
      if (failingMethod === "preview") {
        throw new Error("preview failed");
      }

      calls.push("preview");

      return {
        success: true,
        operation: config.operation,
        platform: config.platform,
        version: config.version,
        desc: config.desc,
        projectPath: config.projectPath,
        qrCodeContent: "preview-content",
        qrCodeLocalPath: "/repo/preview.png",
      };
    }),
    upload: vi.fn().mockImplementation(() => {
      if (failingMethod === "upload") {
        throw new Error("upload failed");
      }

      calls.push("upload");

      return {
        success: true,
        operation: config.operation,
        platform: config.platform,
        version: config.version,
        desc: config.desc,
        projectPath: config.projectPath,
        qrCodeContent: "upload-content",
        qrCodeLocalPath: "/repo/upload.png",
      };
    }),
  }),
}));

/**
 * 创建临时测试项目。
 *
 * @returns 临时项目目录和构建产物目录
 */
async function createProject(): Promise<{ cwd: string; projectPath: string }> {
  /** 临时项目目录 */
  const cwd = await mkdtemp(path.join(os.tmpdir(), "minici-hooks-"));
  /** 小程序构建产物目录 */
  const projectPath = path.join(cwd, "dist/build/mp-weixin");

  tempDirs.push(cwd);
  await mkdir(projectPath, { recursive: true });
  await writeFile(path.join(cwd, "package.json"), JSON.stringify({ version: "1.0.0" }));

  return { cwd, projectPath };
}

/**
 * 执行带 hooks 的共享 runner。
 *
 * @param operations 当前操作列表
 * @param hooks hooks 配置
 * @returns minici 执行结果
 */
async function runWithHooks(operations: MiniCIOperation[], hooks: MiniCIConfig["hooks"]) {
  /** 临时项目 */
  const project = await createProject();

  return runMiniCIWithConfig({
    args: {
      operations,
      platform: "mp-weixin",
      projectPath: project.projectPath,
    },
    cwd: project.cwd,
    config: {
      version: "1.0.0",
      desc: "测试描述",
      hooks,
      "mp-weixin": {
        appid: "wx-appid",
        privateKeyPath: "key/private.key",
      },
    },
  });
}

afterEach(async () => {
  calls.length = 0;
  failingMethod = undefined;
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("runMiniCIWithConfig hooks", () => {
  test("preview 成功时触发 onPreviewComplete", async () => {
    /** preview 完成 hook */
    const onPreviewComplete = vi.fn();

    await runWithHooks(["preview"], { onPreviewComplete });

    expect(onPreviewComplete).toHaveBeenCalledTimes(1);
    expect(onPreviewComplete).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({
        platform: "mp-weixin",
        version: "1.0.0",
        desc: "测试描述",
        qrCodeContent: "preview-content",
        qrCodeLocalPath: "/repo/preview.png",
      }),
    });
  });

  test("upload 成功时触发 onUploadComplete", async () => {
    /** upload 完成 hook */
    const onUploadComplete = vi.fn();

    await runWithHooks(["upload"], { onUploadComplete });

    expect(onUploadComplete).toHaveBeenCalledTimes(1);
    expect(onUploadComplete).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({
        platform: "mp-weixin",
        version: "1.0.0",
        desc: "测试描述",
        qrCodeContent: "upload-content",
        qrCodeLocalPath: "/repo/upload.png",
      }),
    });
  });

  test("open 成功时不触发 complete hook", async () => {
    /** preview 完成 hook */
    const onPreviewComplete = vi.fn();
    /** upload 完成 hook */
    const onUploadComplete = vi.fn();
    /** 错误 hook */
    const onError = vi.fn();

    await runWithHooks(["open"], { onPreviewComplete, onUploadComplete, onError });

    expect(onPreviewComplete).not.toHaveBeenCalled();
    expect(onUploadComplete).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  test("preview CI 方法失败时先触发 complete hook 再触发 onError", async () => {
    /** hook 触发顺序 */
    const events: string[] = [];
    /** preview 完成 hook */
    const onPreviewComplete = vi.fn(() => {
      events.push("complete");
    });
    /** 错误 hook */
    const onError = vi.fn(() => {
      events.push("error");
    });
    failingMethod = "preview";

    await expect(runWithHooks(["preview"], { onPreviewComplete, onError })).rejects.toThrow(
      "preview failed",
    );

    expect(events).toEqual(["complete", "error"]);
    expect(onPreviewComplete).toHaveBeenCalledWith({
      success: false,
      data: expect.objectContaining({
        platform: "mp-weixin",
        version: "1.0.0",
        desc: "测试描述",
      }),
      error: expect.any(Error),
    });
    expect(onError).toHaveBeenCalledWith({
      operation: "preview",
      platform: "mp-weixin",
      error: expect.any(Error),
      data: expect.objectContaining({
        platform: "mp-weixin",
        version: "1.0.0",
        desc: "测试描述",
      }),
    });
  });

  test("upload CI 方法失败时先触发 complete hook 再触发 onError", async () => {
    /** hook 触发顺序 */
    const events: string[] = [];
    /** upload 完成 hook */
    const onUploadComplete = vi.fn(() => {
      events.push("complete");
    });
    /** 错误 hook */
    const onError = vi.fn(() => {
      events.push("error");
    });
    failingMethod = "upload";

    await expect(runWithHooks(["upload"], { onUploadComplete, onError })).rejects.toThrow(
      "upload failed",
    );

    expect(events).toEqual(["complete", "error"]);
    expect(onUploadComplete).toHaveBeenCalledWith({
      success: false,
      data: expect.objectContaining({
        platform: "mp-weixin",
        version: "1.0.0",
        desc: "测试描述",
      }),
      error: expect.any(Error),
    });
  });

  test("前置失败只触发 onError，不触发 complete hook", async () => {
    /** preview 完成 hook */
    const onPreviewComplete = vi.fn();
    /** 错误 hook */
    const onError = vi.fn();
    failingMethod = "init";

    await expect(runWithHooks(["preview"], { onPreviewComplete, onError })).rejects.toThrow(
      "init failed",
    );

    expect(onPreviewComplete).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith({
      operation: "preview",
      platform: "mp-weixin",
      error: expect.any(Error),
      data: expect.objectContaining({
        platform: "mp-weixin",
        version: "1.0.0",
        desc: "测试描述",
      }),
    });
  });

  test("open 失败时触发 onError", async () => {
    /** 错误 hook */
    const onError = vi.fn();
    failingMethod = "open";

    await expect(runWithHooks(["open"], { onError })).rejects.toThrow("open failed");

    expect(onError).toHaveBeenCalledWith({
      operation: "open",
      platform: "mp-weixin",
      error: expect.any(Error),
      data: expect.objectContaining({
        platform: "mp-weixin",
        version: "1.0.0",
        desc: "测试描述",
      }),
    });
  });

  test("complete hook 抛错时触发 onError 并让主流程失败", async () => {
    /** complete hook 抛出的错误 */
    const hookError = new Error("complete failed");
    /** preview 完成 hook */
    const onPreviewComplete = vi.fn(() => {
      throw hookError;
    });
    /** 错误 hook */
    const onError = vi.fn();

    await expect(runWithHooks(["preview"], { onPreviewComplete, onError })).rejects.toThrow(
      "complete failed",
    );

    expect(onError).toHaveBeenCalledWith({
      operation: "preview",
      platform: "mp-weixin",
      error: hookError,
      data: expect.objectContaining({
        qrCodeContent: "preview-content",
        qrCodeLocalPath: "/repo/preview.png",
      }),
    });
  });

  test("CI 方法失败后 complete hook 也失败时，最终错误来自 complete hook 且 cause 保留 CI 错误", async () => {
    /** preview 完成 hook */
    const onPreviewComplete = vi.fn(() => {
      throw new Error("complete failed");
    });
    /** 错误 hook */
    const onError = vi.fn();
    failingMethod = "preview";

    await expect(runWithHooks(["preview"], { onPreviewComplete, onError })).rejects.toMatchObject({
      message: "complete failed",
      cause: expect.objectContaining({ message: "preview failed" }),
    });

    expect(onError).toHaveBeenCalledWith({
      operation: "preview",
      platform: "mp-weixin",
      error: expect.objectContaining({
        message: "complete failed",
        cause: expect.objectContaining({ message: "preview failed" }),
      }),
      data: expect.objectContaining({
        platform: "mp-weixin",
      }),
    });
  });

  test("complete hook 错误已有 cause 时，cause 仍指向本次 CI 错误", async () => {
    /** complete hook 原有 cause */
    const existingCause = new Error("existing cause");
    /** complete hook 抛出的错误 */
    const hookError = new Error("complete failed");
    Object.defineProperty(hookError, "cause", {
      value: existingCause,
      configurable: true,
    });
    /** preview 完成 hook */
    const onPreviewComplete = vi.fn(() => {
      throw hookError;
    });
    /** 错误 hook */
    const onError = vi.fn();
    failingMethod = "preview";

    await expect(runWithHooks(["preview"], { onPreviewComplete, onError })).rejects.toMatchObject({
      message: "complete failed",
      cause: expect.objectContaining({ message: "preview failed" }),
      previousCause: expect.objectContaining({ message: "existing cause" }),
    });
  });

  test("onError 抛错时最终错误来自 onError 且 cause 保留原错误", async () => {
    /** 错误 hook */
    const onError = vi.fn(() => {
      throw new Error("onError failed");
    });
    failingMethod = "open";

    await expect(runWithHooks(["open"], { onError })).rejects.toMatchObject({
      message: "onError failed",
      cause: expect.objectContaining({ message: "open failed" }),
    });
  });

  test("多 action 中 preview 失败后 fail-fast，不执行 upload", async () => {
    /** preview 完成 hook */
    const onPreviewComplete = vi.fn();
    /** upload 完成 hook */
    const onUploadComplete = vi.fn();
    /** 错误 hook */
    const onError = vi.fn();
    failingMethod = "preview";

    await expect(
      runWithHooks(["preview", "upload"], { onPreviewComplete, onUploadComplete, onError }),
    ).rejects.toThrow("preview failed");

    expect(onPreviewComplete).toHaveBeenCalledTimes(1);
    expect(onUploadComplete).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });
});
