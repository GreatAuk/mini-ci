import { stripVTControlCharacters } from "node:util";
import { describe, expect, it, vi } from "vitest";
import { WeappCI } from "../src/ci/WeappCI";
import { AlipayCI } from "../src/ci/AlipayCI";
import { SwanCI } from "../src/ci/SwanCI";
import { TTCI } from "../src/ci/TTCI";
import { JdCI } from "../src/ci/JdCI";
import { generateQrcodeImageFile } from "../src/utils/qrcode";

import type { NormalizedMiniCIConfig } from "../src/types";

/** mock 二维码工具，避免真实文件 IO */
vi.mock("../src/utils/qrcode", () => ({
  readQrcodeImageContent: vi.fn().mockResolvedValue("mock-qr-content"),
  printQrcode2Terminal: vi.fn().mockResolvedValue(undefined),
  generateQrcodeImageFile: vi.fn().mockResolvedValue(undefined),
}));

/** mock shelljs，避免真实命令行调用 */
vi.mock("shelljs", () => ({
  default: {
    exec: vi.fn(),
  },
}));

/**
 * 微信上传成功后的下一步操作提示。
 */
const weappUploadNextStepLines = [
  "下一步操作:",
  "1. 登录微信公众平台: https://mp.weixin.qq.com",
  '2. 进入 "管理 -> 版本管理"',
  '3. 在 "开发版本" 中找到刚上传的版本',
  '4. 点击 "选为体验版" 按钮',
];

/**
 * 读取去除颜色和提醒前缀后的日志行。
 *
 * @param log console.log mock
 * @returns 标准化后的日志行
 */
function getStrippedLogLines(log: {
  mock: { calls: ReadonlyArray<readonly unknown[]> };
}): string[] {
  return log.mock.calls.map(([line]) => {
    /** 去色后的单行日志 */
    const strippedLine = stripVTControlCharacters(String(line)).trim();
    return strippedLine.startsWith("i ") ? strippedLine.slice(2) : strippedLine;
  });
}

/**
 * 断言微信上传下一步操作提示块按顺序输出。
 *
 * @param logLines 去色后的日志行
 */
function expectWeappUploadNextStepLines(logLines: string[]): void {
  /** 提示块起始索引 */
  const startIndex = logLines.findIndex((line) => line === weappUploadNextStepLines[0]);

  expect(startIndex).toBeGreaterThanOrEqual(0);

  /** 实际提示块日志行 */
  const actualLines = logLines.slice(startIndex, startIndex + weappUploadNextStepLines.length);

  expect(actualLines).toEqual(weappUploadNextStepLines);
}

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

  it("upload() 成功后打印微信公众平台下一步操作提示", async () => {
    /** console.log mock */
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    /** 微信 CI 实例 */
    const ci = new WeappCI(makeWeappConfig());
    (ci as any).ci = {
      upload: vi.fn().mockResolvedValue({}),
    };
    (ci as any).instance = {};

    try {
      await ci.upload();

      /** 去色后的日志行 */
      const outputLines = getStrippedLogLines(log);

      expectWeappUploadNextStepLines(outputLines);
    } finally {
      log.mockRestore();
    }
  });

  it("upload() 体验版二维码生成失败但上传成功时仍打印微信公众平台下一步操作提示", async () => {
    /** console.log mock */
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    /** 生成二维码图片 mock */
    const generateQrcodeImageFileMock = vi.mocked(generateQrcodeImageFile);
    /** 微信 CI 实例 */
    const ci = new WeappCI(makeWeappConfig());
    (ci as any).ci = {
      upload: vi.fn().mockResolvedValue({}),
    };
    (ci as any).instance = {};

    generateQrcodeImageFileMock.mockRejectedValueOnce(new Error("qrcode failed"));

    try {
      /** 上传结果 */
      const result = await ci.upload();
      /** 去色后的日志行 */
      const outputLines = getStrippedLogLines(log);

      expect(result.success).toBe(true);
      expect(result.qrCodeLocalPath).toBe("/project/upload.png");
      expectWeappUploadNextStepLines(outputLines);
    } finally {
      log.mockRestore();
    }
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

  it("upload() 未配置 qrcodePath 时使用默认路径 projectPath/upload.png", async () => {
    const ci = new AlipayCI(makeAlipayConfig());
    (ci as any).minidev = {
      minidev: {
        app: { getUploadedVersion: vi.fn().mockResolvedValue("0.9.0") },
        upload: vi
          .fn()
          .mockResolvedValue({ experienceQrCodeUrl: "https://qr.example.com/exp.png" }),
      },
    };

    const result = await ci.upload();

    expect(result.qrCodeLocalPath).toBe("/project/upload.png");
  });

  it("upload() 配置 qrcodePath.upload 时使用自定义路径", async () => {
    const ci = new AlipayCI(makeAlipayConfig({ upload: "/custom/alipay-upload.png" }));
    (ci as any).minidev = {
      minidev: {
        app: { getUploadedVersion: vi.fn().mockResolvedValue("0.9.0") },
        upload: vi
          .fn()
          .mockResolvedValue({ experienceQrCodeUrl: "https://qr.example.com/exp.png" }),
      },
    };

    const result = await ci.upload();

    expect(result.qrCodeLocalPath).toBe("/custom/alipay-upload.png");
  });
});

