import { describe, expect, test, vi } from "vitest";
import { BaseCI } from "../src/ci/BaseCI";
import { JdCI } from "../src/ci/JdCI";

import type { NormalizedMiniCIConfig } from "../src/types";

/** 用于测试的假 CI 类 */
class FakeCI extends BaseCI<"mp-weixin"> {
  init(): void {}

  async open() {
    return this.createResult(true);
  }

  async preview() {
    return this.createResult(true, {
      qrCodeContent: "preview-content",
      qrCodeLocalPath: "/repo/preview.png",
    });
  }

  async upload() {
    return this.createResult(true, {
      qrCodeContent: "upload-content",
      qrCodeLocalPath: "/repo/upload.png",
    });
  }
}

/**
 * 创建测试用的微信归一化配置。
 *
 * @returns 微信平台归一化配置
 */
function createConfig(): NormalizedMiniCIConfig<"mp-weixin"> {
  return {
    operation: "upload",
    platform: "mp-weixin",
    cwd: "/repo",
    projectPath: "/repo/dist/build/mp-weixin",
    version: "1.0.0",
    desc: "测试描述",
    packageJson: {},
    platformConfig: {
      appid: "wx-appid",
      privateKeyPath: "key/private.key",
    },
  };
}

describe("BaseCI", () => {
  test("createResult 包含共享元数据", async () => {
    const ci = new FakeCI(createConfig());
    const result = await ci.upload();

    expect(result).toMatchObject({
      success: true,
      operation: "upload",
      platform: "mp-weixin",
      version: "1.0.0",
      desc: "测试描述",
      projectPath: "/repo/dist/build/mp-weixin",
      qrCodeContent: "upload-content",
      qrCodeLocalPath: "/repo/upload.png",
    });
  });

  test("preview 结果包含二维码信息", async () => {
    const ci = new FakeCI(createConfig());
    const result = await ci.preview();

    expect(result.qrCodeContent).toBe("preview-content");
    expect(result.qrCodeLocalPath).toBe("/repo/preview.png");
  });

  test("open 结果不包含二维码信息", async () => {
    const ci = new FakeCI(createConfig());
    const result = await ci.open();

    expect(result.success).toBe(true);
    expect(result.qrCodeContent).toBeUndefined();
  });
});

/**
 * 创建测试用的京东归一化配置。
 *
 * @returns 京东平台归一化配置
 */
function createJdConfig(): NormalizedMiniCIConfig<"mp-jd"> {
  return {
    operation: "open",
    platform: "mp-jd",
    cwd: "/repo",
    projectPath: "/repo/dist/build/mp-jd",
    version: "1.0.0",
    desc: "测试描述",
    packageJson: {},
    platformConfig: {
      privateKey: "jd-private-key",
    },
  };
}

test("JdCI open 使用 logger 输出不支持警告", async () => {
  /** console.log mock */
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  /** console.warn mock */
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  /** 京东 CI 实例 */
  const ci = new JdCI(createJdConfig());

  await ci.open();

  expect(log.mock.calls.map(([line]) => String(line).replace(/\u001b\[[0-9;]*m/g, ""))).toContain(
    "  ! 京东小程序不支持 open 操作",
  );
  expect(warn).not.toHaveBeenCalled();

  log.mockRestore();
  warn.mockRestore();
});
