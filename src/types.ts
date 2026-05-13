/** 支持的 CLI 操作列表 */
export const supportedOperations = ["open", "preview", "upload"] as const;

/** 支持的 uniapp 小程序平台列表 */
export const supportedPlatforms = [
  "mp-weixin",
  "mp-alipay",
  "mp-baidu",
  "mp-jd",
  "mp-toutiao",
] as const;

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

/** 动态发布描述生成函数 */
export type MiniCIDescFunction = (context: MiniCIDescContext) => string | Promise<string>;

/** minici 配置文件结构 */
export interface MiniCIConfig {
  /** 发布版本号 */
  version?: string;
  /** 发布描述 */
  desc?: string | MiniCIDescFunction;
  /** 小程序构建产物目录 */
  projectPath?: string;
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

/** CLI 入口选项 */
export interface CliOptions {
  /** 命令参数 */
  argv: string[];
  /** 当前工作目录 */
  cwd?: string;
  /** 是否直接退出进程 */
  exitProcess?: boolean;
}

/** 已解析的 CLI 参数 */
export interface ParsedCliArgs {
  /** 当前操作 */
  operation: MiniCIOperation;
  /** 当前平台 */
  platform: MiniCIPlatform;
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

/** minici 执行结果 */
export interface MiniCIResult {
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

/** 共享 minici 执行入口选项 */
export interface RunMiniCIWithConfigOptions {
  /** 已解析的运行参数 */
  args: ParsedCliArgs;
  /** 当前工作目录 */
  cwd: string;
  /** 已加载或直接传入的 minici 配置 */
  config: MiniCIConfig;
}

/** Vite 插件配置结构 */
export interface UniMiniCIPluginOptions extends MiniCIConfig {}