/**
 * 创建百度平台测试配置。
 *
 * @param qrcodePath 二维码图片保存路径配置
 * @returns 归一化后的百度平台配置
 */
function makeSwanConfig(
  qrcodePath?: NormalizedMiniCIConfig["qrcodePath"],
): NormalizedMiniCIConfig<"mp-baidu"> {
  return {
    operation: "preview",
    platform: "mp-baidu",
    cwd: "/cwd",
    projectPath: "/project",
    version: "1.0.0",
    desc: "test",
    packageJson: {},
    platformConfig: {
      token: "swan-token",
    },
    qrcodePath,
  };
}

/**
 * 创建字节平台测试配置。
 *
 * @param qrcodePath 二维码图片保存路径配置
 * @returns 归一化后的字节平台配置
 */
function makeTTConfig(
  qrcodePath?: NormalizedMiniCIConfig["qrcodePath"],
): NormalizedMiniCIConfig<"mp-toutiao"> {
  return {
    operation: "preview",
    platform: "mp-toutiao",
    cwd: "/cwd",
    projectPath: "/project",
    version: "1.0.0",
    desc: "test",
    packageJson: {},
    platformConfig: {
      email: "test@example.com",
      password: "test-password",
    },
    qrcodePath,
  };
}

/**
 * 创建京东平台测试配置。
 *
 * @param qrcodePath 二维码图片保存路径配置
 * @returns 归一化后的京东平台配置
 */
function makeJdConfig(
  qrcodePath?: NormalizedMiniCIConfig["qrcodePath"],
): NormalizedMiniCIConfig<"mp-jd"> {
  return {
    operation: "preview",
    platform: "mp-jd",
    cwd: "/cwd",
    projectPath: "/project",
    version: "1.0.0",
    desc: "test",
    packageJson: {},
    platformConfig: {
      privateKey: "jd-private-key",
    },
    qrcodePath,
  };
}

describe("SwanCI - qrcodePath 路径选取", () => {
  it("preview() 未配置 qrcodePath 时使用默认路径 projectPath/preview.png", async () => {
    const shell = await import("shelljs");
    vi.mocked(shell.default.exec as any).mockImplementation((_cmd: string, cb: Function) => {
      cb(0, JSON.stringify({ list: [{ url: "mock-swan-url" }] }), null);
    });

    const ci = new SwanCI(makeSwanConfig());
    (ci as any).swanBin = "/mock/swan";

    const result = await ci.preview();

    expect(result.qrCodeLocalPath).toBe("/project/preview.png");
  });

  it("preview() 配置 qrcodePath.preview 时使用自定义路径", async () => {
    const shell = await import("shelljs");
    vi.mocked(shell.default.exec as any).mockImplementation((_cmd: string, cb: Function) => {
      cb(0, JSON.stringify({ list: [{ url: "mock-swan-url" }] }), null);
    });

    const ci = new SwanCI(makeSwanConfig({ preview: "/custom/swan-preview.png" }));
    (ci as any).swanBin = "/mock/swan";

    const result = await ci.preview();

    expect(result.qrCodeLocalPath).toBe("/custom/swan-preview.png");
  });

  it("upload() 未配置 qrcodePath 时使用默认路径 projectPath/upload.png", async () => {
    const shell = await import("shelljs");
    vi.mocked(shell.default.exec as any).mockImplementation((_cmd: string, cb: Function) => {
      cb(0, JSON.stringify({ schemeUrl: "mock-swan-scheme" }), null);
    });

    const ci = new SwanCI(makeSwanConfig());
    (ci as any).swanBin = "/mock/swan";

    const result = await ci.upload();

    expect(result.qrCodeLocalPath).toBe("/project/upload.png");
  });

  it("upload() 配置 qrcodePath.upload 时使用自定义路径", async () => {
    const shell = await import("shelljs");
    vi.mocked(shell.default.exec as any).mockImplementation((_cmd: string, cb: Function) => {
      cb(0, JSON.stringify({ schemeUrl: "mock-swan-scheme" }), null);
    });

    const ci = new SwanCI(makeSwanConfig({ upload: "/custom/swan-upload.png" }));
    (ci as any).swanBin = "/mock/swan";

    const result = await ci.upload();

    expect(result.qrCodeLocalPath).toBe("/custom/swan-upload.png");
  });
});

