import type { VersionBumpOptions } from "bumpp";
/** bumpOptions 函数形式接收的上下文 */
export interface BumpOptionsContext {
  /** 当前工作目录 */
  cwd: string;
  /** 目标平台 */
  platform: MiniCIPlatform;
  /** 要执行的操作列表 */
  operations: MiniCIOperation[];
}
/** bumpOptions 支持对象或返回对象的函数（同步/异步） */
export type BumpOptionsInput =
  | VersionBumpOptions
  | ((ctx: BumpOptionsContext) => VersionBumpOptions | Promise<VersionBumpOptions>);
/** 支持的 CLI 操作列表 */
export declare const supportedOperations: readonly ["open", "preview", "upload"];
/** 支持的 uniapp 小程序平台列表 */
export declare const supportedPlatforms: readonly [
  "mp-weixin",
  "mp-alipay",
  "mp-baidu",
  "mp-jd",
  "mp-toutiao",
];
/** CLI 操作类型 */
export type MiniCIOperation = (typeof supportedOperations)[number];
/** uniapp 小程序平台类型 */
export type MiniCIPlatform = (typeof supportedPlatforms)[number];
/** 微信项目类型 */
export type ProjectType = "miniProgram" | "miniGame" | "miniProgramPlugin" | "miniGamePlugin";
/** 微信小程序 CI 配置 */
export interface WeappConfig {
  /** 小程序或小游戏项目的 appid */
  appid: string;
  /** 私钥文件路径 */
  privateKeyPath: string;
  /** 微信开发者工具安装路径 */
  devToolsInstallPath?: string;
  /** 项目类型 */
  type?: ProjectType;
  /** 上传需要排除的目录 */
  ignores?: string[];
  /** CI 机器人编号 */
  robot?: number;
  /** 预览和上传时的编译设置 */
  setting?: Record<string, unknown>;
}
/** 支付宝小程序上传终端类型 */
export type AlipayClientType =
  | "alipay"
  | "ampe"
  | "amap"
  | "genie"
  | "alios"
  | "uc"
  | "quark"
  | "koubei"
  | "alipayiot"
  | "cainiao"
  | "alihealth"
  | "health";
