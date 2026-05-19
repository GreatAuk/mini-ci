import path from "node:path";
import { describe, expect, expectTypeOf, test } from "vitest";
import { normalizeConfig } from "../src/config/normalize";
import { validateConfig, validatePlatformConfig } from "../src/config/schema";

describe("config schema", () => {
  test("微信平台缺少 privateKeyPath 时抛出包含字段路径的错误", () => {
    expect(() =>
      validatePlatformConfig("mp-weixin", {
        "mp-weixin": {
          appid: "wx-appid",
        },
      }),
    ).toThrow(/mp-weixin\.privateKeyPath/);
  });

  test("支付宝平台缺少 privateKeyPath 或 privateKey 时抛出包含字段路径的错误", () => {
    expect(() =>
      validatePlatformConfig("mp-alipay", {
        "mp-alipay": {
          appid: "ali-appid",
          toolId: "tool-id",
        },
      }),
    ).toThrow(/mp-alipay\.privateKeyPath/);
  });

  test("缺少当前平台配置时抛出明确错误", () => {
    expect(() => validatePlatformConfig("mp-jd", {})).toThrow("mp-jd 平台配置不能为空");
  });

  test("空字符串配置会被拒绝", () => {
    expect(() =>
      validatePlatformConfig("mp-baidu", {
        "mp-baidu": {
          token: "",
        },
      }),
    ).toThrow(/mp-baidu\.token/);
  });

  test("支付宝 deleteVersion 非法格式会被拒绝", () => {
    expect(() =>
      validatePlatformConfig("mp-alipay", {
        "mp-alipay": {
          appid: "ali-appid",
          toolId: "tool-id",
          privateKey: "private-key",
          deleteVersion: "foo",
        },
      }),
    ).toThrow(/mp-alipay\.deleteVersion/);
  });

  test("未知字段会被拒绝", () => {
    expect(() =>
      validateConfig({
        "mp-wechat": {
          appid: "wx-appid",
        },
      }),
    ).toThrow(/mp-wechat/);
  });

  test("非法 desc 类型会被拒绝", () => {
    expect(() =>
      validateConfig({
        desc: 123,
      }),
    ).toThrow(/desc/);
  });

  test("hooks 字段接受函数配置", () => {
    /** preview 完成 hook */
    const onPreviewComplete = async () => {};
    /** upload 完成 hook */
    const onUploadComplete = async () => {};
    /** 错误 hook */
    const onError = async () => {};

    expect(
      validateConfig({
        hooks: {
          onPreviewComplete,
          onUploadComplete,
          onError,
        },
      }),
    ).toEqual({
      hooks: {
        onPreviewComplete,
        onUploadComplete,
        onError,
      },
    });
  });

  test("hooks 字段为非函数时会被拒绝", () => {
    expect(() =>
      validateConfig({
        hooks: {
          onPreviewComplete: "not-a-function",
        },
      }),
    ).toThrow(/hooks\.onPreviewComplete/);
  });

  test("hooks 未知字段会被拒绝", () => {
    expect(() =>
      validateConfig({
        hooks: {
          onAfterBuild: () => {},
        },
      }),
    ).toThrow(/hooks\.onAfterBuild/);
  });

  test("bumpOptions 接受普通对象配置", () => {
    expect(
      validateConfig({
        bumpOptions: {
          release: "patch",
          commit: false,
          tag: false,
          push: false,
          confirm: false,
        },
      }),
    ).toEqual({
      bumpOptions: {
        release: "patch",
        commit: false,
        tag: false,
        push: false,
        confirm: false,
      },
    });
  });

  test("bumpOptions 字段为非对象非函数时会被拒绝", () => {
    expect(() =>
      validateConfig({
        bumpOptions: "patch",
      }),
    ).toThrow(/bumpOptions/);
  });

  test("bumpOptions 保留函数字段", () => {
    /** bumpp progress 回调 */
    const progress = () => {};
    /** bumpp execute 回调 */
    const execute = () => {};

    expect(
      validateConfig({
        bumpOptions: {
          progress,
          execute,
        },
      }),
    ).toEqual({
      bumpOptions: {
        progress,
        execute,
      },
    });
  });

  test("bumpOptions 支持函数形式", () => {
    const bumpOptionsFn = (ctx: { cwd: string; platform: string; operations: string[] }) => ({
      release: "patch" as const,
      files: [`${ctx.cwd}/package.json`],
    });

    const result = validateConfig({ bumpOptions: bumpOptionsFn });
    expect(result.bumpOptions).toBe(bumpOptionsFn);
  });
});

