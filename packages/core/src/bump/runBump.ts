import { versionBump } from "bumpp";

import type { MiniCIBumpResult, MiniCIConfig } from "../types";

/** 执行 bumpp 的选项 */
export interface RunBumpOptions {
  /** 当前工作目录 */
  cwd: string;
  /** 用户配置的 bumpp 选项 */
  bumpOptions?: MiniCIConfig["bumpOptions"];
}

/**
 * 执行 bumpp 版本更新。
 *
 * @param options bumpp 执行选项
 * @returns minici 归一化后的 bump 结果
 */
export async function runBump(options: RunBumpOptions): Promise<MiniCIBumpResult> {
  /** bumpp 原始执行结果 */
  const result = await versionBump({
    commit: false,
    tag: false,
    push: false,
    ...options.bumpOptions,
    cwd: options.cwd,
  });

  return {
    success: true,
    currentVersion: result.currentVersion,
    newVersion: result.newVersion,
    commit: result.commit,
    tag: result.tag,
    updatedFiles: result.updatedFiles,
    skippedFiles: result.skippedFiles,
  };
}
