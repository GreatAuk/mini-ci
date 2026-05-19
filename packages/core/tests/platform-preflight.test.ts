import { describe, expect, test, vi } from "vitest";
import { WeappCI } from "../src/ci/WeappCI";
import { AlipayCI } from "../src/ci/AlipayCI";
import { JdCI } from "../src/ci/JdCI";
import { SwanCI } from "../src/ci/SwanCI";
import { TTCI } from "../src/ci/TTCI";

vi.mock("../src/utils/npm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/utils/npm")>();
  return {
    ...actual,
    resolveNpmSync: (pluginName: string) => {
      throw new Error(`Cannot find module '${pluginName}'`);
    },
    getNpmPkgSync: (pluginName: string) => {
      throw new Error(`Cannot find module '${pluginName}'`);
    },
  };
});

describe("WeappCI", () => {
  test("私钥路径不存在时抛出错误", async () => {
    const ci = new WeappCI({
      operation: "upload",
      platform: "mp-weixin",
      cwd: process.cwd(),
      projectPath: process.cwd(),
      version: "1.0.0",
      desc: "测试描述",
      packageJson: {},
      platformConfig: {
        appid: "wx-appid",
        privateKeyPath: "missing-private-key.key",
      },
    });

    await expect(ci.init()).rejects.toThrow("mp-weixin");
  });
});

describe("AlipayCI", () => {
  test("私钥路径不存在时抛出错误", async () => {
    const ci = new AlipayCI({
      operation: "upload",
      platform: "mp-alipay",
      cwd: process.cwd(),
      projectPath: process.cwd(),
      version: "1.0.0",
      desc: "测试描述",
      packageJson: {},
      platformConfig: {
        appid: "ali-appid",
        toolId: "tool-id",
        privateKeyPath: "missing-private-key.pem",
      },
    });

    await expect(ci.init()).rejects.toThrow("mp-alipay");
  });
});

describe("JdCI", () => {
  test("缺少 SDK 依赖时提示安装", async () => {
    const ci = new JdCI({
      operation: "upload",
      platform: "mp-jd",
      cwd: process.cwd(),
      projectPath: process.cwd(),
      version: "1.0.0",
      desc: "测试描述",
      packageJson: {},
      platformConfig: {
        privateKey: "jd-private-key",
      },
    });

    await expect(ci.init()).rejects.toThrow("jd-miniprogram-ci");
  });
});

describe("SwanCI", () => {
  test("缺少 SDK 依赖时提示安装", async () => {
    const ci = new SwanCI({
      operation: "upload",
      platform: "mp-baidu",
      cwd: process.cwd(),
      projectPath: process.cwd(),
      version: "1.0.0",
      desc: "测试描述",
      packageJson: {},
      platformConfig: {
        token: "swan-token",
      },
    });

    await expect(ci.init()).rejects.toThrow("swan-toolkit");
  });
});

describe("TTCI", () => {
  test("缺少 SDK 依赖时提示安装", async () => {
    const ci = new TTCI({
      operation: "upload",
      platform: "mp-toutiao",
      cwd: process.cwd(),
      projectPath: process.cwd(),
      version: "1.0.0",
      desc: "测试描述",
      packageJson: {},
      platformConfig: {
        email: "user@example.com",
        password: "password",
      },
    });

    await expect(ci.init()).rejects.toThrow("需要安装依赖：tt-ide-cli");
  });
});
