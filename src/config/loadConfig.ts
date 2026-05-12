import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "c12";

import type { MiniCIConfig } from "../types";

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

/**
 * 读取项目 package.json 文件。
 *
 * @param cwd 当前工作目录
 * @returns package.json 内容
 */
export async function loadPackageJson(cwd: string): Promise<Record<string, unknown>> {
  try {
    const content = await readFile(path.join(cwd, "package.json"), "utf8");
    return JSON.parse(content) as Record<string, unknown>;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return {};
    }

    throw error;
  }
}