/** 支付宝小程序 CI 配置 */
export interface AlipayConfig {
  /** 小程序 appid */
  appid: string;
  /** 工具 id */
  toolId: string;
  /** 私钥文件路径 */
  privateKeyPath?: string;
  /** 私钥文本 */
  privateKey?: string;
  /** 小程序开发者工具安装路径 */
  devToolsInstallPath?: string;
  /** 上传终端类型 */
  clientType?: AlipayClientType;
  /** 上传时删除的版本号 */
  deleteVersion?: string;
}
/** 京东小程序 CI 配置 */
export interface JdConfig {
  /** 京东小程序秘钥 */
  privateKey: string;
  /** CI 机器人编号 */
  robot?: number;
  /** 上传忽略规则 */
  ignores?: string[];
}
/** 百度小程序 CI 配置 */
export interface SwanConfig {
  /** 百度小程序鉴权 token */
  token: string;
  /** 最低基础库版本 */
  minSwanVersion?: string;
  /** 百度开发者工具安装路径 */
  devToolsInstallPath?: string;
}
/** 字节小程序 CI 配置 */
export interface TTConfig {
  /** 字节小程序邮箱 */
  email: string;
  /** 字节小程序密码 */
  password: string;
  /** 字节 IDE 编译设置 */
  setting?: {
    /** 是否跳过域名校验 */
    skipDomainCheck?: boolean;
  };
}
/** 发布描述函数上下文 */
export interface MiniCIDescContext {
  /** 当前操作 */
  operation: MiniCIOperation;
  /** 当前平台 */
  platform: MiniCIPlatform;
  /** 当前发布版本 */
  version: string;
  /** 已解析的项目产物目录 */
  projectPath: string;
  /** 当前工作目录 */
  cwd: string;
  /** 当前项目 package.json 内容 */
  packageJson: Record<string, unknown>;
}
/** 动态发布描述生成函数（仅在 upload 操作时调用，open/preview 操作跳过） */
export type MiniCIDescFunction = (context: MiniCIDescContext) => string | Promise<string>;
/** minici 完成 hook 数据 */
export interface MiniCICompleteHookData {
  /** 当前操作是否成功 */
  success: boolean;
  /** 当前操作上下文和产物信息 */
  data: {
    /** 当前构建的小程序平台 */
    platform: MiniCIPlatform;
    /** 预览码本地路径 */
    qrCodeLocalPath?: string;
    /** 预览码内容 */
    qrCodeContent?: string;
    /** 插件或 CLI 传递的版本号 */
    version: string;
    /** 插件或 CLI 传递的描述文本 */
    desc: string;
    /** 预览或上传的目录路径 */
    projectPath: string;
  };
  /** 错误对象 */
  error?: Error;
}
/** minici 错误 hook 数据 */
export interface MiniCIErrorHookData {
  /** 错误发生在哪个操作；如果还没进入具体操作则为空 */
  operation?: MiniCIOperation;
  /** 当前平台；从运行参数能拿到时提供 */
  platform?: MiniCIPlatform;
  /** 错误对象 */
  error: Error;
  /** 已经解析出来的上下文；失败太早时可能为空或只有部分字段 */
  data?: Partial<{
    /** 当前构建的小程序平台 */
    platform: MiniCIPlatform;
    /** 预览码本地路径 */
    qrCodeLocalPath: string;
    /** 预览码内容 */
    qrCodeContent: string;
    /** 插件或 CLI 传递的版本号 */
    version: string;
    /** 插件或 CLI 传递的描述文本 */
    desc: string;
    /** 预览或上传的目录路径 */
    projectPath: string;
  }>;
}
/** minici 完成 hook 函数 */
export type MiniCICompleteHook = (data: MiniCICompleteHookData) => void | Promise<void>;
/** minici 错误 hook 函数 */
export type MiniCIErrorHook = (data: MiniCIErrorHookData) => void | Promise<void>;
/** minici hooks 配置 */
export interface MiniCIHooks {
  /** CI 执行 preview 后触发，成功和失败都会触发 */
  onPreviewComplete?: MiniCICompleteHook;
  /** CI 执行 upload 后触发，成功和失败都会触发 */
  onUploadComplete?: MiniCICompleteHook;
  /** 共享错误通知，在 runMiniCIWithConfig 内捕获到错误后触发 */
  onError?: MiniCIErrorHook;
}
/** minici 配置文件结构 */
export interface MiniCIConfig {
  /** 发布版本号 */
  version?: string;
  /** 发布描述 */
  desc?: string | MiniCIDescFunction;
  /** 小程序构建产物目录 */
  projectPath?: string;
  /** 二维码图片保存路径 */
  qrcodePath?: {
    /**
     * preview 操作的二维码图片保存路径。
     * @example "./output/preview.png"
     * @example "/tmp/my-preview.jpg"
     */
    preview?: string;
    /**
     * upload 操作的二维码图片保存路径。
     * @example "./output/upload.png"
     * @example "/tmp/my-upload.jpg"
     */
    upload?: string;
  };
  /** minici hooks 配置 */
  hooks?: MiniCIHooks;
  /** bumpp 程序化 API 参数，支持对象或动态函数 */
  bumpOptions?: BumpOptionsInput;
  /** 微信小程序配置 */
  "mp-weixin"?: WeappConfig;
  /** 支付宝小程序配置 */
  "mp-alipay"?: AlipayConfig;
  /** 百度小程序配置 */
  "mp-baidu"?: SwanConfig;
  /** 京东小程序配置 */
  "mp-jd"?: JdConfig;
  /** 字节小程序配置 */
  "mp-toutiao"?: TTConfig;
}
/** 平台与私有配置的映射关系 */
export interface PlatformConfigMap {
  /** 微信小程序配置 */
  "mp-weixin": WeappConfig;
  /** 支付宝小程序配置 */
  "mp-alipay": AlipayConfig;
  /** 百度小程序配置 */
  "mp-baidu": SwanConfig;
  /** 京东小程序配置 */
  "mp-jd": JdConfig;
  /** 字节小程序配置 */
  "mp-toutiao": TTConfig;
}
/** 已解析的 CLI 参数 */
export interface ParsedCliArgs {
  /** 当前操作列表 */
  operations: MiniCIOperation[];
  /** 是否执行 bumpp 版本更新 */
  bump?: boolean;
  /** 当前平台；bump-only 时可为空 */
  platform?: MiniCIPlatform;
  /** 项目产物目录 */
  projectPath?: string;
  /** 发布版本 */
  version?: string;
  /** 发布描述 */
  desc?: string;
  /** 配置文件路径 */
  config?: string;
  /** 当前工作目录 */
  cwd?: string;
  /** 标记为开发构建；默认 projectPath 使用 dist/dev/<platform> */
  dev?: boolean;
}
/** 规范化后的 minici 执行配置公共字段 */
export interface NormalizedMiniCIConfigBase {
  /** 当前操作 */
  operation: MiniCIOperation;
  /** 当前工作目录 */
  cwd: string;
  /** 已解析的项目产物目录 */
  projectPath: string;
  /** 发布版本 */
  version: string;
  /** 发布描述 */
  desc: string;
  /** 当前项目 package.json 内容 */
  packageJson: Record<string, unknown>;
  /** 二维码图片保存路径（已解析为绝对路径） */
  qrcodePath?: {
    /** preview 操作的二维码图片保存路径 */
    preview?: string;
    /** upload 操作的二维码图片保存路径 */
    upload?: string;
  };
}
/** 规范化后的 minici 执行配置 */
export type NormalizedMiniCIConfig<P extends MiniCIPlatform = MiniCIPlatform> =
  P extends MiniCIPlatform
    ? NormalizedMiniCIConfigBase & {
        /** 当前平台 */
        platform: P;
        /** 当前平台配置 */
        platformConfig: PlatformConfigMap[P];
      }
    : never;
