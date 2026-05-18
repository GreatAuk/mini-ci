import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { runMiniCIWithConfig } from "../src/runMiniCIWithConfig";
import { runBump } from "../src/bump/runBump";

/** bumpp versionBump mock */
const versionBump = vi.fn();
/** 临时目录列表 */
const tempDirs: string[] = [];

vi.mock("bumpp", () => ({
  versionBump: (options: unknown) => versionBump(options),
}));

/**
 * 创建 bump 测试项目。
 *
 * @returns 临时项目目录
 */
async function createProject(): Promise<string> {
  /** 临时项目目录 */
  const cwd = await mkdtemp(path.join(os.tmpdir(), "minici-bump-"));
  tempDirs.push(cwd);
  await writeFile(path.join(cwd, "package.json"), JSON.stringify({ version: "1.0.0" }));
  return cwd;
}

afterEach(async () => {
  versionBump.mockReset();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("runBump", () => {
  test("默认禁用 commit tag push 并强制使用传入 cwd", async () => {
    versionBump.mockResolvedValue({
      currentVersion: "1.0.0",
      newVersion: "1.0.1",
      commit: false,
      tag: false,
      updatedFiles: ["package.json"],
      skippedFiles: [],
    });

    const result = await runBump({
      cwd: "/repo",
      bumpOptions: {
        release: "patch",
      },
      context: { cwd: "/repo", platform: "mp-weixin", operations: ["upload"] },
    });

    expect(versionBump).toHaveBeenCalledWith({
      commit: false,
      tag: false,
      push: false,
      release: "patch",
      cwd: "/repo",
    });
    expect(result).toEqual({
      success: true,
      currentVersion: "1.0.0",
      newVersion: "1.0.1",
      commit: false,
      tag: false,
      updatedFiles: ["package.json"],
      skippedFiles: [],
    });
  });

  test("用户配置可以覆盖 commit tag push 默认值但不能覆盖 cwd", async () => {
    versionBump.mockResolvedValue({
      currentVersion: "1.0.0",
      newVersion: "1.1.0",
      commit: "release v1.1.0",
      tag: "v1.1.0",
      updatedFiles: ["package.json"],
      skippedFiles: [],
    });

    await runBump({
      cwd: "/repo",
      bumpOptions: {
        release: "minor",
        commit: true,
        tag: true,
        push: true,
        cwd: "/other",
      },
      context: { cwd: "/repo", platform: "mp-weixin", operations: ["upload"] },
    });

    expect(versionBump).toHaveBeenCalledWith({
      commit: true,
      tag: true,
      push: true,
      release: "minor",
      cwd: "/repo",
    });
  });

  test("bumpOptions 函数形式会接收上下文并解析", async () => {
    versionBump.mockResolvedValue({
      currentVersion: "2.0.0",
      newVersion: "2.0.1",
      commit: false,
      tag: false,
      updatedFiles: ["package.json"],
      skippedFiles: [],
    });

    const bumpOptionsFn = vi.fn().mockReturnValue({ release: "patch" });

    await runBump({
      cwd: "/repo",
      bumpOptions: bumpOptionsFn,
      context: { cwd: "/repo", platform: "mp-alipay", operations: ["preview", "upload"] },
    });

    expect(bumpOptionsFn).toHaveBeenCalledWith({
      cwd: "/repo",
      platform: "mp-alipay",
      operations: ["preview", "upload"],
    });
    expect(versionBump).toHaveBeenCalledWith({
      commit: false,
      tag: false,
      push: false,
      release: "patch",
      cwd: "/repo",
    });
  });
});

describe("runMiniCIWithConfig bump integration", () => {
  test("bump-only 不要求平台配置并返回 bump-only 结果", async () => {
    const cwd = await createProject();
    versionBump.mockResolvedValue({
      currentVersion: "1.0.0",
      newVersion: "1.0.1",
      commit: false,
      tag: false,
      updatedFiles: ["package.json"],
      skippedFiles: [],
    });

    const result = await runMiniCIWithConfig({
      args: {
        operations: [],
        bump: true,
      },
      cwd,
      config: {
        bumpOptions: {
          release: "patch",
          confirm: false,
        },
      },
    });

    expect(result).toEqual({
      success: true,
      operations: [],
      bump: {
        success: true,
        currentVersion: "1.0.0",
        newVersion: "1.0.1",
        commit: false,
        tag: false,
        updatedFiles: ["package.json"],
        skippedFiles: [],
      },
    });
  });

  test("bump 搭配 action 但不含 upload 时不调用 bumpp", async () => {
    const cwd = await createProject();

    await expect(
      runMiniCIWithConfig({
        args: {
          operations: ["preview"],
          bump: true,
          platform: "mp-weixin",
        },
        cwd,
        config: {},
      }),
    ).rejects.toThrow("bump 搭配 CI 操作时必须包含 upload");

    expect(versionBump).not.toHaveBeenCalled();
  });

  test("bump 失败时触发 onError 且 operation 为空", async () => {
    const cwd = await createProject();
    /** 错误 hook */
    const onError = vi.fn();
    versionBump.mockRejectedValue(new Error("bump failed"));

    await expect(
      runMiniCIWithConfig({
        args: {
          operations: ["upload"],
          bump: true,
          platform: "mp-weixin",
        },
        cwd,
        config: {
          hooks: {
            onError,
          },
          "mp-weixin": {
            appid: "wx-appid",
            privateKeyPath: "key/private.key",
          },
        },
      }),
    ).rejects.toThrow("bump failed");

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(Error),
      }),
    );
  });
});
