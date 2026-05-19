import { createLogger } from "../runtime/logger";

import type { Logger } from "../runtime/logger";
import type {
  MiniCIPlatform,
  MiniCISingleResult,
  NormalizedMiniCIConfig,
  PlatformConfigMap,
} from "../types";

/** 平台 CI 基类 */
export abstract class BaseCI<P extends MiniCIPlatform = MiniCIPlatform> {
  /** 运行时配置 */
  protected config: NormalizedMiniCIConfig<P>;
  /** 日志实例 */
  protected logger: Logger;

  constructor(config: NormalizedMiniCIConfig<P>, logger: Logger = createLogger()) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * 读取需要 preview/upload 的平台私密配置。
   *
   * @returns 当前平台配置
   */
  protected requirePlatformConfig(): PlatformConfigMap[P] {
    if (!this.config.platformConfig) {
      throw new Error(`配置校验失败：${this.config.platform} 平台配置不能为空`);
    }

    return this.config.platformConfig as PlatformConfigMap[P];
  }

  /**
   * 构建统一的执行结果对象。
   *
   * @param success 是否成功
   * @param extra 额外结果字段
   * @returns 执行结果
   */
  protected createResult(
    success: boolean,
    extra: Partial<MiniCISingleResult> = {},
  ): MiniCISingleResult {
    return {
      success,
      operation: this.config.operation,
      platform: this.config.platform,
      version: this.config.version,
      desc: this.config.desc,
      projectPath: this.config.projectPath,
      ...extra,
    };
  }

  /** 初始化平台 SDK */
  abstract init(): void | Promise<void>;
  /** 打开开发者工具 */
  abstract open(): Promise<MiniCISingleResult>;
  /** 预览小程序 */
  abstract preview(): Promise<MiniCISingleResult>;
  /** 上传小程序 */
  abstract upload(): Promise<MiniCISingleResult>;
}
