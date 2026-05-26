import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { uniMiniCI } from "../src/uniMiniCI";

import type { Plugin, ResolvedConfig, ViteDevServer } from "vite";

const calls: Array<{ method: string; projectPath: string; platform: string }> = [];
const originalArgv = process.argv;
const originalUniPlatform = process.env.UNI_PLATFORM;
const originalUniOutputDir = process.env.UNI_OUTPUT_DIR;
const originalNodeEnv = process.env.NODE_ENV;
const tempDirs: string[] = [];

/** bumpp versionBump mock */
const versionBump = vi.fn();

vi.mock("bumpp", () => ({
  versionBump: (options: unknown) => versionBump(options),
}));

vi.mock("../../core/src/ci/registry", () => ({
  createCI: (config: any) => ({
    init: vi.fn(),
    open: vi.fn().mockImplementation(() => {
      calls.push({
        method: "open",
        projectPath: config.projectPath,
        platform: config.platform,
      });
      return {
        success: true,
        operation: config.operation,
        platform: config.platform,
        version: config.version,
        desc: config.desc,
        projectPath: config.projectPath,
      };
    }),
    preview: vi.fn().mockImplementation(() => {
      calls.push({
        method: "preview",
        projectPath: config.projectPath,
        platform: config.platform,
      });
      return {
        success: true,
        operation: config.operation,
        platform: config.platform,
        version: config.version,
        desc: config.desc,
        projectPath: config.projectPath,
      };
    }),
    upload: vi.fn().mockImplementation(() => {
      calls.push({
        method: "upload",
        projectPath: config.projectPath,
        platform: config.platform,
      });
      return {
        success: true,
        operation: config.operation,
        platform: config.platform,
        version: config.version,
        desc: config.desc,
        projectPath: config.projectPath,
      };
    }),
  }),
}));

async function createProject(command: "build" | "serve") {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "minici-plugin-"));
  const outputDir = path.join(
    cwd,
    command === "build" ? "dist/build/mp-weixin" : "dist/dev/mp-weixin",
  );
  tempDirs.push(cwd);
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(cwd, "package.json"), JSON.stringify({ version: "1.0.0" }));
  return { cwd, outputDir };
}

function createResolvedConfig(root: string, command: "build" | "serve"): ResolvedConfig {
  return {
    root,
    command,
  } as ResolvedConfig;
}

function createWatchBuildConfig(root: string): ResolvedConfig {
  return {
    root,
    command: "build",
  } as ResolvedConfig;
}

async function runBuildPlugin(plugin: Plugin, root: string) {
  if (typeof plugin.configResolved === "function") {
    await (plugin.configResolved as Function).call(null, createResolvedConfig(root, "build"));
  }

  if (typeof plugin.closeBundle === "function") {
    await (plugin.closeBundle as Function).call(null);
  }
}

async function runServePlugin(plugin: Plugin, root: string) {
  if (typeof plugin.configResolved === "function") {
    await (plugin.configResolved as Function).call(null, createResolvedConfig(root, "serve"));
  }

  if (typeof plugin.configureServer === "function") {
    await (plugin.configureServer as Function).call(null, {} as ViteDevServer);
  }
}

async function runWatchBuildPlugin(plugin: Plugin, root: string) {
  if (typeof plugin.configResolved === "function") {
    await (plugin.configResolved as Function).call(null, createWatchBuildConfig(root));
  }

  if (typeof plugin.closeBundle === "function") {
    await (plugin.closeBundle as Function).call(null);
  }
}

