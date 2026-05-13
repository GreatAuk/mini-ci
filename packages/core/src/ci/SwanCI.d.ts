import { BaseCI } from "./BaseCI";
/** 百度小程序 CI 适配器 */
export declare class SwanCI extends BaseCI<"mp-baidu"> {
    /** swan-toolkit CLI 路径 */
    private swanBin;
    init(): Promise<void>;
    open(): Promise<import("uni-mini-ci-core").MiniCIResult>;
    preview(): Promise<import("uni-mini-ci-core").MiniCIResult>;
    upload(): Promise<import("uni-mini-ci-core").MiniCIResult>;
}
//# sourceMappingURL=SwanCI.d.ts.map