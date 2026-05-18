import { versionBump } from "bumpp";

import type { BumpOptionsContext, BumpOptionsInput, MiniCIBumpResult } from "../types";

/** 执行 bumpp 的选项 */
export interface RunBumpOptions {
  /** 当前工作目录 */
  cwd: string;
  /** 用户配置的 bumpp 选项（对象或函数） */
  bumpOptions?: BumpOptionsInput;
  /** 动态函数所需的上下文 */
  context: BumpOptionsContext;
}

/**
 * 解析 bumpOptions：如果是函数则调用，否则直接返回。
 */
async function resolveBumpOptions(input: BumpOptionsInput | undefined, ctx: BumpOptionsContext) {
  if (typeof input === "function") {
    return await input(ctx);
  }
  return input;
}

/**
 * 执行 bumpp 版本更新。
 *
 * @param options bumpp 执行选项
 * @returns minici 归一化后的 bump 结果
 */
export async function runBump(options: RunBumpOptions): Promise<MiniCIBumpResult> {
  const resolved = await resolveBumpOptions(options.bumpOptions, options.context);

  /** bumpp 原始执行结果 */
  const result = await versionBump({
    commit: false,
    tag: false,
    push: false,
    ...resolved,
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
