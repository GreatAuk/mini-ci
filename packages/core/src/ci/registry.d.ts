import type { BaseCI } from "./BaseCI";
import type { Logger } from "../runtime/logger";
import type { NormalizedMiniCIConfig } from "../types";
/**
 * 根据平台创建对应的 CI 实例。
 *
 * @param config 归一化后的运行配置
 * @param logger 可选日志实例
 * @returns 平台 CI 实例
 */
export declare function createCI(config: NormalizedMiniCIConfig, logger?: Logger): BaseCI;
//# sourceMappingURL=registry.d.ts.map
