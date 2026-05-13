import type { MiniCIPlatform, MiniCIResult, NormalizedMiniCIConfig } from "../types";
/** 平台 CI 基类 */
export declare abstract class BaseCI<P extends MiniCIPlatform = MiniCIPlatform> {
    /** 运行时配置 */
    protected config: NormalizedMiniCIConfig<P>;
    constructor(config: NormalizedMiniCIConfig<P>);
    /**
     * 构建统一的执行结果对象。
     *
     * @param success 是否成功
     * @param extra 额外结果字段
     * @returns 执行结果
     */
    protected createResult(success: boolean, extra?: Partial<MiniCIResult>): MiniCIResult;
    /** 初始化平台 SDK */
    abstract init(): void | Promise<void>;
    /** 打开开发者工具 */
    abstract open(): Promise<MiniCIResult>;
    /** 预览小程序 */
    abstract preview(): Promise<MiniCIResult>;
    /** 上传小程序 */
    abstract upload(): Promise<MiniCIResult>;
}
//# sourceMappingURL=BaseCI.d.ts.map