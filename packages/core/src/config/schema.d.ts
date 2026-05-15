import { z } from "zod";
import type { MiniCICompleteHook, MiniCIConfig, MiniCIDescFunction, MiniCIErrorHook, MiniCIPlatform, PlatformConfigMap } from "../types";
/** minici 配置文件 schema */
export declare const miniciConfigSchema: z.ZodObject<{
    version: z.ZodOptional<z.ZodString>;
    desc: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodCustom<MiniCIDescFunction, MiniCIDescFunction>]>>;
    projectPath: z.ZodOptional<z.ZodString>;
    qrcodePath: z.ZodOptional<z.ZodObject<{
        preview: z.ZodOptional<z.ZodString>;
        upload: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>;
    hooks: z.ZodOptional<z.ZodObject<{
        onPreviewComplete: z.ZodOptional<z.ZodCustom<MiniCICompleteHook, MiniCICompleteHook>>;
        onUploadComplete: z.ZodOptional<z.ZodCustom<MiniCICompleteHook, MiniCICompleteHook>>;
        onError: z.ZodOptional<z.ZodCustom<MiniCIErrorHook, MiniCIErrorHook>>;
    }, z.core.$strict>>;
    "mp-weixin": z.ZodOptional<z.ZodObject<{
        appid: z.ZodString;
        privateKeyPath: z.ZodString;
        devToolsInstallPath: z.ZodOptional<z.ZodString>;
        type: z.ZodOptional<z.ZodEnum<{
            miniGame: "miniGame";
            miniGamePlugin: "miniGamePlugin";
            miniProgram: "miniProgram";
            miniProgramPlugin: "miniProgramPlugin";
        }>>;
        ignores: z.ZodOptional<z.ZodArray<z.ZodString>>;
        robot: z.ZodOptional<z.ZodNumber>;
        setting: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strict>>;
    "mp-alipay": z.ZodOptional<z.ZodObject<{
        appid: z.ZodString;
        toolId: z.ZodString;
        privateKeyPath: z.ZodOptional<z.ZodString>;
        privateKey: z.ZodOptional<z.ZodString>;
        devToolsInstallPath: z.ZodOptional<z.ZodString>;
        clientType: z.ZodOptional<z.ZodEnum<{
            alihealth: "alihealth";
            alios: "alios";
            alipay: "alipay";
            alipayiot: "alipayiot";
            amap: "amap";
            ampe: "ampe";
            cainiao: "cainiao";
            genie: "genie";
            health: "health";
            koubei: "koubei";
            quark: "quark";
            uc: "uc";
        }>>;
        deleteVersion: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>;
    "mp-baidu": z.ZodOptional<z.ZodObject<{
        token: z.ZodString;
        minSwanVersion: z.ZodOptional<z.ZodString>;
        devToolsInstallPath: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>;
    "mp-jd": z.ZodOptional<z.ZodObject<{
        privateKey: z.ZodString;
        robot: z.ZodOptional<z.ZodNumber>;
        ignores: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strict>>;
    "mp-toutiao": z.ZodOptional<z.ZodObject<{
        email: z.ZodString;
        password: z.ZodString;
        setting: z.ZodOptional<z.ZodObject<{
            skipDomainCheck: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>>;
    }, z.core.$strict>>;
}, z.core.$strict>;
/**
 * 校验完整 minici 配置。
 *
 * @param config 待校验配置
 * @returns 校验后的 minici 配置
 */
export declare function validateConfig(config: unknown): MiniCIConfig;
/**
 * 校验并返回指定平台配置。
 *
 * @param platform 当前平台
 * @param config 待校验配置
 * @returns 指定平台的私有配置
 */
export declare function validatePlatformConfig<P extends MiniCIPlatform>(platform: P, config: unknown): PlatformConfigMap[P];
/**
 * 判断平台是否为已支持平台。
 *
 * @param platform 当前平台
 * @returns 是否为支持的平台
 */
export declare function isSupportedConfigPlatform(platform: string): platform is MiniCIPlatform;
//# sourceMappingURL=schema.d.ts.map