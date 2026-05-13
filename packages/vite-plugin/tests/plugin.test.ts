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
const tempDirs: string[] = [];

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

afterEach(async () => {
  calls.length = 0;
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

    await expect(runServePlugin(plugin, cwd)).rejects.toThrow("preview/upload 只支持 build 模式");
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
});
