import { BaseCI } from "./BaseCI";
/** 京东小程序 CI 适配器 */
export declare class JdCI extends BaseCI<"mp-jd"> {
    /** jd-miniprogram-ci 模块 */
    private jdCi;
    init(): Promise<void>;
    open(): Promise<import("uni-mini-ci-core").MiniCISingleResult>;
    preview(): Promise<import("uni-mini-ci-core").MiniCISingleResult>;
    upload(): Promise<import("uni-mini-ci-core").MiniCISingleResult>;
}
//# sourceMappingURL=JdCI.d.ts.map