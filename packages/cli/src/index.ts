import { parseCliArgs } from "./command/parseArgs";
import { loadMiniCIConfig } from "./config/loadConfig";
import { runMiniCIWithConfig } from "uni-mini-ci-core";

import type { CliOptions } from "./types";
import type { MiniCIConfig, MiniCIResult } from "uni-mini-ci-core";

export {
  createLogger,
  isErrorLogged,
  markErrorLogged,
  runMiniCIWithConfig,
  supportedOperations,
  supportedPlatforms,
  type AlipayClientType,
  type AlipayConfig,
  type JdConfig,
  type Logger,
  type MiniCICompleteHook,
  type MiniCICompleteHookData,
  type MiniCIConfig,
  type MiniCIDescContext,
  type MiniCIDescFunction,
  type MiniCIErrorHook,
  type MiniCIErrorHookData,
  type MiniCIHooks,
  type MiniCIOperation,
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
  type WeappConfig,
} from "uni-mini-ci-core";

export type { CliOptions } from "./types";

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
