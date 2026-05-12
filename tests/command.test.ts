import { describe, expect, test } from "vitest";
import { parseCliArgs } from "../src/command/parseArgs";

describe("parseCliArgs", () => {
  test("解析 --upload 的平台和项目产物目录", () => {
    expect(
      parseCliArgs([
        "--upload",
        "--platform",
        "mp-weixin",
        "--projectPath",
        "dist/build/mp-weixin",
      ]),
    ).toEqual({
      operation: "upload",
      platform: "mp-weixin",
      projectPath: "dist/build/mp-weixin",
    });
  });

  test("解析 --preview 的版本和发布描述", () => {
    expect(
      parseCliArgs([
        "--preview",
        "--platform",
        "mp-alipay",
        "--version",
        "1.2.3",
        "--desc",
        "灰度发布",
      ]),
    ).toEqual({
      operation: "preview",
      platform: "mp-alipay",
      version: "1.2.3",
      desc: "灰度发布",
    });
  });

  test("缺少操作参数时抛出明确错误", () => {
    expect(() => parseCliArgs(["--platform", "mp-weixin"])).toThrow("请指定操作");
  });

  test("缺少 platform 时抛出明确错误", () => {
    expect(() => parseCliArgs(["--upload"])).toThrow("请指定平台");
  });

  test("platform 缺少值时抛出明确错误", () => {
    expect(() => parseCliArgs(["--upload", "--platform"])).toThrow("--platform 需要提供字符串值");
  });

  test("不支持的平台会抛出明确错误，包含可选值", () => {
    expect(() => parseCliArgs(["--upload", "--platform", "mp-qq"])).toThrow("暂不支持平台：mp-qq");
  });

  test("旧位置参数会抛出明确错误", () => {
    expect(() => parseCliArgs(["open", "--platform", "mp-weixin"])).toThrow(
      "暂不支持位置参数：open",
    );
  });

  test("同时传入多个操作参数会抛出明确错误", () => {
    expect(() => parseCliArgs(["--open", "--upload", "--platform", "mp-weixin"])).toThrow(
      "只能指定一个操作",
    );
  });

  test("未知参数会抛出明确错误", () => {
    expect(() => parseCliArgs(["--upload", "--platform", "mp-weixin", "--unknown", "x"])).toThrow(
      "暂不支持参数：--unknown",
    );
  });

  test("额外位置参数会抛出明确错误", () => {
    expect(() => parseCliArgs(["--upload", "extra", "--platform", "mp-weixin"])).toThrow(
      "暂不支持位置参数：extra",
    );
  });

  test("字符串选项缺少值时抛出明确错误", () => {
    expect(() => parseCliArgs(["--upload", "--platform", "mp-weixin", "--desc"])).toThrow(
      "--desc 需要提供字符串值",
    );
  });

  test("--help 标记不被当作未知参数", () => {
    // help 在 CLI 入口层处理，parser 层不应报错
    // 此处验证 allowedOptionNames 包含 help
    expect(() => parseCliArgs(["--upload", "--platform", "mp-weixin", "--help"])).not.toThrow(
      "暂不支持参数",
    );
  });

  test("解析所有可选参数", () => {
    expect(
      parseCliArgs([
        "--upload",
        "--platform",
        "mp-baidu",
        "--projectPath",
        "dist/mp-baidu",
        "--version",
        "3.0.0",
        "--desc",
        "全量发布",
        "--config",
        "custom.config.ts",
        "--cwd",
        "/workspace",
      ]),
    ).toEqual({
      operation: "upload",
      platform: "mp-baidu",
      projectPath: "dist/mp-baidu",
      version: "3.0.0",
      desc: "全量发布",
      config: "custom.config.ts",
      cwd: "/workspace",
    });
  });

  test("解析 --open 操作", () => {
    expect(parseCliArgs(["--open", "--platform", "mp-toutiao"])).toEqual({
      operation: "open",
      platform: "mp-toutiao",
    });
  });
});
