import { BaseCI } from "./BaseCI";
/** 支付宝小程序 CI 适配器 */
export declare class AlipayCI extends BaseCI<"mp-alipay"> {
    /** minidev 模块实例 */
    private minidev;
    init(): Promise<void>;
    open(): Promise<import("uni-mini-ci-core").MiniCISingleResult>;
    preview(): Promise<import("uni-mini-ci-core").MiniCISingleResult>;
    upload(): Promise<import("uni-mini-ci-core").MiniCISingleResult>;
}
//# sourceMappingURL=AlipayCI.d.ts.map