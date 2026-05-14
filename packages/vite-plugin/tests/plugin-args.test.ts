import { describe, expect, test } from "vitest";
import { parsePluginArgs } from "../src/parsePluginArgs";

describe("parsePluginArgs", () => {
  test("没有透传分隔符时跳过", () => {
    expect(parsePluginArgs(["uni", "build", "-p", "mp-weixin"])).toEqual({ operations: [] });
  });

  test("透传分隔符后没有操作时跳过", () => {
    expect(parsePluginArgs(["uni", "build", "-p", "mp-weixin", "--"])).toEqual({
      operations: [],
    });
  });

  test("解析 upload 操作", () => {
    expect(parsePluginArgs(["uni", "build", "-p", "mp-weixin", "--", "--upload"])).toEqual({
      operations: ["upload"],
    });
  });

  test("解析 open 操作", () => {
    expect(parsePluginArgs(["uni", "dev", "-p", "mp-weixin", "--", "--open"])).toEqual({
      operations: ["open"],
    });
  });

  test("解析 preview 操作", () => {
    expect(parsePluginArgs(["uni", "build", "-p", "mp-weixin", "--", "--preview"])).toEqual({
      operations: ["preview"],
    });
  });

  test("同时传入多个操作时按固定顺序解析", () => {
    expect(
      parsePluginArgs(["uni", "build", "-p", "mp-weixin", "--", "--open", "--upload"]),
    ).toEqual({
      operations: ["open", "upload"],
    });
  });

  test("多个操作参数的解析顺序不受传参顺序影响", () => {
    expect(
      parsePluginArgs(["uni", "build", "-p", "mp-weixin", "--", "--upload", "--open"]),
    ).toEqual({
      operations: ["open", "upload"],
    });
  });

  test("未知参数时报错", () => {
    expect(() =>
      parsePluginArgs(["uni", "build", "-p", "mp-weixin", "--", "--upload", "--version", "1.0.0"]),
    ).toThrow("Vite 插件模式暂不支持参数：--version");
  });
});
