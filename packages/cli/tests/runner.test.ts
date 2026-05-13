import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";

/** mock createCI 返回的执行记录 */
const calls: Array<{ method: string }> = [];

vi.mock("../../core/src/ci/registry", () => ({
  createCI: (config: any) => ({
    init: vi.fn(),
    open: vi.fn().mockImplementation(() => {
      calls.push({ method: "open" });
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
      calls.push({ method: "preview" });
      return {
        success: true,
        operation: config.operation,
        platform: config.platform,
        version: config.version,
        desc: config.desc,
        projectPath: config.projectPath,
      };
    }),
    upload: vi.fn().mockImplementation(() => {
      calls.push({ method: "upload" });
      return {
        success: true,
        operation: config.operation,
        platform: config.platform,
        version: config.version,
        desc: config.desc,
        projectPath: config.projectPath,
      };
    }),
  }),
}));

/** 临时目录列表 */
const tempDirs: string[] = [];

/**
 * 创建临时目录。
 *
 * @returns 临时目录绝对路径
 */
async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "minici-runner-"));
  tempDirs.push(dir);
  return dir;
}

/**
 * 创建带有基础微信配置的临时项目目录。
 *
 * @returns 临时目录绝对路径
 */
async function createProjectDir(): Promise<string> {
  const cwd = await createTempDir();
  await mkdir(path.join(cwd, "dist/build/mp-weixin"), { recursive: true });
  await writeFile(path.join(cwd, "package.json"), JSON.stringify({ version: "1.0.0" }));
  await writeFile(
    path.join(cwd, "minici.config.mjs"),
    `
      export default {
        desc: '配置描述',
        'mp-weixin': {
          appid: 'wx-appid',
          privateKeyPath: 'key/private.key'
        }
      }
    `,
  );
  return cwd;
}

afterEach(async () => {
  calls.length = 0;
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("runMiniCI", () => {
  test("加载配置并执行 upload 操作", async () => {
    const cwd = await createProjectDir();

    const { runMiniCI } = await import("../src/index");
    const result = await runMiniCI({
      argv: ["--upload", "--platform", "mp-weixin"],
      cwd,
    });

    expect(result.success).toBe(true);
    expect(calls).toEqual([{ method: "upload" }]);
  });

  test("执行 preview 操作", async () => {
    const cwd = await createProjectDir();

    const { runMiniCI } = await import("../src/index");
    await runMiniCI({
      argv: ["--preview", "--platform", "mp-weixin"],
      cwd,
    });

    expect(calls).toEqual([{ method: "preview" }]);
  });

  test("执行 open 操作", async () => {
    const cwd = await createProjectDir();

    const { runMiniCI } = await import("../src/index");
    await runMiniCI({
      argv: ["--open", "--platform", "mp-weixin"],
      cwd,
    });

    expect(calls).toEqual([{ method: "open" }]);
  });

  test("命令行 version 和 desc 正确传递", async () => {
    const cwd = await createProjectDir();

    const { runMiniCI } = await import("../src/index");
    const result = await runMiniCI({
      argv: ["--upload", "--platform", "mp-weixin", "--version", "2.0.0", "--desc", "CLI 描述"],
      cwd,
    });

    expect(result.version).toBe("2.0.0");
    expect(result.desc).toBe("CLI 描述");
  });

  test("projectPath 不存在时抛出错误", async () => {
    const cwd = await createTempDir();
    await writeFile(path.join(cwd, "package.json"), JSON.stringify({ version: "1.0.0" }));
    await writeFile(
      path.join(cwd, "minici.config.mjs"),
      `
        export default {
          'mp-weixin': {
            appid: 'wx-appid',
            privateKeyPath: 'key/private.key'
          }
        }
      `,
    );

    const { runMiniCI } = await import("../src/index");

    await expect(
      runMiniCI({
        argv: ["--upload", "--platform", "mp-weixin", "--projectPath", "missing-dist"],
        cwd,
      }),
    ).rejects.toThrow("projectPath 不存在");
  });

  test("缺少平台配置时抛出包含平台名的错误", async () => {
    const cwd = await createTempDir();
    await mkdir(path.join(cwd, "dist/build/mp-alipay"), { recursive: true });
    await writeFile(path.join(cwd, "package.json"), JSON.stringify({ version: "1.0.0" }));

    const { runMiniCI } = await import("../src/index");

    await expect(
      runMiniCI({
        argv: ["--upload", "--platform", "mp-alipay"],
        cwd,
      }),
    ).rejects.toThrow("mp-alipay");
  });

  test("缺少操作参数时抛出错误", async () => {
    const cwd = await createProjectDir();

    const { runMiniCI } = await import("../src/index");

    await expect(
      runMiniCI({
        argv: ["--platform", "mp-weixin"],
        cwd,
      }),
    ).rejects.toThrow("请指定操作");
  });
});
