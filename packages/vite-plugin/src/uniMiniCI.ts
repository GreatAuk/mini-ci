import { parsePluginArgs } from "./parsePluginArgs";
import { runMiniCIWithConfig, supportedPlatforms } from "uni-mini-ci-core";

import type { Plugin, ResolvedConfig } from "vite";
import type { MiniCIConfig, MiniCIPlatform } from "uni-mini-ci-core";

/** Vite 插件配置结构 */
export interface UniMiniCIPluginOptions extends MiniCIConfig {}

/**
 * 判断字符串是否为支持的 uniapp 小程序平台。
 *
 * @param value 待判断的平台字符串
 * @returns 是否为支持的平台
 */
function isPlatform(value: string): value is MiniCIPlatform {
  return supportedPlatforms.includes(value as MiniCIPlatform);
}

/** Vite 插件名称 */
const pluginName = "vite-plugin-uni-mini-ci";

/**
 * 读取 uni 当前编译平台。
 *
 * @returns 已校验的平台
 */
function readUniPlatform(): MiniCIPlatform {
  /** uni 注入的平台环境变量 */
  const platform = process.env.UNI_PLATFORM;

  if (!platform) {
    throw new Error("无法确定 platform，请检查 UNI_PLATFORM");
  }

  if (!isPlatform(platform)) {
    throw new Error(
      `暂不支持平台：${platform}\n可选值：mp-weixin、mp-alipay、mp-baidu、mp-jd、mp-toutiao`,
    );
  }

  return platform;
}

/**
 * 读取插件模式下的项目产物目录。
 *
 * @param options 插件配置
 * @returns 项目产物目录
 */
function readProjectPath(options: UniMiniCIPluginOptions): string {
  /** 插件显式项目路径 */
  const configuredProjectPath = options.projectPath;

  if (configuredProjectPath) {
    return configuredProjectPath;
  }

  /** uni 注入的产物目录 */
  const outputDir = process.env.UNI_OUTPUT_DIR;

  if (!outputDir) {
    throw new Error(
      "无法确定 projectPath，请配置 uniMiniCI({ projectPath }) 或检查 UNI_OUTPUT_DIR",
    );
  }

  return outputDir;
}

/**
 * 创建 uni 小程序 CI Vite 插件。
 *
 * @param options 插件配置
 * @returns Vite 插件
 */
export function uniMiniCI(options: UniMiniCIPluginOptions): Plugin {
  /** 已解析 Vite 配置 */
  let resolvedConfig: ResolvedConfig | undefined;

  /**
   * 执行插件触发的 minici 操作。
   */
  async function runPluginOperation(): Promise<void> {
    /** 插件透传参数 */
    const pluginArgs = parsePluginArgs(process.argv);

    if (pluginArgs.operations.length === 0 && !pluginArgs.bump) {
      return;
    }

    // h5 等非小程序平台无需执行插件动作，直接跳过
    const rawPlatform = process.env.UNI_PLATFORM;
    if (rawPlatform && !isPlatform(rawPlatform)) {
      return;
    }

    /** 是否为开发模式（NODE_ENV=development 或 serve 命令） */
    const isDev = resolvedConfig?.command === "serve" || process.env.NODE_ENV === "development";

    if (isDev && pluginArgs.bump) {
      throw new Error("bump 只支持 build 模式");
    }

    if (isDev && pluginArgs.operations.includes("upload")) {
      throw new Error("upload 只支持 build 模式");
    }

    if (pluginArgs.operations.length === 0) {
      // bump-only: no platform config needed
      await runMiniCIWithConfig({
        args: {
          operations: [],
          ...(pluginArgs.bump && { bump: true }),
        },
        cwd: resolvedConfig?.root || process.cwd(),
        config: options,
      });
      return;
    }

    /** 当前平台 */
    const platform = readUniPlatform();
    /** 项目产物目录 */
    const projectPath = readProjectPath(options);

    await runMiniCIWithConfig({
      args: {
        operations: pluginArgs.operations,
        ...(pluginArgs.bump && { bump: true }),
        platform,
        projectPath,
      },
      cwd: resolvedConfig?.root || process.cwd(),
      config: options,
    });
  }

  return {
    name: pluginName,
    configResolved(config) {
      resolvedConfig = config;
    },
    async closeBundle() {
      if (resolvedConfig?.command !== "build") {
        return;
      }

      await runPluginOperation();
    },
    async configureServer() {
      if (resolvedConfig?.command !== "serve") {
        return;
      }

      await runPluginOperation();
    },
  };
}
