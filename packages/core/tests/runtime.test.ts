import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { loadPackageJson } from "../src/config/loadPackageJson";
import { createRuntimeContext } from "../src/runtime/createContext";
import { createLogger, isErrorLogged, markErrorLogged } from "../src/runtime/logger";

/** 临时目录列表，测试结束后清理 */
const tempDirs: string[] = [];

/**
 * 创建临时目录。
 *
 * @returns 临时目录绝对路径
 */
async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "minici-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("loadPackageJson", () => {
  test("存在 package.json 时返回解析后的内容", async () => {
    const cwd = await createTempDir();
    await writeFile(path.join(cwd, "package.json"), JSON.stringify({ version: "1.0.0" }));

    await expect(loadPackageJson(cwd)).resolves.toEqual({ version: "1.0.0" });
  });

  test("不存在 package.json 时返回空对象", async () => {
    const cwd = await createTempDir();

    await expect(loadPackageJson(cwd)).resolves.toEqual({});
  });
});

describe("createRuntimeContext", () => {
  test("检查路径存在性并暴露用户主目录", async () => {
    const cwd = await createTempDir();
    const ctx = createRuntimeContext({ cwd });

    await expect(ctx.pathExists(cwd)).resolves.toBe(true);
    expect(ctx.getUserHomeDir()).toBe(os.homedir());
  });

  test("不存在的路径返回 false", async () => {
    const cwd = await createTempDir();
    const ctx = createRuntimeContext({ cwd });

    await expect(ctx.pathExists(path.join(cwd, "nonexistent"))).resolves.toBe(false);
  });
});

/**
 * 移除 ANSI 颜色控制字符。
 *
 * @param value 待处理文本
 * @returns 无颜色控制字符的文本
 */
function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-9;]*m/g, "");
}

describe("createLogger", () => {
  test("输出分组块和缩进状态行", () => {
    /** console.log mock */
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    /** 默认 logger */
    const logger = createLogger();

    logger.header("minici", "mp-weixin · 1.0.0");
    logger.detail("projectPath", "dist/build/mp-weixin");
    logger.blank();
    logger.group("preview", "上传开发版并生成预览码");
    logger.success("开发版上传成功", "10:24:12");
    logger.detail("qr", "https://example.com/preview");

    expect(log.mock.calls.map(([line]) => stripAnsi(String(line)))).toEqual([
      "● minici mp-weixin · 1.0.0",
      "  projectPath dist/build/mp-weixin",
      "",
      "◇ preview 上传开发版并生成预览码",
      "  ✓ 开发版上传成功 10:24:12",
      "  qr https://example.com/preview",
    ]);

    log.mockRestore();
  });

  test("输出警告和错误语义", () => {
    /** console.log mock */
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    /** 默认 logger */
    const logger = createLogger();

    logger.warn("版本号低于最新上传版本", "1.0.0 <= 1.0.1");
    logger.error("执行失败");
    logger.detail("error", "preview failed");

    expect(log.mock.calls.map(([line]) => stripAnsi(String(line)))).toEqual([
      "  ! 版本号低于最新上传版本 1.0.0 <= 1.0.1",
      "✕ 执行失败",
      "  error preview failed",
    ]);

    log.mockRestore();
  });

  test("标记已记录错误，避免 CLI 重复输出", () => {
    /** 测试错误对象 */
    const error = new Error("preview failed");

    expect(isErrorLogged(error)).toBe(false);
    markErrorLogged(error);
    expect(isErrorLogged(error)).toBe(true);
    expect(isErrorLogged("preview failed")).toBe(false);
  });
});
