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
export declare function runBump(options: RunBumpOptions): Promise<MiniCIBumpResult>;
