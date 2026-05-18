import { BaseCI } from "./BaseCI";
/** 字节小程序 CI 适配器 */
export declare class TTCI extends BaseCI<"mp-toutiao"> {
    /** tt-ide-cli 模块 */
    private tt;
    init(): Promise<void>;
    private beforeCheck;
    open(): Promise<import("uni-mini-ci-core").MiniCISingleResult>;
    preview(): Promise<import("uni-mini-ci-core").MiniCISingleResult>;
    upload(): Promise<import("uni-mini-ci-core").MiniCISingleResult>;
}
