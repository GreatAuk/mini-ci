import { z } from "zod";
import { supportedPlatforms } from "../types";

import type {
  AlipayClientType,
  MiniCIConfig,
  MiniCIDescFunction,
  MiniCIPlatform,
  PlatformConfigMap,
  ProjectType,
} from "../types";

/** 描述函数 schema */
const descFunctionSchema = z.custom<MiniCIDescFunction>(
  (value) => typeof value === "function",
  "desc 必须是字符串或函数",
);

/** 非空字符串 schema */
const nonEmptyStringSchema = z.string().min(1, "不能为空");

/** 版本号 schema */
const versionSchema = nonEmptyStringSchema.regex(/^\d+\.\d+\.\d+$/, "必须是 x.y.z 格式");

/** 微信项目类型 schema */
const projectTypeSchema = z.enum([
  "miniProgram",
  "miniGame",
  "miniProgramPlugin",
  "miniGamePlugin",
] satisfies ProjectType[]);

/** 支付宝上传终端类型 schema */
const alipayClientTypeSchema = z.enum([
  "alipay",
  "ampe",
  "amap",
  "genie",
  "alios",
  "uc",
  "quark",
  "koubei",
  "alipayiot",
  "cainiao",
  "alihealth",
  "health",
] satisfies AlipayClientType[]);

/** 未知对象字段 schema */
const unknownRecordSchema = z.record(z.string(), z.unknown());

/** 微信小程序配置 schema */
const weappConfigSchema = z
  .object({
    /** 小程序或小游戏项目的 appid */
    appid: nonEmptyStringSchema,
    /** 私钥文件路径 */
    privateKeyPath: nonEmptyStringSchema,
    /** 微信开发者工具安装路径 */
    devToolsInstallPath: nonEmptyStringSchema.optional(),
    /** 项目类型 */
    type: projectTypeSchema.optional(),
    /** 上传需要排除的目录 */
    ignores: z.array(nonEmptyStringSchema).optional(),
    /** CI 机器人编号 */
    robot: z.number().optional(),
    /** 预览和上传时的编译设置 */
    setting: unknownRecordSchema.optional(),
  })
  .strict();

/** 支付宝小程序配置 schema */
const alipayConfigSchema = z
  .object({
    /** 小程序 appid */
    appid: nonEmptyStringSchema,
    /** 工具 id */
    toolId: nonEmptyStringSchema,
    /** 私钥文件路径 */
    privateKeyPath: nonEmptyStringSchema.optional(),
    /** 私钥文本 */
    privateKey: nonEmptyStringSchema.optional(),
    /** 小程序开发者工具安装路径 */
    devToolsInstallPath: nonEmptyStringSchema.optional(),
    /** 上传终端类型 */
    clientType: alipayClientTypeSchema.optional(),
    /** 上传时删除的版本号 */
    deleteVersion: versionSchema.optional(),
  })
  .strict()
  .refine((config) => Boolean(config.privateKeyPath || config.privateKey), {
    message: "privateKeyPath 或 privateKey 至少需要提供一个",
    path: ["privateKeyPath"],
  });

/** 京东小程序配置 schema */
const jdConfigSchema = z
  .object({
    /** 京东小程序秘钥 */
    privateKey: nonEmptyStringSchema,
    /** CI 机器人编号 */
    robot: z.number().optional(),
    /** 上传忽略规则 */
    ignores: z.array(nonEmptyStringSchema).optional(),
  })
  .strict();

/** 百度小程序配置 schema */
const swanConfigSchema = z
  .object({
    /** 百度小程序鉴权 token */
    token: nonEmptyStringSchema,
    /** 最低基础库版本 */
    minSwanVersion: nonEmptyStringSchema.optional(),
    /** 百度开发者工具安装路径 */
    devToolsInstallPath: nonEmptyStringSchema.optional(),
  })
  .strict();

/** 字节小程序配置 schema */
const ttConfigSchema = z
  .object({
    /** 字节小程序邮箱 */
    email: nonEmptyStringSchema,
    /** 字节小程序密码 */
    password: nonEmptyStringSchema,
    /** 字节 IDE 编译设置 */
    setting: z
      .object({
        /** 是否跳过域名校验 */
        skipDomainCheck: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

/** minici 配置文件 schema */
export const miniciConfigSchema = z
  .object({
    /** 发布版本号 */
    version: nonEmptyStringSchema.optional(),
    /** 发布描述 */
    desc: z.union([nonEmptyStringSchema, descFunctionSchema]).optional(),
    /** 小程序构建产物目录 */
    projectPath: nonEmptyStringSchema.optional(),
    /** 微信小程序配置 */
    "mp-weixin": weappConfigSchema.optional(),
    /** 支付宝小程序配置 */
    "mp-alipay": alipayConfigSchema.optional(),
    /** 百度小程序配置 */
    "mp-baidu": swanConfigSchema.optional(),
    /** 京东小程序配置 */
    "mp-jd": jdConfigSchema.optional(),
    /** 字节小程序配置 */
    "mp-toutiao": ttConfigSchema.optional(),
  })
  .strict() satisfies z.ZodType<MiniCIConfig>;

/**
 * 将 zod 错误格式化为包含字段路径的配置错误。
 *
 * @param error zod 校验错误
 * @returns 配置校验错误
 */
function formatConfigError(error: z.ZodError): Error {
  /** 字段错误描述列表 */
  const messages = error.issues.map((issue) => {
    /** 字段路径 */
    const path = issue.path.join(".");

    return `${path || "config"} ${issue.message}`;
  });

  return new Error(`配置校验失败：${messages.join("；")}`);
}

/**
 * 校验完整 minici 配置。
 *
 * @param config 待校验配置
 * @returns 校验后的 minici 配置
 */
export function validateConfig(config: unknown): MiniCIConfig {
  /** 配置校验结果 */
  const result = miniciConfigSchema.safeParse(config);

  if (!result.success) {
    throw formatConfigError(result.error);
  }

  return result.data;
}

/**
 * 校验并返回指定平台配置。
 *
 * @param platform 当前平台
 * @param config 待校验配置
 * @returns 指定平台的私有配置
 */
export function validatePlatformConfig<P extends MiniCIPlatform>(
  platform: P,
  config: unknown,
): PlatformConfigMap[P] {
  /** 已校验的完整配置 */
  const parsedConfig = validateConfig(config);
  /** 当前平台配置 */
  const platformConfig = parsedConfig[platform];

  if (!platformConfig) {
    throw new Error(`配置校验失败：${platform} 平台配置不能为空`);
  }

  return platformConfig as PlatformConfigMap[P];
}

/**
 * 判断平台是否为已支持平台。
 *
 * @param platform 当前平台
 * @returns 是否为支持的平台
 */
export function isSupportedConfigPlatform(platform: string): platform is MiniCIPlatform {
  return supportedPlatforms.includes(platform as MiniCIPlatform);
}