describe("TTCI - qrcodePath 路径选取", () => {
  it("preview() 未配置 qrcodePath 时使用默认路径 projectPath/preview.png", async () => {
    const ci = new TTCI(makeTTConfig());
    (ci as any).tt = {
      loginByEmail: vi.fn().mockResolvedValue(undefined),
      preview: vi.fn().mockResolvedValue({ shortUrl: "mock-tt-url", expireTime: 9999999999 }),
    };

    const result = await ci.preview();

    expect(result.qrCodeLocalPath).toBe("/project/preview.png");
  });

  it("preview() 配置 qrcodePath.preview 时使用自定义路径", async () => {
    const ci = new TTCI(makeTTConfig({ preview: "/custom/tt-preview.png" }));
    (ci as any).tt = {
      loginByEmail: vi.fn().mockResolvedValue(undefined),
      preview: vi.fn().mockResolvedValue({ shortUrl: "mock-tt-url", expireTime: 9999999999 }),
    };

    const result = await ci.preview();

    expect(result.qrCodeLocalPath).toBe("/custom/tt-preview.png");
  });

  it("upload() 未配置 qrcodePath 时使用默认路径 projectPath/upload.png", async () => {
    const ci = new TTCI(makeTTConfig());
    (ci as any).tt = {
      loginByEmail: vi.fn().mockResolvedValue(undefined),
      upload: vi.fn().mockResolvedValue({ shortUrl: "mock-tt-upload-url", expireTime: 9999999999 }),
    };

    const result = await ci.upload();

    expect(result.qrCodeLocalPath).toBe("/project/upload.png");
  });

  it("upload() 配置 qrcodePath.upload 时使用自定义路径", async () => {
    const ci = new TTCI(makeTTConfig({ upload: "/custom/tt-upload.png" }));
    (ci as any).tt = {
      loginByEmail: vi.fn().mockResolvedValue(undefined),
      upload: vi.fn().mockResolvedValue({ shortUrl: "mock-tt-upload-url", expireTime: 9999999999 }),
    };

    const result = await ci.upload();

    expect(result.qrCodeLocalPath).toBe("/custom/tt-upload.png");
  });
});

describe("JdCI - qrcodePath 路径选取", () => {
  it("preview() 未配置 qrcodePath 时使用默认路径 projectPath/preview.jpg", async () => {
    const ci = new JdCI(makeJdConfig());
    (ci as any).jdCi = {
      preview: vi.fn().mockResolvedValue({ imgUrl: "https://qr.example.com/jd.jpg" }),
    };

    const result = await ci.preview();

    expect(result.qrCodeLocalPath).toBe("/project/preview.jpg");
  });

  it("preview() 配置 qrcodePath.preview 时使用自定义路径", async () => {
    const ci = new JdCI(makeJdConfig({ preview: "/custom/jd-preview.jpg" }));
    (ci as any).jdCi = {
      preview: vi.fn().mockResolvedValue({ imgUrl: "https://qr.example.com/jd.jpg" }),
    };

    const result = await ci.preview();

    expect(result.qrCodeLocalPath).toBe("/custom/jd-preview.jpg");
  });

  it("upload() 未配置 qrcodePath 时使用默认路径 projectPath/upload.jpg", async () => {
    const ci = new JdCI(makeJdConfig());
    (ci as any).jdCi = {
      upload: vi.fn().mockResolvedValue({ imgUrl: "https://qr.example.com/jd-upload.jpg" }),
    };

    const result = await ci.upload();

    expect(result.qrCodeLocalPath).toBe("/project/upload.jpg");
  });

  it("upload() 配置 qrcodePath.upload 时使用自定义路径", async () => {
    const ci = new JdCI(makeJdConfig({ upload: "/custom/jd-upload.jpg" }));
    (ci as any).jdCi = {
      upload: vi.fn().mockResolvedValue({ imgUrl: "https://qr.example.com/jd-upload.jpg" }),
    };

    const result = await ci.upload();

    expect(result.qrCodeLocalPath).toBe("/custom/jd-upload.jpg");
  });
});
