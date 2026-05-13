import { describe, expect, test } from "vitest";
import { parsePluginArgs } from "../src/plugin/parsePluginArgs";

describe("parsePluginArgs", () => {
  test("没有透传分隔符时跳过", () => {
    expect(parsePluginArgs(["uni", "build", "-p", "mp-weixin"])).toEqual({ operation: undefined });
  });

  test("透传分隔符后没有操作时跳过", () => {
    expect(parsePluginArgs(["uni", "build", "-p", "mp-weixin", "--"])).toEqual({
      operation: undefined,
    });
  });

  test("解析 upload 操作", () => {
    expect(parsePluginArgs(["uni", "build", "-p", "mp-weixin", "--", "--upload"])).toEqual({
      operation: "upload",
    });
  });

  test("解析 open 操作", () => {
    expect(parsePluginArgs(["uni", "dev", "-p", "mp-weixin", "--", "--open"])).toEqual({
      operation: "open",
    });
  });

  test("解析 preview 操作", () => {
    expect(parsePluginArgs(["uni", "build", "-p", "mp-weixin", "--", "--preview"])).toEqual({
      operation: "preview",
    });
  });

  test("同时传入多个操作时报错", () => {
    expect(() =>
      parsePluginArgs(["uni", "build", "-p", "mp-weixin", "--", "--open", "--upload"]),
    ).toThrow("只能指定一个操作");
  });

  test("未知参数时报错", () => {
    expect(() =>
      parsePluginArgs(["uni", "build", "-p", "mp-weixin", "--", "--upload", "--version", "1.0.0"]),
    ).toThrow("Vite 插件模式暂不支持参数：--version");
  });
});
