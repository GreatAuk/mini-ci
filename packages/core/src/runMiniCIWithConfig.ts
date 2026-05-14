import { access } from "node:fs/promises";
import { createCI } from "./ci/registry";
import { loadPackageJson } from "./config/loadPackageJson";
import { normalizeConfig } from "./config/normalize";

import type { MiniCIResult, RunMiniCIWithConfigOptions } from "./types";

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
 * 使用已解析参数和显式配置运行 minici 流程。
 *
 * @param options 共享执行入口选项
 * @returns minici 执行结果
 */
export async function runMiniCIWithConfig(
  options: RunMiniCIWithConfigOptions,
): Promise<MiniCIResult> {
  const packageJson = await loadPackageJson(options.cwd);
  const results: MiniCIResult["results"] = [];

  for (const operation of options.args.operations) {
    const normalized = await normalizeConfig({
      args: {
        ...options.args,
        operation,
      },
      cwd: options.cwd,
      config: options.config,
      packageJson,
    });

    await assertPathExists(normalized.projectPath);

    const ci = createCI(normalized);
    await ci.init();
    const result = await ci[operation]();
    results.push(result);
  }

  const firstResult = results[0];

  return {
    success: results.every((result) => result.success),
    operations: options.args.operations,
    platform: firstResult.platform,
    version: firstResult.version,
    desc: firstResult.desc,
    projectPath: firstResult.projectPath,
    results,
  };
}
