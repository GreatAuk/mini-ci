import { parseCliArgs } from "./command/parseArgs";
import { loadMiniCIConfig } from "./config/loadConfig";
import { runMiniCIWithConfig } from "./runMiniCIWithConfig";

import type { CliOptions, MiniCIConfig, MiniCIResult } from "./types";

export {
  supportedOperations,
  supportedPlatforms,
  type AlipayClientType,
  type AlipayConfig,
  type CliOptions,
  type JdConfig,
  type MiniCIOperation,
  type MiniCIConfig,
  type MiniCIDescContext,
  type MiniCIDescFunction,
  type MiniCIPlatform,
  type MiniCIResult,
  type NormalizedMiniCIConfig,
  type NormalizedMiniCIConfigBase,
  type ParsedCliArgs,
  type PlatformConfigMap,
  type ProjectType,
  type RunMiniCIWithConfigOptions,
  type SwanConfig,
  type TTConfig,
  type UniMiniCIPluginOptions,
  type WeappConfig,
} from "./types";

export { runMiniCIWithConfig } from "./runMiniCIWithConfig";
export { uniMiniCI } from "./plugin/uniMiniCI";

/**
 * 定义 minici 配置并保留完整类型推导。
 *
 * @param config minici 配置对象
 * @returns 原始配置对象
 */
export function defineConfig<const T extends MiniCIConfig>(config: T): T {
  return config;
}

/**
 * 运行 minici CLI 流程。
 *
 * @param options CLI 入口选项
 * @returns minici 执行结果
 */
export async function runMiniCI(options: CliOptions): Promise<MiniCIResult> {
  const args = parseCliArgs(options.argv);
  const cwd = args.cwd || options.cwd || process.cwd();
  const config = await loadMiniCIConfig({ cwd, config: args.config });

  return runMiniCIWithConfig({ args, cwd, config });
}
