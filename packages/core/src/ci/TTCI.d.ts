import { BaseCI } from "./BaseCI";
/** 字节小程序 CI 适配器 */
export declare class TTCI extends BaseCI<"mp-toutiao"> {
    /** tt-ide-cli 模块 */
    private tt;
    init(): Promise<void>;
    private beforeCheck;
    open(): Promise<import("uni-mini-ci-core").MiniCIResult>;
    preview(): Promise<import("uni-mini-ci-core").MiniCIResult>;
    upload(): Promise<import("uni-mini-ci-core").MiniCIResult>;
}
//# sourceMappingURL=TTCI.d.ts.map