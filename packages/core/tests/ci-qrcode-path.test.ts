import { describe, expect, it, vi } from "vitest";
import { WeappCI } from "../src/ci/WeappCI";
import { AlipayCI } from "../src/ci/AlipayCI";

import type { NormalizedMiniCIConfig } from "../src/types";

/** mock 二维码工具，避免真实文件 IO */
vi.mock("../src/utils/qrcode", () => ({
  readQrcodeImageContent: vi.fn().mockResolvedValue("mock-qr-content"),
  printQrcode2Terminal: vi.fn().mockResolvedValue(undefined),
  generateQrcodeImageFile: vi.fn().mockResolvedValue(undefined),
}));

/**
 * 创建微信平台测试配置。
 *
 * @param qrcodePath 二维码图片保存路径配置
 * @returns 归一化后的微信平台配置
 */
function makeWeappConfig(
  qrcodePath?: NormalizedMiniCIConfig["qrcodePath"],
): NormalizedMiniCIConfig<"mp-weixin"> {
  return {
    operation: "preview",
    platform: "mp-weixin",
    cwd: "/cwd",
    projectPath: "/project",
    version: "1.0.0",
    desc: "test",
    packageJson: {},
    platformConfig: {
      appid: "wx-appid",
      privateKeyPath: "/key.pem",
    },
    qrcodePath,
  };
}

/**
 * 创建支付宝平台测试配置。
 *
 * @param qrcodePath 二维码图片保存路径配置
 * @returns 归一化后的支付宝平台配置
 */
function makeAlipayConfig(
  qrcodePath?: NormalizedMiniCIConfig["qrcodePath"],
): NormalizedMiniCIConfig<"mp-alipay"> {
  return {
    operation: "preview",
    platform: "mp-alipay",
    cwd: "/cwd",
    projectPath: "/project",
    version: "1.0.0",
    desc: "test",
    packageJson: {},
    platformConfig: {
      appid: "ali-appid",
      toolId: "tool-id",
      privateKey: "private-key",
    },
    qrcodePath,
  };
}

describe("WeappCI - qrcodePath 路径选取", () => {
  it("preview() 未配置 qrcodePath 时使用默认路径 projectPath/preview.jpg", async () => {
    const ci = new WeappCI(makeWeappConfig());
    (ci as any).ci = {
      preview: vi.fn().mockResolvedValue({}),
    };
    (ci as any).instance = {};

    const result = await ci.preview();

    expect(result.qrCodeLocalPath).toBe("/project/preview.jpg");
  });

  it("preview() 配置 qrcodePath.preview 时使用自定义路径", async () => {
    const ci = new WeappCI(makeWeappConfig({ preview: "/custom/preview.png" }));
    (ci as any).ci = {
      preview: vi.fn().mockResolvedValue({}),
    };
    (ci as any).instance = {};

    const result = await ci.preview();

    expect(result.qrCodeLocalPath).toBe("/custom/preview.png");
  });

  it("upload() 未配置 qrcodePath 时使用默认路径 projectPath/upload.png", async () => {
    const ci = new WeappCI(makeWeappConfig());
    (ci as any).ci = {
      upload: vi.fn().mockResolvedValue({}),
    };
    (ci as any).instance = {};

    const result = await ci.upload();

    expect(result.qrCodeLocalPath).toBe("/project/upload.png");
  });

  it("upload() 配置 qrcodePath.upload 时使用自定义路径", async () => {
    const ci = new WeappCI(makeWeappConfig({ upload: "/custom/upload.png" }));
    (ci as any).ci = {
      upload: vi.fn().mockResolvedValue({}),
    };
    (ci as any).instance = {};

    const result = await ci.upload();

    expect(result.qrCodeLocalPath).toBe("/custom/upload.png");
  });
});

describe("AlipayCI - qrcodePath 路径选取", () => {
  it("preview() 未配置 qrcodePath 时使用默认路径 projectPath/preview.png", async () => {
    const ci = new AlipayCI(makeAlipayConfig());
    (ci as any).minidev = {
      minidev: {
        preview: vi.fn().mockResolvedValue({ qrcodeUrl: "https://qr.example.com/code.png" }),
      },
    };

    const result = await ci.preview();

    expect(result.qrCodeLocalPath).toBe("/project/preview.png");
  });

  it("preview() 配置 qrcodePath.preview 时使用自定义路径", async () => {
    const ci = new AlipayCI(makeAlipayConfig({ preview: "/custom/alipay-preview.png" }));
    (ci as any).minidev = {
      minidev: {
        preview: vi.fn().mockResolvedValue({ qrcodeUrl: "https://qr.example.com/code.png" }),
      },
    };

    const result = await ci.preview();

    expect(result.qrCodeLocalPath).toBe("/custom/alipay-preview.png");
  });
});
