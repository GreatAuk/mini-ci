import { AlipayCI } from "./AlipayCI";
import { JdCI } from "./JdCI";
import { SwanCI } from "./SwanCI";
import { TTCI } from "./TTCI";
import { WeappCI } from "./WeappCI";

import type { BaseCI } from "./BaseCI";
import type { MiniCIPlatform, NormalizedMiniCIConfig } from "../types";

/** 平台到 CI 类的映射
 * mp-weixin: 微信
 * mp-alipay: 支付宝
 * mp-baidu: 百度
 * mp-jd: 京东
 * mp-toutiao: 字节抖音
 */
const ciMap: Record<MiniCIPlatform, new (config: any) => BaseCI> = {
  "mp-weixin": WeappCI,
  "mp-alipay": AlipayCI,
  "mp-baidu": SwanCI,
  "mp-jd": JdCI,
  "mp-toutiao": TTCI,
};

/**
 * 根据平台创建对应的 CI 实例。
 *
 * @param config 归一化后的运行配置
 * @returns 平台 CI 实例
 */
export function createCI(config: NormalizedMiniCIConfig): BaseCI {
  const CI = ciMap[config.platform];
  return new CI(config);
}
