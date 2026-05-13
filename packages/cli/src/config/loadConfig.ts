import { loadConfig } from "c12";

import type { MiniCIConfig } from "uni-mini-ci-core";

/** 加载 minici 配置的选项 */
interface LoadMiniCIConfigOptions {
  /** 当前工作目录 */
  cwd: string;
  /** 显式配置文件路径 */
  config?: string;
}

/**
 * 使用 c12 加载 minici.config 配置文件。
 *
 * @param options 加载选项
 * @returns 已加载的配置对象
 */
export async function loadMiniCIConfig(options: LoadMiniCIConfigOptions): Promise<MiniCIConfig> {
  const result = await loadConfig<MiniCIConfig>({
    cwd: options.cwd,
    name: "minici",
    configFile: options.config,
    dotenv: false,
    rcFile: false,
  });

  return result.config || {};
}
