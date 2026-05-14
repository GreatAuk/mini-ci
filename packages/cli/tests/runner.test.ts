import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";

/** mock createCI 返回的执行记录 */
const calls: Array<{ method: string }> = [];
/** 需要 mock 失败的操作 */
let failingMethod: string | undefined;

vi.mock("../../core/src/ci/registry", () => ({
  createCI: (config: any) => ({
    init: vi.fn(),
    open: vi.fn().mockImplementation(() => {
      if (failingMethod === "open") {
        throw new Error("open failed");
      }
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
      if (failingMethod === "preview") {
        throw new Error("preview failed");
      }
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
      if (failingMethod === "upload") {
        throw new Error("upload failed");
      }
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
        desc: ({ operation }) => \`配置描述-\${operation}\`,
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
  failingMethod = undefined;
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
    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.version).toBe("2.0.0");
    expect(result.results[0]?.desc).toBe("CLI 描述");
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

  test("按固定顺序执行多个操作并返回聚合结果", async () => {
    const cwd = await createProjectDir();

    const { runMiniCI } = await import("../src/index");
    const result = await runMiniCI({
      argv: ["--upload", "--open", "--preview", "--platform", "mp-weixin"],
      cwd,
    });

    expect(calls).toEqual([{ method: "open" }, { method: "preview" }, { method: "upload" }]);
    expect(result.success).toBe(true);
    expect(result.operations).toEqual(["open", "preview", "upload"]);
    expect(result.results.map((item) => item.operation)).toEqual(["open", "preview", "upload"]);
  });

  test("多个操作会为每个 action 分别解析 desc 上下文", async () => {
    const cwd = await createProjectDir();

    const { runMiniCI } = await import("../src/index");
    const result = await runMiniCI({
      argv: ["--open", "--preview", "--platform", "mp-weixin"],
      cwd,
    });

    expect(result.results.map((item) => item.desc)).toEqual(["配置描述-open", "配置描述-preview"]);
  });

  test("某个操作失败时不会继续执行后续操作", async () => {
    const cwd = await createProjectDir();
    failingMethod = "preview";

    const { runMiniCI } = await import("../src/index");

    await expect(
      runMiniCI({
        argv: ["--open", "--preview", "--upload", "--platform", "mp-weixin"],
        cwd,
      }),
    ).rejects.toThrow("preview failed");

    expect(calls).toEqual([{ method: "open" }]);
  });
});
