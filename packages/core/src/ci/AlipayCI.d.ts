import { BaseCI } from "./BaseCI";
/** 支付宝小程序 CI 适配器 */
export declare class AlipayCI extends BaseCI<"mp-alipay"> {
    /** minidev 模块实例 */
    private minidev;
    init(): Promise<void>;
    open(): Promise<import("uni-mini-ci-core").MiniCIResult>;
    preview(): Promise<import("uni-mini-ci-core").MiniCIResult>;
    upload(): Promise<import("uni-mini-ci-core").MiniCIResult>;
}
//# sourceMappingURL=AlipayCI.d.ts.map