/** minici 单个 action 执行结果 */
export interface MiniCISingleResult {
  /** 是否执行成功 */
  success: boolean;
  /** 当前操作 */
  operation: MiniCIOperation;
  /** 当前平台 */
  platform: MiniCIPlatform;
  /** 当前发布版本 */
  version: string;
  /** 当前发布描述 */
  desc: string;
  /** 当前项目目录 */
  projectPath: string;
  /** 二维码本地路径 */
  qrCodeLocalPath?: string;
  /** 二维码内容 */
  qrCodeContent?: string;
}
/** bumpp 执行结果 */
export interface MiniCIBumpResult {
  /** 是否执行成功 */
  success: boolean;
  /** 原版本号 */
  currentVersion: string;
  /** 新版本号 */
  newVersion: string;
  /** git commit 信息；未提交时为 false */
  commit: string | false;
  /** git tag 信息；未打 tag 时为 false */
  tag: string | false;
  /** 实际更新的文件 */
  updatedFiles: string[];
  /** 未包含旧版本号而跳过的文件 */
  skippedFiles: string[];
}
/** 只执行 bump 时的返回值 */
export interface MiniCIBumpOnlyResult {
  /** 是否执行成功 */
  success: true;
  /** bump-only 没有 CI action */
  operations: [];
  /** bump 执行结果 */
  bump: MiniCIBumpResult;
}
/** 执行 CI action 时的返回值 */
export interface MiniCIActionResult {
  /** 是否全部执行成功 */
  success: boolean;
  /** 当前操作列表 */
  operations: MiniCIOperation[];
  /** 当前平台 */
  platform: MiniCIPlatform;
  /** 当前发布版本 */
  version: string;
  /** 当前发布描述 */
  desc: string;
  /** 当前项目目录 */
  projectPath: string;
  /** bump 执行结果 */
  bump?: MiniCIBumpResult;
  /** 每个 action 的执行结果 */
  results: MiniCISingleResult[];
}
/** minici 执行聚合结果 */
export type MiniCIResult = MiniCIBumpOnlyResult | MiniCIActionResult;
/** 共享 minici 执行入口选项 */
export interface RunMiniCIWithConfigOptions {
  /** 已解析的运行参数 */
  args: ParsedCliArgs;
  /** 当前工作目录 */
  cwd: string;
  /** 已加载或直接传入的 minici 配置 */
  config: MiniCIConfig;
}
