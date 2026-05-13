import { BaseCI } from "./BaseCI";
/** 微信小程序 CI 适配器 */
export declare class WeappCI extends BaseCI<"mp-weixin"> {
    /** miniprogram-ci Project 实例 */
    private instance;
    /** miniprogram-ci 模块 */
    private ci;
    /** 微信开发者工具安装路径 */
    private devToolsInstallPath;
    init(): Promise<void>;
    open(): Promise<import("uni-mini-ci-core").MiniCIResult>;
    preview(): Promise<import("uni-mini-ci-core").MiniCIResult>;
    upload(): Promise<import("uni-mini-ci-core").MiniCIResult>;
}
//# sourceMappingURL=WeappCI.d.ts.map