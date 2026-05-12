import { access } from "node:fs/promises";
import { createCI } from "./ci/registry";
import { parseCliArgs } from "./command/parseArgs";
import { loadMiniCIConfig, loadPackageJson } from "./config/loadConfig";
import { normalizeConfig } from "./config/normalize";

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
  type SwanConfig,
  type TTConfig,
  type WeappConfig,
} from "./types";

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
 * 校验项目产物目录是否存在。
 *
 * @param projectPath 项目产物目录绝对路径
 */
async function assertPathExists(projectPath: string): Promise<void> {
  try {
    await access(projectPath);
  } catch {
    throw new Error(`projectPath 不存在：${projectPath}`);
  }
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
  const packageJson = await loadPackageJson(cwd);
  const normalized = await normalizeConfig({ args, cwd, config, packageJson });

  await assertPathExists(normalized.projectPath);

  const ci = createCI(normalized);
  await ci.init();
  return ci[normalized.operation]();
}
