import { BaseCI } from "./BaseCI";
/** 京东小程序 CI 适配器 */
export declare class JdCI extends BaseCI<"mp-jd"> {
    /** jd-miniprogram-ci 模块 */
    private jdCi;
    init(): Promise<void>;
    open(): Promise<import("uni-mini-ci-core").MiniCIResult>;
    preview(): Promise<import("uni-mini-ci-core").MiniCIResult>;
    upload(): Promise<import("uni-mini-ci-core").MiniCIResult>;
}
//# sourceMappingURL=JdCI.d.ts.map