describe("normalizeConfig", () => {
  test("命令行 version、desc、projectPath 优先于配置和 packageJson，并解析相对 projectPath", async () => {
    /** 当前工作目录 */
    const cwd = "/workspace/project";

    await expect(
      normalizeConfig({
        cwd,
        args: {
          operation: "upload",
          platform: "mp-weixin",
          version: "2.0.0",
          desc: "命令行描述",
          projectPath: "dist/custom",
        },
        config: {
          version: "1.0.0",
          desc: "配置描述",
          projectPath: "dist/config",
          "mp-weixin": {
            appid: "wx-appid",
            privateKeyPath: "keys/private.key",
          },
        },
        packageJson: {
          version: "0.1.0",
          description: "包描述",
        },
      }),
    ).resolves.toMatchObject({
      version: "2.0.0",
      desc: "命令行描述",
      projectPath: path.join(cwd, "dist/custom"),
    });
  });

  test("支持异步 desc 函数，并在上下文归一化后执行", async () => {
    /** 当前工作目录 */
    const cwd = "/workspace/project";

    /** 归一化后的配置 */
    const normalized = await normalizeConfig({
      cwd,
      args: {
        operation: "upload",
        platform: "mp-weixin",
        version: "2.0.0",
        projectPath: "dist/custom",
      },
      config: {
        desc: async ({
          operation,
          platform,
          version,
          projectPath,
          cwd: contextCwd,
          packageJson,
        }) => {
          expectTypeOf(packageJson).toEqualTypeOf<Record<string, unknown>>();
          return `${operation}|${platform}|${version}|${projectPath}|${contextCwd}|${packageJson.name}`;
        },
        "mp-weixin": {
          appid: "wx-appid",
          privateKeyPath: "keys/private.key",
        },
      },
      packageJson: {
        name: "demo-mini",
      },
    });

    expect(normalized.desc).toBe(
      `upload|mp-weixin|2.0.0|${path.join(cwd, "dist/custom")}|${cwd}|demo-mini`,
    );
  });

  test("非 upload 操作跳过 desc 函数调用", async () => {
    /** 归一化后的配置 */
    const normalized = await normalizeConfig({
      cwd: "/workspace/project",
      args: {
        operation: "preview",
        platform: "mp-weixin",
        version: "1.0.0",
      },
      config: {
        desc: async () => {
          throw new Error("不应在 preview 操作中被调用");
        },
        "mp-weixin": {
          appid: "wx-appid",
          privateKeyPath: "keys/private.key",
        },
      },
      packageJson: {
        description: "包描述",
      },
    });

    expect(normalized.desc).toBe("包描述");
  });

  test("回退到 packageJson.version 和 packageJson.description", async () => {
    await expect(
      normalizeConfig({
        cwd: "/workspace/project",
        args: {
          operation: "upload",
          platform: "mp-weixin",
        },
        config: {
          "mp-weixin": {
            appid: "wx-appid",
            privateKeyPath: "keys/private.key",
          },
        },
        packageJson: {
          version: "3.1.4",
          description: "包描述",
        },
      }),
    ).resolves.toMatchObject({
      version: "3.1.4",
      desc: "包描述",
    });
  });

  test("支持同步 desc 函数", async () => {
    await expect(
      normalizeConfig({
        cwd: "/workspace/project",
        args: {
          operation: "upload",
          platform: "mp-weixin",
        },
        config: {
          version: "1.0.0",
          desc: ({ platform, version }) => `${platform}-${version}`,
          "mp-weixin": {
            appid: "wx-appid",
            privateKeyPath: "keys/private.key",
          },
        },
        packageJson: {},
      }),
    ).resolves.toMatchObject({
      desc: "mp-weixin-1.0.0",
    });
  });

  test("命令行 desc 覆盖配置中的函数 desc", async () => {
    await expect(
      normalizeConfig({
        cwd: "/workspace/project",
        args: {
          operation: "upload",
          platform: "mp-weixin",
          desc: "命令行描述",
        },
        config: {
          desc: () => "配置函数描述",
          "mp-weixin": {
            appid: "wx-appid",
            privateKeyPath: "keys/private.key",
          },
        },
        packageJson: {},
      }),
    ).resolves.toMatchObject({
      desc: "命令行描述",
    });
  });

  test("缺少 desc 来源时自动生成默认描述", async () => {
    /** 归一化后的配置 */
    const normalized = await normalizeConfig({
      cwd: "/workspace/project",
      args: {
        operation: "upload",
        platform: "mp-weixin",
      },
      config: {
        "mp-weixin": {
          appid: "wx-appid",
          privateKeyPath: "keys/private.key",
        },
      },
      packageJson: {},
    });

    expect(normalized.desc).toMatch(/^CI 自动构建于 /);
  });

  test("desc 函数返回非字符串时抛出明确错误", async () => {
    await expect(
      normalizeConfig({
        cwd: "/workspace/project",
        args: {
          operation: "upload",
          platform: "mp-weixin",
        },
        config: {
          desc: (() => undefined) as never,
          "mp-weixin": {
            appid: "wx-appid",
            privateKeyPath: "keys/private.key",
          },
        },
        packageJson: {},
      }),
    ).rejects.toThrow(/desc/);
  });

  test("当命令行和配置都没有 projectPath 时默认为 dist/build/<platform>", async () => {
    /** 当前工作目录 */
    const cwd = "/workspace/project";

    await expect(
      normalizeConfig({
        cwd,
        args: {
          operation: "upload",
          platform: "mp-weixin",
        },
        config: {
          "mp-weixin": {
            appid: "wx-appid",
            privateKeyPath: "keys/private.key",
          },
        },
        packageJson: {},
      }),
    ).resolves.toMatchObject({
      projectPath: path.join(cwd, "dist/build/mp-weixin"),
    });
  });

  test("传入 --dev 时默认 projectPath 为 dist/dev/<platform>", async () => {
    /** 当前工作目录 */
    const cwd = "/workspace/project";

    await expect(
      normalizeConfig({
        cwd,
        args: {
          operation: "open",
          platform: "mp-weixin",
          dev: true,
        },
        config: {
          "mp-weixin": {
            appid: "wx-appid",
            privateKeyPath: "keys/private.key",
          },
        },
        packageJson: {},
      }),
    ).resolves.toMatchObject({
      projectPath: path.join(cwd, "dist/dev/mp-weixin"),
    });
  });

  test("qrcodePath 相对路径被解析为相对于 cwd 的绝对路径", async () => {
    /** 当前工作目录 */
    const cwd = "/workspace/project";

    await expect(
      normalizeConfig({
        cwd,
        args: {
          operation: "preview",
          platform: "mp-weixin",
        },
        config: {
          qrcodePath: {
            preview: "./output/preview.png",
            upload: "./output/upload.png",
          },
          "mp-weixin": {
            appid: "wx-appid",
            privateKeyPath: "keys/private.key",
          },
        },
        packageJson: {},
      }),
    ).resolves.toMatchObject({
      qrcodePath: {
        preview: path.join(cwd, "output/preview.png"),
        upload: path.join(cwd, "output/upload.png"),
      },
    });
  });

  test("qrcodePath 绝对路径保持不变", async () => {
    await expect(
      normalizeConfig({
        cwd: "/workspace/project",
        args: {
          operation: "upload",
          platform: "mp-weixin",
        },
        config: {
          qrcodePath: {
            preview: "/tmp/my-preview.jpg",
            upload: "/tmp/my-upload.jpg",
          },
          "mp-weixin": {
            appid: "wx-appid",
            privateKeyPath: "keys/private.key",
          },
        },
        packageJson: {},
      }),
    ).resolves.toMatchObject({
      qrcodePath: {
        preview: "/tmp/my-preview.jpg",
        upload: "/tmp/my-upload.jpg",
      },
    });
  });

  test("未配置 qrcodePath 时结果中不含 qrcodePath 字段", async () => {
    /** 归一化后的配置 */
    const normalized = await normalizeConfig({
      cwd: "/workspace/project",
      args: {
        operation: "upload",
        platform: "mp-weixin",
      },
      config: {
        "mp-weixin": {
          appid: "wx-appid",
          privateKeyPath: "keys/private.key",
        },
      },
      packageJson: {},
    });

    expect(normalized.qrcodePath).toBeUndefined();
  });

  test("qrcodePath 仅配置 preview 时 upload 为 undefined", async () => {
    /** 当前工作目录 */
    const cwd = "/workspace/project";

    /** 归一化后的配置 */
    const normalized = await normalizeConfig({
      cwd,
      args: {
        operation: "preview",
        platform: "mp-weixin",
      },
      config: {
        qrcodePath: {
          preview: "./output/preview.png",
        },
        "mp-weixin": {
          appid: "wx-appid",
          privateKeyPath: "keys/private.key",
        },
      },
      packageJson: {},
    });

    expect(normalized.qrcodePath?.preview).toBe(path.join(cwd, "output/preview.png"));
    expect(normalized.qrcodePath?.upload).toBeUndefined();
  });

  test("纯 open 允许缺少当前平台配置", async () => {
    /** 当前工作目录 */
    const cwd = "/workspace/project";

    /** 归一化后的配置 */
    const normalized = await normalizeConfig({
      cwd,
      args: {
        operation: "open",
        platform: "mp-weixin",
        projectPath: "dist/dev/mp-weixin",
      },
      config: {},
      packageJson: {
        version: "1.0.0",
        description: "包描述",
      },
      allowMissingPlatformConfig: true,
    });

    expect(normalized).toMatchObject({
      operation: "open",
      platform: "mp-weixin",
      version: "1.0.0",
      desc: "包描述",
      projectPath: path.join(cwd, "dist/dev/mp-weixin"),
    });
    expect(normalized.platformConfig).toBeUndefined();
  });

  test("preview 默认不允许缺少当前平台配置", async () => {
    await expect(
      normalizeConfig({
        cwd: "/workspace/project",
        args: {
          operation: "preview",
          platform: "mp-weixin",
        },
        config: {},
        packageJson: {},
        allowMissingPlatformConfig: false,
      }),
    ).rejects.toThrow("mp-weixin 平台配置不能为空");
  });

  test("preview 即使允许缺少平台配置也仍失败", async () => {
    await expect(
      normalizeConfig({
        cwd: "/workspace/project",
        args: {
          operation: "preview",
          platform: "mp-weixin",
        },
        config: {},
        packageJson: {},
        allowMissingPlatformConfig: true,
      }),
    ).rejects.toThrow("mp-weixin 平台配置不能为空");
  });

  test("pure open 显式提供不完整平台配置时仍按 schema 失败", async () => {
    await expect(
      normalizeConfig({
        cwd: "/workspace/project",
        args: {
          operation: "open",
          platform: "mp-weixin",
        },
        config: {
          "mp-weixin": {
            appid: "wx-appid",
          } as never,
        },
        packageJson: {},
        allowMissingPlatformConfig: true,
      }),
    ).rejects.toThrow(/mp-weixin\.privateKeyPath/);
  });
});