afterEach(async () => {
  calls.length = 0;
  versionBump.mockReset();
  process.argv = originalArgv;
  if (originalUniPlatform === undefined) {
    delete process.env.UNI_PLATFORM;
  } else {
    process.env.UNI_PLATFORM = originalUniPlatform;
  }
  if (originalUniOutputDir === undefined) {
    delete process.env.UNI_OUTPUT_DIR;
  } else {
    process.env.UNI_OUTPUT_DIR = originalUniOutputDir;
  }
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("uniMiniCI", () => {
  test("build 模式执行 upload", async () => {
    const { cwd, outputDir } = await createProject("build");
    process.argv = ["node", "uni", "build", "-p", "mp-weixin", "--", "--upload"];
    process.env.UNI_PLATFORM = "mp-weixin";
    process.env.UNI_OUTPUT_DIR = outputDir;

    const plugin = uniMiniCI({
      desc: "插件描述",
      "mp-weixin": {
        appid: "wx-appid",
        privateKeyPath: "key/private.key",
      },
    });

    await runBuildPlugin(plugin, cwd);

    expect(calls).toEqual([{ method: "upload", projectPath: outputDir, platform: "mp-weixin" }]);
  });

  test("build 模式按固定顺序执行多个操作", async () => {
    const { cwd, outputDir } = await createProject("build");
    process.argv = [
      "node",
      "uni",
      "build",
      "-p",
      "mp-weixin",
      "--",
      "--upload",
      "--open",
      "--preview",
    ];
    process.env.UNI_PLATFORM = "mp-weixin";
    process.env.UNI_OUTPUT_DIR = outputDir;

    const plugin = uniMiniCI({
      desc: "插件描述",
      "mp-weixin": {
        appid: "wx-appid",
        privateKeyPath: "key/private.key",
      },
    });

    await runBuildPlugin(plugin, cwd);

    expect(calls).toEqual([
      { method: "open", projectPath: outputDir, platform: "mp-weixin" },
      { method: "preview", projectPath: outputDir, platform: "mp-weixin" },
      { method: "upload", projectPath: outputDir, platform: "mp-weixin" },
    ]);
  });

  test("serve 模式执行 open", async () => {
    const { cwd, outputDir } = await createProject("serve");
    process.argv = ["node", "uni", "dev", "-p", "mp-weixin", "--", "--open"];
    process.env.UNI_PLATFORM = "mp-weixin";
    process.env.UNI_OUTPUT_DIR = outputDir;

    const plugin = uniMiniCI({
      desc: "插件描述",
      "mp-weixin": {
        appid: "wx-appid",
        privateKeyPath: "key/private.key",
      },
    });

    await runServePlugin(plugin, cwd);

    expect(calls).toEqual([{ method: "open", projectPath: outputDir, platform: "mp-weixin" }]);
  });

  test("serve 模式纯 open 缺少平台配置时仍执行 open", async () => {
    const { cwd, outputDir } = await createProject("serve");
    process.argv = ["node", "uni", "dev", "-p", "mp-weixin", "--", "--open"];
    process.env.UNI_PLATFORM = "mp-weixin";
    process.env.UNI_OUTPUT_DIR = outputDir;

    const plugin = uniMiniCI({});

    await runServePlugin(plugin, cwd);

    expect(calls).toEqual([{ method: "open", projectPath: outputDir, platform: "mp-weixin" }]);
  });

  test("serve 模式 open 与 preview 组合缺少平台配置时仍失败且不执行 open", async () => {
    const { cwd, outputDir } = await createProject("serve");
    process.argv = ["node", "uni", "dev", "-p", "mp-weixin", "--", "--open", "--preview"];
    process.env.UNI_PLATFORM = "mp-weixin";
    process.env.UNI_OUTPUT_DIR = outputDir;

    const plugin = uniMiniCI({});

    await expect(runServePlugin(plugin, cwd)).rejects.toThrow("mp-weixin 平台配置不能为空");
    expect(calls).toEqual([]);
  });

  test("serve 模式拒绝 upload", async () => {
    const { cwd, outputDir } = await createProject("serve");
    process.argv = ["node", "uni", "dev", "-p", "mp-weixin", "--", "--upload"];
    process.env.UNI_PLATFORM = "mp-weixin";
    process.env.UNI_OUTPUT_DIR = outputDir;

    const plugin = uniMiniCI({
      "mp-weixin": {
        appid: "wx-appid",
        privateKeyPath: "key/private.key",
      },
    });

    await expect(runServePlugin(plugin, cwd)).rejects.toThrow("upload 只支持 build 模式");
  });

  test("serve 模式执行 preview", async () => {
    const { cwd, outputDir } = await createProject("serve");
    process.argv = ["node", "uni", "dev", "-p", "mp-weixin", "--", "--preview"];
    process.env.UNI_PLATFORM = "mp-weixin";
    process.env.UNI_OUTPUT_DIR = outputDir;

    const plugin = uniMiniCI({
      desc: "插件描述",
      "mp-weixin": {
        appid: "wx-appid",
        privateKeyPath: "key/private.key",
      },
    });

    await runServePlugin(plugin, cwd);

    expect(calls).toEqual([{ method: "preview", projectPath: outputDir, platform: "mp-weixin" }]);
  });

  test("serve 模式按固定顺序执行 open 和 preview", async () => {
    const { cwd, outputDir } = await createProject("serve");
    process.argv = ["node", "uni", "dev", "-p", "mp-weixin", "--", "--preview", "--open"];
    process.env.UNI_PLATFORM = "mp-weixin";
    process.env.UNI_OUTPUT_DIR = outputDir;

    const plugin = uniMiniCI({
      desc: "插件描述",
      "mp-weixin": {
        appid: "wx-appid",
        privateKeyPath: "key/private.key",
      },
    });

    await runServePlugin(plugin, cwd);

    expect(calls).toEqual([
      { method: "open", projectPath: outputDir, platform: "mp-weixin" },
      { method: "preview", projectPath: outputDir, platform: "mp-weixin" },
    ]);
  });

  test("serve 模式包含 upload 时整体报错且不执行其他操作", async () => {
    const { cwd, outputDir } = await createProject("serve");
    process.argv = ["node", "uni", "dev", "-p", "mp-weixin", "--", "--open", "--upload"];
    process.env.UNI_PLATFORM = "mp-weixin";
    process.env.UNI_OUTPUT_DIR = outputDir;

    const plugin = uniMiniCI({
      "mp-weixin": {
        appid: "wx-appid",
        privateKeyPath: "key/private.key",
      },
    });

    await expect(runServePlugin(plugin, cwd)).rejects.toThrow("upload 只支持 build 模式");
    expect(calls).toEqual([]);
  });

  test("watch build 模式（uni dev）拒绝 upload", async () => {
    const { cwd, outputDir } = await createProject("build");
    process.argv = ["node", "uni", "dev", "-p", "mp-weixin", "--", "--preview", "--upload"];
    process.env.UNI_PLATFORM = "mp-weixin";
    process.env.UNI_OUTPUT_DIR = outputDir;
    process.env.NODE_ENV = "development";

    const plugin = uniMiniCI({
      "mp-weixin": {
        appid: "wx-appid",
        privateKeyPath: "key/private.key",
      },
    });

    await expect(runWatchBuildPlugin(plugin, cwd)).rejects.toThrow("upload 只支持 build 模式");
    expect(calls).toEqual([]);
  });

  test("watch build 模式（uni dev）允许 open 和 preview", async () => {
    const { cwd, outputDir } = await createProject("build");
    process.argv = ["node", "uni", "dev", "-p", "mp-weixin", "--", "--open", "--preview"];
    process.env.UNI_PLATFORM = "mp-weixin";
    process.env.UNI_OUTPUT_DIR = outputDir;
    process.env.NODE_ENV = "development";

    const plugin = uniMiniCI({
      desc: "插件描述",
      "mp-weixin": {
        appid: "wx-appid",
        privateKeyPath: "key/private.key",
      },
    });

    await runWatchBuildPlugin(plugin, cwd);
    expect(calls.map((c) => c.method)).toEqual(["open", "preview"]);
  });

  test("watch build 模式（uni dev）重复构建时 pure open 只执行一次", async () => {
    const { cwd, outputDir } = await createProject("build");
    process.argv = ["node", "uni", "dev", "-p", "mp-weixin", "--", "--open"];
    process.env.UNI_PLATFORM = "mp-weixin";
    process.env.UNI_OUTPUT_DIR = outputDir;
    process.env.NODE_ENV = "development";

    const plugin = uniMiniCI({});

    if (typeof plugin.configResolved === "function") {
      await (plugin.configResolved as Function).call(null, createWatchBuildConfig(cwd));
    }

    if (typeof plugin.closeBundle === "function") {
      await (plugin.closeBundle as Function).call(null);
      await (plugin.closeBundle as Function).call(null);
    }

    expect(calls).toEqual([{ method: "open", projectPath: outputDir, platform: "mp-weixin" }]);
  });

  test("未传操作时跳过", async () => {
    const { cwd, outputDir } = await createProject("build");
    process.argv = ["node", "uni", "build", "-p", "mp-weixin"];
    process.env.UNI_PLATFORM = "mp-weixin";
    process.env.UNI_OUTPUT_DIR = outputDir;

    const plugin = uniMiniCI({
      "mp-weixin": {
        appid: "wx-appid",
        privateKeyPath: "key/private.key",
      },
    });

    await runBuildPlugin(plugin, cwd);

    expect(calls).toEqual([]);
  });

  test("options projectPath 优先于 UNI_OUTPUT_DIR", async () => {
    const { cwd, outputDir } = await createProject("build");
    const configuredProjectPath = path.join(cwd, "custom-output");
    await mkdir(configuredProjectPath, { recursive: true });
    process.argv = ["node", "uni", "build", "-p", "mp-weixin", "--", "--preview"];
    process.env.UNI_PLATFORM = "mp-weixin";
    process.env.UNI_OUTPUT_DIR = outputDir;

    const plugin = uniMiniCI({
      projectPath: configuredProjectPath,
      "mp-weixin": {
        appid: "wx-appid",
        privateKeyPath: "key/private.key",
      },
    });

    await runBuildPlugin(plugin, cwd);

    expect(calls).toEqual([
      { method: "preview", projectPath: configuredProjectPath, platform: "mp-weixin" },
    ]);
  });

  test("缺少 UNI_PLATFORM 时报错", async () => {
    const { cwd, outputDir } = await createProject("build");
    process.argv = ["node", "uni", "build", "-p", "mp-weixin", "--", "--upload"];
    delete process.env.UNI_PLATFORM;
    process.env.UNI_OUTPUT_DIR = outputDir;

    const plugin = uniMiniCI({
      "mp-weixin": {
        appid: "wx-appid",
        privateKeyPath: "key/private.key",
      },
    });

    await expect(runBuildPlugin(plugin, cwd)).rejects.toThrow("无法确定 platform");
  });

  test("缺少 projectPath 来源时报错", async () => {
    const { cwd } = await createProject("build");
    process.argv = ["node", "uni", "build", "-p", "mp-weixin", "--", "--upload"];
    process.env.UNI_PLATFORM = "mp-weixin";
    delete process.env.UNI_OUTPUT_DIR;

    const plugin = uniMiniCI({
      "mp-weixin": {
        appid: "wx-appid",
        privateKeyPath: "key/private.key",
      },
    });

    await expect(runBuildPlugin(plugin, cwd)).rejects.toThrow("无法确定 projectPath");
  });

  test("h5 平台 build 模式跳过 CI", async () => {
    const { cwd, outputDir } = await createProject("build");
    process.argv = ["node", "uni", "build", "--", "--upload"];
    process.env.UNI_PLATFORM = "h5";
    process.env.UNI_OUTPUT_DIR = outputDir;

    const plugin = uniMiniCI({
      "mp-weixin": {
        appid: "wx-appid",
        privateKeyPath: "key/private.key",
      },
    });

    await runBuildPlugin(plugin, cwd);

    expect(calls).toEqual([]);
  });

  test("h5 平台 serve 模式传入 --open 跳过 CI", async () => {
    const { cwd, outputDir } = await createProject("serve");
    process.argv = ["node", "uni", "--", "--open"];
    process.env.UNI_PLATFORM = "h5";
    process.env.UNI_OUTPUT_DIR = outputDir;

    const plugin = uniMiniCI({
      "mp-weixin": {
        appid: "wx-appid",
        privateKeyPath: "key/private.key",
      },
    });

    await runServePlugin(plugin, cwd);

    expect(calls).toEqual([]);
  });

  test("build 模式执行 bump-only", async () => {
    const { cwd, outputDir } = await createProject("build");
    process.argv = ["node", "uni", "build", "-p", "mp-weixin", "--", "--bump"];
    process.env.UNI_PLATFORM = "mp-weixin";
    process.env.UNI_OUTPUT_DIR = outputDir;
    versionBump.mockResolvedValue({
      currentVersion: "1.0.0",
      newVersion: "1.0.1",
      commit: false,
      tag: false,
      updatedFiles: ["package.json"],
      skippedFiles: [],
    });

    const plugin = uniMiniCI({
      bumpOptions: {
        release: "patch",
        confirm: false,
      },
    });

    await runBuildPlugin(plugin, cwd);

    expect(versionBump).toHaveBeenCalled();
    expect(calls).toEqual([]);
  });

  test("serve 模式拒绝 bump-only", async () => {
    const { cwd, outputDir } = await createProject("serve");
    process.argv = ["node", "uni", "dev", "-p", "mp-weixin", "--", "--bump"];
    process.env.UNI_PLATFORM = "mp-weixin";
    process.env.UNI_OUTPUT_DIR = outputDir;

    const plugin = uniMiniCI({
      bumpOptions: {
        release: "patch",
      },
    });

    await expect(runServePlugin(plugin, cwd)).rejects.toThrow("bump 只支持 build 模式");
    expect(versionBump).not.toHaveBeenCalled();
  });

  test("h5 平台传入 bump 时跳过全部插件动作", async () => {
    const { cwd, outputDir } = await createProject("build");
    process.argv = ["node", "uni", "build", "--", "--bump"];
    process.env.UNI_PLATFORM = "h5";
    process.env.UNI_OUTPUT_DIR = outputDir;

    const plugin = uniMiniCI({
      bumpOptions: {
        release: "patch",
      },
    });

    await runBuildPlugin(plugin, cwd);

    expect(versionBump).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });

  test("build 模式 bump 加 upload 时先 bump 后 upload", async () => {
    const { cwd, outputDir } = await createProject("build");
    process.argv = ["node", "uni", "build", "-p", "mp-weixin", "--", "--bump", "--upload"];
    process.env.UNI_PLATFORM = "mp-weixin";
    process.env.UNI_OUTPUT_DIR = outputDir;
    versionBump.mockResolvedValue({
      currentVersion: "1.0.0",
      newVersion: "1.0.1",
      commit: false,
      tag: false,
      updatedFiles: ["package.json"],
      skippedFiles: [],
    });

    const plugin = uniMiniCI({
      desc: "插件描述",
      bumpOptions: {
        release: "patch",
        confirm: false,
      },
      "mp-weixin": {
        appid: "wx-appid",
        privateKeyPath: "key/private.key",
      },
    });

    await runBuildPlugin(plugin, cwd);

    expect(versionBump).toHaveBeenCalled();
    expect(calls).toEqual([{ method: "upload", projectPath: outputDir, platform: "mp-weixin" }]);
  });

  test("hooks 会通过插件配置透传到共享 runner", async () => {
    const { cwd, outputDir } = await createProject("build");
    process.argv = ["node", "uni", "build", "-p", "mp-weixin", "--", "--preview"];
    process.env.UNI_PLATFORM = "mp-weixin";
    process.env.UNI_OUTPUT_DIR = outputDir;
    const onPreviewComplete = vi.fn();

    const plugin = uniMiniCI({
      hooks: {
        onPreviewComplete,
      },
      "mp-weixin": {
        appid: "wx-appid",
        privateKeyPath: "key/private.key",
      },
    });

    await runBuildPlugin(plugin, cwd);

    expect(onPreviewComplete).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({
        platform: "mp-weixin",
        projectPath: outputDir,
      }),
    });
  });
});
