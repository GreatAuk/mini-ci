import type { Logger } from "../runtime/logger";
import type { MiniCIPlatform, MiniCISingleResult, NormalizedMiniCIConfig } from "../types";
/** 平台 CI 基类 */
export declare abstract class BaseCI<P extends MiniCIPlatform = MiniCIPlatform> {
  /** 运行时配置 */
  protected config: NormalizedMiniCIConfig<P>;
  /** 日志实例 */
  protected logger: Logger;
  constructor(config: NormalizedMiniCIConfig<P>, logger?: Logger);
  /**
   * 构建统一的执行结果对象。
   *
   * @param success 是否成功
   * @param extra 额外结果字段
   * @returns 执行结果
   */
  protected createResult(success: boolean, extra?: Partial<MiniCISingleResult>): MiniCISingleResult;
  /** 初始化平台 SDK */
  abstract init(): void | Promise<void>;
  /** 打开开发者工具 */
  abstract open(): Promise<MiniCISingleResult>;
  /** 预览小程序 */
  abstract preview(): Promise<MiniCISingleResult>;
  /** 上传小程序 */
  abstract upload(): Promise<MiniCISingleResult>;
}
//# sourceMappingURL=BaseCI.d.ts.map
