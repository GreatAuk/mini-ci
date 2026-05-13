import type { MiniCIConfig, MiniCIPlatform, NormalizedMiniCIConfig, ParsedCliArgs } from "../types";
/** 配置归一化入参 */
export interface NormalizeConfigInput<P extends MiniCIPlatform = MiniCIPlatform> {
    /** 已解析的命令行参数 */
    args: ParsedCliArgs & {
        platform: P;
    };
    /** 当前工作目录 */
    cwd: string;
    /** 已加载的 minici 配置 */
    config: MiniCIConfig;
    /** 当前项目 package.json 内容 */
    packageJson: Record<string, unknown>;
}
/**
 * 将命令行参数、配置文件和 package.json 合并为运行时配置。
 *
 * @param input 配置归一化入参
 * @returns 规范化后的 minici 运行配置
 */
export declare function normalizeConfig<P extends MiniCIPlatform>(input: NormalizeConfigInput<P>): Promise<NormalizedMiniCIConfig<P>>;
//# sourceMappingURL=normalize.d.ts.map