import { afterEach, describe, expect, test, vi } from "vitest";

/** runMiniCI mock */
const runMiniCIMock = vi.fn();

vi.mock("../src/index", async () => {
  const actual = await vi.importActual<typeof import("../src/index")>("../src/index");

  return {
    ...actual,
    runMiniCI: runMiniCIMock,
  };
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

afterEach(() => {
  runMiniCIMock.mockReset();
  process.exitCode = undefined;
});

describe("CLI main", () => {
  test("help 保持原始输出且不调用 runMiniCI", async () => {
    /** console.log mock */
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const { main } = await import("../src/cli");

    await main(["--help"], "/repo");

    expect(runMiniCIMock).not.toHaveBeenCalled();
    expect(String(log.mock.calls[0]?.[0])).toContain("minici - uniapp 小程序 CI 工具");

    log.mockRestore();
  });

  test("未被 core 记录的错误由 CLI 输出一次", async () => {
    /** console.log mock */
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    runMiniCIMock.mockRejectedValueOnce(new Error("请指定平台"));
    const { main } = await import("../src/cli");

    await main(["--upload"], "/repo");

    expect(log.mock.calls.map(([line]) => stripAnsi(String(line)))).toEqual([
      "✕ 执行失败",
      "  error 请指定平台",
    ]);
    expect(process.exitCode).toBe(1);

    log.mockRestore();
  });

  test("core 已记录的错误不重复输出", async () => {
    /** console.log mock */
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const { markErrorLogged } = await import("uni-mini-ci-core");
    /** 已记录错误 */
    const error = markErrorLogged(new Error("preview failed"));
    runMiniCIMock.mockRejectedValueOnce(error);
    const { main } = await import("../src/cli");

    await main(["--preview", "--platform", "mp-weixin"], "/repo");

    expect(log).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);

    log.mockRestore();
  });
});
